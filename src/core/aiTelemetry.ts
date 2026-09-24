/* ═══════════════════════════════════════════════════════
   aiTelemetry.ts — AI Telemetry Logging Layer

   Collects AI request metrics (tokens, latency, errors)
   and persists them to the Zustand store + localStorage.

   Usage:
     import { logAIRequest } from '@/core/aiTelemetry';

     const done = logAIRequest({
       prompt: combinedText,
       response: fullContent,
       provider: runtimeProvider.name,
       model: runtimeProvider.model,
       tokens: { input: inTokens, output: outTokens },
       latencyMs,
     });

     const failed = logAIRequest({
       prompt: combinedText,
       provider: activeProvider.name,
       model: activeProvider.model,
       error: new Error('timeout'),
       latencyMs: Date.now() - startedAt,
     });
   ═══════════════════════════════════════════════════════ */

import type { AiUsageLogEntry } from '@/types';

export interface AITelemetryParams {
  provider: string;
  model: string;
  source?: AiUsageLogEntry['source'];
  tokens?: { input?: number; output?: number; cached?: number; reasoning?: number; total?: number };
  estimate?: { input?: number; output?: number; total?: number; costUsd?: number; pricingVersion?: string; pricingUpdatedAt?: string };
  latencyMs?: number;
  errorCode?: string;
  error?: Error | string | null;
}

/**
 * Legacy compatibility converter. It intentionally performs no persistence;
 * production provider requests are written only by ProviderUsageLedger.
 */
export function logAIRequest(params: AITelemetryParams): AiUsageLogEntry {
  const { provider, model, source = 'chat', tokens, estimate, latencyMs, error, errorCode } = params;
  const status: 'success' | 'error' = error ? 'error' : 'success';
  const errorMessage = error ? (typeof error === 'string' ? error : error.message || 'Unknown error') : undefined;

  const entry: AiUsageLogEntry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    provider,
    model,
    source,
    status,
    inputTokens: tokens?.input,
    outputTokens: tokens?.output,
    cachedInputTokens: tokens?.cached,
    reasoningTokens: tokens?.reasoning,
    totalTokens: tokens?.total,
    estimated: Boolean(estimate),
    estimatedInputTokens: estimate?.input,
    estimatedOutputTokens: estimate?.output,
    estimatedTotalTokens: estimate?.total,
    estimatedCostUsd: estimate?.costUsd,
    pricingVersion: estimate?.pricingVersion,
    pricingUpdatedAt: estimate?.pricingUpdatedAt,
    latencyMs,
    errorCode,
    errorMessage,
  };

  return entry;
}

/**
 * Log an AI context read from systemBridge.
 * This records a lightweight telemetry event for
 * system state consumption by AI.
 */
export function logAIContextRead(context: Record<string, unknown>): void {
  // Context reads are not provider API requests and therefore do not belong
  // in the canonical API-usage ledger. Keep this hook for diagnostics only.
  void context;
}

/* ── MCP Tool Call Telemetry ── */

export interface MCPToolCallParams {
  toolName: string;
  success: boolean;
  latencyMs?: number;
  round?: number;
  totalRounds?: number;
}

/**
 * Log an MCP tool call for the AI Usage dashboard.
 */
export function logMCPToolCall(params: MCPToolCallParams): void {
  // MCP calls are tool diagnostics, not billable provider requests.
  void params;
}
