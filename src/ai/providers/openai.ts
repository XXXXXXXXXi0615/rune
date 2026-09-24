import { AIProviderHttpError, type ChatMessage, type StreamChunk, type AIRequestConfig, type ToolCall } from '@/ai/types';
import { normalizeOpenAIUsage } from '@/features/apiUsage/apiUsageNormalizer';

function endpointUrl(baseUrl: string, endpoint: string, fallback: string): string {
  const target = endpoint.trim() || fallback;
  if (/^https?:\/\//i.test(target)) return target;
  return `${baseUrl.replace(/\/+$/, '')}/${target.replace(/^\/+/, '')}`;
}

export async function* streamOpenAI(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  const url = endpointUrl(baseUrl, config.chatEndpoint || '', 'chat/completions');
  const streaming = config.streamingEnabled !== false;

  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    stream: streaming,
    ...(streaming ? { stream_options: { include_usage: true } } : {}),
    ...(config.tools && config.tools.length > 0 ? { tools: config.tools, tool_choice: 'auto' } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
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
    let message = `OpenAI API error (${res.status})`;
    try {
      const err = JSON.parse(text);
      if (err.error?.message) message = err.error.message;
    // eslint-disable-next-line no-empty
    } catch {}
    throw new AIProviderHttpError(message, res);
  }

  if (!streaming) {
    const parsed = await res.json();
    const usage = normalizeOpenAIUsage(parsed.usage);
    const content = parsed.choices?.[0]?.message?.content;
    const toolCalls = parsed.choices?.[0]?.message?.tool_calls;
    const responseMeta = { status: res.status, contentType: res.headers.get('content-type') || undefined };
    if (toolCalls && toolCalls.length > 0) {
      yield { content: '', done: true, finalToolCalls: toolCalls as ToolCall[], responseMeta, usage: { ...usage, estimated: false } };
      return;
    }
    if (content) yield { content, done: true, responseMeta, usage: { ...usage, estimated: false } };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let streamUsage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number } | null = null;

  // Accumulate tool calls by index across stream chunks
  const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();

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
        if (payload === '[DONE]') {
          // If we accumulated tool calls, yield them now
          if (toolCallAccum.size > 0) {
            const finalToolCalls: ToolCall[] = [];
            const sorted = [...toolCallAccum.entries()].sort(([a], [b]) => a - b);
            for (const [, tc] of sorted) {
              finalToolCalls.push({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.args },
              });
            }
            yield { content: '', done: true, finalToolCalls, ...(streamUsage ? { usage: { ...streamUsage, estimated: false } } : {}) };
            return;
          }
          if (streamUsage) {
            yield { content: '', done: true, usage: { ...streamUsage, estimated: false } };
          }
          return;
        }

        try {
          const parsed = JSON.parse(payload);
          // Capture usage from stream_options include_usage chunk
          if (parsed.usage && (!parsed.choices || parsed.choices.length === 0)) {
            streamUsage = normalizeOpenAIUsage(parsed.usage) as { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
            continue;
          }
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Tool call deltas — accumulate by index
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0;
              const existing = toolCallAccum.get(idx) || { id: '', name: '', args: '' };

              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.args += tc.function.arguments;

              toolCallAccum.set(idx, existing);
            }
            continue;
          }

          if (delta.content) {
            yield { content: delta.content, done: false };
          }
        // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
