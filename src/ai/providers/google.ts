import type { ChatMessage, StreamChunk, AIRequestConfig } from '@/ai/types';

export async function* streamGoogle(
  _messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

  // Convert to Google format
  const contents = _messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
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
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
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
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

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
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield { content: text, done: false };
          }
        // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
