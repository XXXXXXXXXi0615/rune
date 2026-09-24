import type { ProviderType } from '@/types';

export type ProviderRequestType =
  | 'chat' | 'vision' | 'structured_generation' | 'tool_continuation'
  | 'connection_test' | 'model_list' | 'transcription' | 'speech';
export type UsageProvenance =
  | 'server_reported' | 'derived_from_server' | 'estimated_local' | 'unavailable';
export type ProviderTransportKind =
  | 'openai-compatible' | 'anthropic' | 'gemini' | 'custom-http';

export interface ProviderUsageRecord {
  id: string;
  requestId: string;
  operationId?: string;
  conversationId?: string;
  timestamp: number;
  completedAt?: number;
  providerConfigId?: string;
  providerType: ProviderType;
  transportKind: ProviderTransportKind;
  model?: string;
  requestType: ProviderRequestType;
  streaming: boolean;
  attempt?: number;
  toolRound?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  usageProvenance: UsageProvenance;
  latencyMs: number;
  status: 'success' | 'error' | 'cancelled';
  httpStatus?: number;
  errorCode?: string;
  providerRequestId?: string;
  finishReason?: string;
  estimatedCostUsd?: number;
  pricingVersion?: string;
  serverReportedCost?: number;
  serverCostCurrency?: string;
}

export interface NormalizedApiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  cacheCreationTokens?: number;
}

export interface ProviderPricing {
  model: string;
  inputCostPerMillion?: number;
  cachedInputCostPerMillion?: number;
  outputCostPerMillion?: number;
  source?: string;
  updatedAt?: string;
}

export type BalanceQueryCapability = 'supported' | 'unsupported' | 'unknown';

export interface ProviderCapabilities {
  balanceQuery: BalanceQueryCapability;
}
