import type { NormalizedApiUsage, ProviderPricing } from './apiUsageTypes';

type UnknownRecord = Record<string, unknown>;
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

export function normalizeOpenAIUsage(raw: unknown): NormalizedApiUsage {
  const usage = (raw || {}) as UnknownRecord;
  const promptDetails = (usage.prompt_tokens_details || {}) as UnknownRecord;
  return {
    inputTokens: finite(usage.prompt_tokens),
    outputTokens: finite(usage.completion_tokens),
    totalTokens: finite(usage.total_tokens),
    cachedInputTokens: finite(promptDetails.cached_tokens),
  };
}

export function normalizeAnthropicUsage(raw: unknown): NormalizedApiUsage {
  const usage = (raw || {}) as UnknownRecord;
  const inputTokens = finite(usage.input_tokens);
  const outputTokens = finite(usage.output_tokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined,
    cachedInputTokens: finite(usage.cache_read_input_tokens),
    cacheCreationTokens: finite(usage.cache_creation_input_tokens),
  };
}

export function normalizeGeminiUsage(raw: unknown): NormalizedApiUsage {
  const usage = (raw || {}) as UnknownRecord;
  return {
    inputTokens: finite(usage.promptTokenCount),
    outputTokens: finite(usage.candidatesTokenCount),
    totalTokens: finite(usage.totalTokenCount),
    cachedInputTokens: finite(usage.cachedContentTokenCount),
  };
}

export function estimateUsageCost(usage: NormalizedApiUsage, pricing?: ProviderPricing): number | undefined {
  if (!pricing || usage.inputTokens === undefined || usage.outputTokens === undefined ||
      pricing.inputCostPerMillion === undefined || pricing.outputCostPerMillion === undefined) return undefined;
  const cached = usage.cachedInputTokens;
  if (cached !== undefined && pricing.cachedInputCostPerMillion === undefined) return undefined;
  const uncached = Math.max(0, usage.inputTokens - (cached || 0));
  return (uncached * pricing.inputCostPerMillion +
    (cached || 0) * (pricing.cachedInputCostPerMillion || 0) +
    usage.outputTokens * pricing.outputCostPerMillion) / 1_000_000;
}
