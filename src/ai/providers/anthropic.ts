import { AIProviderHttpError, type ChatMessage, type StreamChunk, type AIRequestConfig } from '@/ai/types';
import { normalizeAnthropicUsage } from '@/features/apiUsage/apiUsageNormalizer';

function mergeKnownUsage(current: ReturnType<typeof normalizeAnthropicUsage>, next: ReturnType<typeof normalizeAnthropicUsage>) {
  return Object.fromEntries(Object.entries({ ...current, ...next }).filter(([, value]) => value !== undefined));
}

function endpointUrl(baseUrl: string, endpoint: string, fallback: string): string {
  const target = endpoint.trim() || fallback;
  if (/^https?:\/\//i.test(target)) return target;
  return `${baseUrl.replace(/\/+$/, '')}/${target.replace(/^\/+/, '')}`;
}

export async function* streamAnthropic(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
  const url = endpointUrl(baseUrl, config.chatEndpoint || '', 'messages');
  const streaming = config.streamingEnabled !== false;

  // Separate system message from conversation
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: config.model,
    messages: conversation,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    stream: streaming,
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
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
    let message = `Anthropic API error (${res.status})`;
    try {
      const err = JSON.parse(text);
      if (err.error?.message) message = err.error.message;
    // eslint-disable-next-line no-empty
    } catch {}
    throw new AIProviderHttpError(message, res);
  }

  // Non-streaming: capture usage too
  if (!streaming) {
    const parsed = await res.json();
    const usage = normalizeAnthropicUsage(parsed.usage);
    const toolUses = parsed.content?.filter((part: { type?: string }) => part.type === 'tool_use') || [];
    if (toolUses.length > 0) {
      yield {
        content: '',
        done: true,
        finalToolCalls: toolUses.map((part: { id?: string; name?: string; input?: unknown }) => ({ id: part.id || '', type: 'function' as const, function: { name: part.name || '', arguments: JSON.stringify(part.input || {}) } })),
        responseMeta: { status: res.status, contentType: res.headers.get('content-type') || undefined },
        usage: { ...usage, estimated: false },
      };
      return;
    }
    const content = parsed.content
      ?.filter((part: { type?: string }) => part.type === 'text')
      .map((part: { text?: string }) => part.text || '')
      .join('');
    yield {
      content,
      done: true,
      responseMeta: { status: res.status, contentType: res.headers.get('content-type') || undefined },
      usage: { ...usage, estimated: false },
    };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let streamUsage = normalizeAnthropicUsage(undefined);

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

          if (parsed.type === 'message_start' || parsed.type === 'message_delta') {
            streamUsage = mergeKnownUsage(streamUsage, normalizeAnthropicUsage(parsed.message?.usage || parsed.usage));
          }

          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta?.text;
            if (delta) {
              yield { content: delta, done: false };
            }
          }

          if (parsed.type === 'message_stop') {
            yield { content: '', done: true, usage: { ...streamUsage, estimated: false } };
            return;
          }
        // eslint-disable-next-line no-empty
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
