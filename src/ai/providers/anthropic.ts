import type { ChatMessage, StreamChunk, AIRequestConfig } from '@/ai/types';

export async function* streamAnthropic(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com';
  const url = `${baseUrl}/v1/messages`;

  // Separate system message from conversation
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: config.model,
    messages: conversation,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    stream: true,
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

          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta?.text;
            if (delta) {
              yield { content: delta, done: false };
            }
          }

          if (parsed.type === 'message_stop') {
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
