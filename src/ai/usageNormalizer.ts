// Normalize API response usage to AiUsageLogEntry
import type { AiUsageLogEntry } from '@/types';

interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

export function normalizeApiUsage(params: {
  responseBody?: { usage?: RawUsage };
  provider: string;
  model: string;
  source: AiUsageLogEntry['source'];
  status: 'success' | 'error';
  latencyMs?: number;
  errorMessage?: string;
  responseText?: string;
}): AiUsageLogEntry {
  const { responseBody, provider, model, source, status, latencyMs, errorMessage, responseText } = params;
  const usage = responseBody?.usage;

  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? inputTokens + outputTokens;

  const hasRealUsage = usage && (inputTokens > 0 || outputTokens > 0 || totalTokens > 0);
  let estimatedTokens = 0;
  let estimated = false;

  if (!hasRealUsage && responseText && status === 'success') {
    // Rough estimate: Chinese ~1.5 chars/token, English ~4 chars/token
    const len = responseText.length;
    const chineseChars = (responseText.match(/[一-鿿]/g) || []).length;
    const otherChars = len - chineseChars;
    estimatedTokens = Math.ceil(chineseChars / 1.5 + otherChars / 4);
    estimated = true;
  }

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    provider,
    model,
    source,
    status,
    inputTokens: inputTokens || undefined,
    outputTokens: outputTokens || undefined,
    cachedInputTokens: cachedInputTokens || undefined,
    reasoningTokens: reasoningTokens || undefined,
    totalTokens: totalTokens || estimatedTokens || undefined,
    estimated,
    latencyMs,
    errorMessage,
  };
}
