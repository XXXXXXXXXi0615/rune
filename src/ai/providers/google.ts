import { AIProviderHttpError, type ChatMessage, type StreamChunk, type AIRequestConfig } from '@/ai/types';
import { normalizeGeminiUsage } from '@/features/apiUsage/apiUsageNormalizer';

function googleEndpoint(config: AIRequestConfig, streaming: boolean): string {
  const baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const method = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const fallback = `models/${encodeURIComponent(config.model)}:${method}`;
  const endpoint = (config.chatEndpoint || '').trim() || fallback;
  return /^https?:\/\//i.test(endpoint)
    ? endpoint
    : `${baseUrl}/${endpoint.replace(/^\/+/, '')}`;
}

export async function* streamGoogle(
  _messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  const streaming = config.streamingEnabled !== false;
  const url = googleEndpoint(config, streaming);

  // Convert message parts to Gemini part format
  function toGeminiParts(content: string | import('@/ai/types').ContentPart[]): { text?: string; inlineData?: { mimeType: string; data: string } }[] {
    if (typeof content === 'string') return [{ text: content }];
    return content.map((part) => {
      if (part.type === 'text') return { text: part.text };
      if (part.type === 'image_url') {
        const m = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
        if (m) return { inlineData: { mimeType: m[1], data: m[2] } };
        return { text: '' };
      }
      if (part.type === 'image') return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data } };
      return { text: '' };
    });
  }

  // Convert to Google format
  const contents = _messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content),
    }));

  const systemMsg = _messages.find((m) => m.role === 'system');
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      topP: config.topP,
    },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content.map(p => p.type === 'text' ? p.text : '').join(' ') }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'x-goog-api-key': config.apiKey } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`無法連線到 ${baseUrl}：${msg}`, { cause: err });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Google API error (${res.status})`;
    try {
      const err = JSON.parse(text);
      if (err.error?.message) message = err.error.message;
    // eslint-disable-next-line no-empty
    } catch {}
    throw new AIProviderHttpError(message, res);
  }

  if (!streaming) {
    const parsed = await res.json();
    const usage = normalizeGeminiUsage(parsed.usageMetadata);
    const parts = parsed.candidates?.[0]?.content?.parts || [];
    const functionCalls = parts.filter((part: { functionCall?: unknown }) => part.functionCall);
    if (functionCalls.length > 0) {
      yield {
        content: '',
        done: true,
        finalToolCalls: functionCalls.map((part: { functionCall: { name?: string; args?: unknown } }, index: number) => ({ id: `google-function-${index}`, type: 'function' as const, function: { name: part.functionCall.name || '', arguments: JSON.stringify(part.functionCall.args || {}) } })),
        responseMeta: { status: res.status, contentType: res.headers.get('content-type') || undefined },
        usage: { ...usage, estimated: false },
      };
      return;
    }
    const text = parsed.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('');
    yield {
      content: text,
      done: true,
      responseMeta: { status: res.status, contentType: res.headers.get('content-type') || undefined },
      usage: { ...usage, estimated: false },
    };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  // Pre-calc input chars for token estimation
  const totalInputChars = _messages.reduce((sum, m) => sum + m.content.length, 0);

  const decoder = new TextDecoder();
  let buffer = '';
  let outputCharCount = 0;
  let reportedUsage = normalizeGeminiUsage(undefined);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();
        if (!payload) continue;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.usageMetadata) reportedUsage = normalizeGeminiUsage(parsed.usageMetadata);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            outputCharCount += text.length;
            yield { content: text, done: false };
          }
        // eslint-disable-next-line no-empty
        } catch {}
      }
    }
    if (Object.values(reportedUsage).some((value) => value !== undefined)) {
      yield { content: '', done: true, usage: { ...reportedUsage, estimated: false } };
    } else if (outputCharCount > 0) {
      const inTokens = Math.ceil(totalInputChars / 3.5);
      const outTokens = Math.ceil(outputCharCount / 3.5);
      yield { content: '', done: true, usage: { inputTokens: inTokens, outputTokens: outTokens, estimated: true } };
    }
  } finally {
    reader.releaseLock();
  }
}
