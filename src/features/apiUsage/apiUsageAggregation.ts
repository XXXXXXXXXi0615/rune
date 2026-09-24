import type { ProviderUsageRecord } from './apiUsageTypes';

export interface ApiUsageAggregate {
  requestCount: number; successfulRequests: number; failedRequests: number; abortedRequests: number;
  inputTokens: number | null; outputTokens: number | null; totalTokens: number | null; cachedInputTokens: number | null;
  cacheHitRate: number | null; averageLatencyMs: number | null; estimatedCostUsd: number | null;
}

export function aggregateApiUsage(records: ProviderUsageRecord[]): ApiUsageAggregate {
  let input = 0, output = 0, total = 0, cached = 0, latency = 0, cost = 0;
  let hasInput = false, hasOutput = false, hasTotal = false, hasCached = false, hasCost = false;
  let knownInput = 0, cacheComparableInput = 0;
  for (const row of records) {
    if (row.inputTokens !== undefined) { input += row.inputTokens; hasInput = true; }
    if (row.outputTokens !== undefined) { output += row.outputTokens; hasOutput = true; }
    if (row.totalTokens !== undefined) { total += row.totalTokens; hasTotal = true; }
    if (row.cachedInputTokens !== undefined) { cached += row.cachedInputTokens; hasCached = true; }
    latency += row.latencyMs;
    if (row.estimatedCostUsd !== undefined) { cost += row.estimatedCostUsd; hasCost = true; }
    if (row.inputTokens !== undefined && row.cachedInputTokens !== undefined) {
      knownInput += row.cachedInputTokens;
      cacheComparableInput += row.inputTokens;
    }
  }
  return {
    requestCount: records.length,
    successfulRequests: records.filter((r) => r.status === 'success').length,
    failedRequests: records.filter((r) => r.status === 'error').length,
    abortedRequests: records.filter((r) => r.status === 'cancelled').length,
    inputTokens: hasInput ? input : null, outputTokens: hasOutput ? output : null,
    totalTokens: hasTotal ? total : null, cachedInputTokens: hasCached ? cached : null,
    cacheHitRate: cacheComparableInput > 0 ? knownInput / cacheComparableInput : null,
    averageLatencyMs: records.length ? latency / records.length : null,
    estimatedCostUsd: hasCost ? cost : null,
  };
}

export function recordsForPeriod(records: ProviderUsageRecord[], days: 1 | 7 | 30, now = Date.now()): ProviderUsageRecord[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  return records.filter((row) => row.timestamp >= start.getTime() && row.timestamp <= now);
}

export function groupApiUsage(records: ProviderUsageRecord[], key: 'provider' | 'model' | 'day'): Record<string, ApiUsageAggregate> {
  const buckets: Record<string, ProviderUsageRecord[]> = {};
  for (const row of records) {
    const value = key === 'provider' ? row.providerType : key === 'model' ? (row.model || 'unknown') : new Date(row.timestamp).toISOString().slice(0, 10);
    (buckets[value] ||= []).push(row);
  }
  return Object.fromEntries(Object.entries(buckets).map(([value, rows]) => [value, aggregateApiUsage(rows)]));
}
