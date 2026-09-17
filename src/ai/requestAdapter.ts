/**
 * Request Adapter — unified pipeline for building and normalising AI requests.
 *
 * All provider requests flow through `buildChatRequest()`.
 * No raw provider parameters are assembled in Chat UI components.
 */

import { resolveProviderRequestConfig, resolveChatProvider } from '@/ai/providerRuntime';
import { getModelCapabilities, styleDefaults } from '@/ai/modelCapabilities';
import { assemblePrompt, shouldCompress } from '@/ai/conversationEngine';
import {
  useChatRuntimeStore,
  DEFAULT_SETTINGS,
} from '@/store/useChatRuntimeStore';
import { useAppStore } from '@/store/useAppStore';
import type { AIRequestConfig, ChatMessage } from '@/ai/types';
import type { Message } from '@/types';

export interface BuildRequestInput {
  conversationId: string;
  currentMessage: string;
  rawMessages: Message[];
  /** System prompt from user config or default */
  systemPrompt: string;
  persona?: string;
}

export interface BuildRequestOutput {
  config: AIRequestConfig;
  messages: ChatMessage[];
  diagnostics: {
    usedSummary: boolean;
    rawRoundsUsed: number;
    longTermMemoriesUsed: number;
    estimatedInputTokens: number;
    compressTriggered: boolean;
    compressError?: string;
  };
}

/**
 * Main request builder.
 *
 * Pipeline:
 * 1. Read ConversationRuntimeSettings
 * 2. Read ModelCapabilities
 * 3. Normalise parameters
 * 4. Filter unsupported parameters
 * 5. Assemble context
 * 6. Estimate tokens
 * 7. Trigger compression if needed
 * 8. Build AIRequestConfig
 */
export async function buildChatRequest(input: BuildRequestInput): Promise<BuildRequestOutput> {
  const { conversationId, currentMessage, rawMessages, systemPrompt, persona } = input;

  // 1. Read settings
  const runtimeStore = useChatRuntimeStore.getState();
  const settings = runtimeStore.getSettings(conversationId);
  const contextState = runtimeStore.getContextState(conversationId);
  const effective = { ...DEFAULT_SETTINGS, ...settings };

  // 2. Resolve provider & capabilities
  const { providers, aiRoles } = useAppStore.getState();
  const { provider } = resolveChatProvider(aiRoles, providers || []);
  const capabilities = provider
    ? getModelCapabilities(provider.model)
    : getModelCapabilities('');

  // 3. Normalise parameters based on generation style
  let temperature = effective.temperature;
  let topP = effective.topP;
  if (effective.generationStyle !== 'custom') {
    const defs = styleDefaults(effective.generationStyle);
    temperature = defs.temperature;
    topP = defs.topP;
  }

  const maxTokens = effective.maxOutputTokens || (provider?.maxTokens || 4096);

  // 4. Assemble context
  const assembly = assemblePrompt({
    systemPrompt,
    persona,
    settings: effective,
    contextState,
    chatMessages: rawMessages
      .filter((m) => m.type === 'text' && !m.revoked && !m.deletedAt && !m.deletedForSelfAt && !m.deletedForAllAt)
      .map((m): ChatMessage => ({
        role: m.sender === 'assistant' ? 'assistant' : 'user',
        content: (m as { content: string }).content || '',
      })),
    rawMessages,
    currentUserMessage: currentMessage,
  });

  // 6-7. Check compression
  let compressTriggered = false;
  let compressError: string | undefined;
  const maxContextTokens = (provider as { contextMessageLimit?: number } | null)?.contextMessageLimit ||
    getModelCapabilities(provider?.model || '').maxOutputTokens * 4 ||
    16000;

  if (shouldCompress(assembly.estimatedInputTokens, maxContextTokens, effective)) {
    compressTriggered = true;
    // Compress would be handled asynchronously; flag it here
    if (contextState.lastCompressError) {
      compressError = contextState.lastCompressError;
    }
  }

  // 8. Build AIRequestConfig
  const baseConfig = provider
    ? await resolveProviderRequestConfig(provider, assembly.systemPrompt)
    : {
        provider: 'deepseek' as const,
        model: 'deepseek-chat',
        apiKey: '',
        baseUrl: 'https://api.deepseek.com/v1',
        temperature,
        maxTokens,
        topP,
        systemPrompt: assembly.systemPrompt,
        streamingEnabled: true,
        chatEndpoint: '/chat/completions',
        apiKeyOptional: false,
      };

  // Filter unsupported parameters
  const config: AIRequestConfig = {
    ...baseConfig,
    temperature: capabilities.supportsTemperature ? temperature : 0,
    maxTokens: capabilities.supportsMaxOutputTokens
      ? Math.min(maxTokens, capabilities.maxOutputTokens)
      : maxTokens,
    topP: capabilities.supportsTopP ? topP : 1,
    systemPrompt: assembly.systemPrompt,
  };

  return {
    config,
    messages: assembly.messages,
    diagnostics: {
      usedSummary: assembly.usedSummary,
      rawRoundsUsed: assembly.rawRoundsUsed,
      longTermMemoriesUsed: assembly.longTermMemoriesUsed,
      estimatedInputTokens: assembly.estimatedInputTokens,
      compressTriggered,
      compressError,
    },
  };
}

/**
 * Estimate cost for a request based on provider and token counts.
 */
export function calculateCost(
  providerType: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Pricing per 1M tokens [input, output]
  const PRICING: Record<string, [number, number]> = {
    'gpt-4o': [2.5, 10],
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4-turbo': [10, 30],
    'gpt-4': [30, 60],
    'gpt-3.5-turbo': [0.5, 1.5],
    'o1': [15, 60],
    'o1-mini': [1.1, 4.4],
    'o3-mini': [1.1, 4.4],
    'claude-3.5-sonnet': [3, 15],
    'claude-3-haiku': [0.25, 1.25],
    'claude-3-opus': [15, 75],
    'claude-3.7-sonnet': [3, 15],
    'gemini-2.0-flash': [0.1, 0.4],
    'gemini-1.5-pro': [1.25, 5],
    'gemini-1.5-flash': [0.075, 0.3],
    'deepseek-chat': [0.14, 0.28],
    'deepseek-reasoner': [0.55, 2.19],
  };

  const key = Object.keys(PRICING).find((k) => model.toLowerCase().includes(k));
  if (!key) return 0;

  const [inputPrice, outputPrice] = PRICING[key];
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}
