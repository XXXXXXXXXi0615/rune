import type { ChatMessage, StreamChunk, AIRequestConfig } from '@/ai/types';
import { streamOpenAI } from '@/ai/providers/openai';
import { streamAnthropic } from '@/ai/providers/anthropic';
import { streamGoogle } from '@/ai/providers/google';
import { getProviderUsageLedger } from '@/features/apiUsage/ProviderUsageLedger';
import type { NormalizedApiUsage } from '@/features/apiUsage/apiUsageTypes';
import type { ProviderType } from '@/types';
import { AIProviderHttpError } from '@/ai/types';

function providerType(config: AIRequestConfig): ProviderType {
  if (config.providerType) return config.providerType;
  if (config.provider === 'anthropic') return 'claude';
  if (config.provider === 'google') return 'gemini';
  return config.provider;
}

function transportKind(config: AIRequestConfig) {
  if (config.provider === 'anthropic') return 'anthropic' as const;
  if (config.provider === 'google') return 'gemini' as const;
  if (config.provider === 'custom') return 'custom-http' as const;
  return 'openai-compatible' as const;
}

export async function* sendChatMessage(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  if (!config.apiKey && !config.apiKeyOptional) {
    throw new Error('請先在設定中設定 API Key');
  }

  const startedAt = Date.now();
  const requestId = config.telemetry?.requestId || crypto.randomUUID();
  let usage: NormalizedApiUsage = {};
  let estimated = false;
  let responseMeta: StreamChunk['responseMeta'];
  let terminal = false;

  const record = async (status: 'success' | 'error' | 'cancelled', error?: unknown) => {
    if (terminal) return;
    terminal = true;
    if (config.persistUsage === false) return;
    const completedAt = Date.now();
    const hasUsage = Object.values(usage).some((value) => value !== undefined);
    const derivedTotal = usage.totalTokens === undefined && usage.inputTokens !== undefined && usage.outputTokens !== undefined;
    try {
      await getProviderUsageLedger().record({
        id: crypto.randomUUID(), requestId,
        ...(config.telemetry?.operationId ? { operationId: config.telemetry.operationId } : {}),
        ...(config.telemetry?.conversationId ? { conversationId: config.telemetry.conversationId } : {}),
        timestamp: startedAt, completedAt,
        ...(config.providerConfigId ? { providerConfigId: config.providerConfigId } : {}),
        providerType: providerType(config), transportKind: transportKind(config), model: config.model,
        requestType: config.telemetry?.requestType || 'chat', streaming: config.streamingEnabled !== false,
        ...(config.telemetry?.attempt !== undefined ? { attempt: config.telemetry.attempt } : {}),
        ...(config.telemetry?.toolRound !== undefined ? { toolRound: config.telemetry.toolRound } : {}),
        ...usage,
        ...(derivedTotal ? { totalTokens: usage.inputTokens! + usage.outputTokens! } : {}),
        usageProvenance: estimated ? 'estimated_local' : derivedTotal ? 'derived_from_server' : hasUsage ? 'server_reported' : 'unavailable',
        latencyMs: Math.max(0, completedAt - startedAt), status,
        ...(responseMeta?.status !== undefined ? { httpStatus: responseMeta.status } : {}),
        ...(responseMeta?.requestId ? { providerRequestId: responseMeta.requestId } : {}),
        ...(responseMeta?.finishReason ? { finishReason: responseMeta.finishReason } : {}),
        ...(error ? { errorCode: error instanceof Error ? error.name : 'UnknownError' } : {}),
      });
    } catch {
      // Observability must never alter provider request behavior.
    }
  };
  try {
    let stream: AsyncGenerator<StreamChunk>;
    switch (config.provider) {
      case 'openai': case 'custom': case 'deepseek': stream = streamOpenAI(messages, config, signal); break;
      case 'anthropic': stream = streamAnthropic(messages, config, signal); break;
      case 'google': stream = streamGoogle(messages, config, signal); break;
      default: throw new Error(`Unsupported provider: ${config.provider}`);
    }
    for await (const chunk of stream) {
      if (chunk.usage) {
        usage = chunk.usage;
        estimated = chunk.usage.estimated;
      }
      if (chunk.responseMeta) responseMeta = chunk.responseMeta;
      yield chunk;
    }
    await record('success');
  } catch (error) {
    const aborted = signal?.aborted || (error instanceof DOMException && error.name === 'AbortError');
    if (error instanceof AIProviderHttpError) responseMeta = { status: error.status, contentType: error.contentType };
    await record(aborted ? 'cancelled' : 'error', error);
    throw error;
  } finally {
    await record('cancelled');
  }
}
