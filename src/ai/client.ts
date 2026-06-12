import type { ChatMessage, StreamChunk, AIRequestConfig } from '@/ai/types';
import { streamOpenAI } from '@/ai/providers/openai';
import { streamAnthropic } from '@/ai/providers/anthropic';
import { streamGoogle } from '@/ai/providers/google';

export async function* sendChatMessage(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  if (!config.apiKey) {
    throw new Error('請先在設定中設定 API Key');
  }

  switch (config.provider) {
    case 'openai':
    case 'custom':
    case 'deepseek':
      yield* streamOpenAI(messages, config, signal);
      break;
    case 'anthropic':
      yield* streamAnthropic(messages, config, signal);
      break;
    case 'google':
      yield* streamGoogle(messages, config, signal);
      break;
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

export function extractAiConfig(config: AIRequestConfig): AIRequestConfig {
  return {
    provider: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    systemPrompt: config.systemPrompt,
  };
}
