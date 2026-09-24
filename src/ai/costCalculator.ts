import type { ProviderType } from '@/types';

/**
 * Approximate pricing per 1M tokens (USD).
 * Prices are approximate — actual cost depends on the exact model version.
 */
interface TierPricing {
  /** $ per 1M input tokens */
  input: number;
  /** $ per 1M output tokens */
  output: number;
}

function modelTier(model: string): string {
  const m = model.toLowerCase();
  // OpenAI
  if (m.includes('gpt-4o-mini')) return 'openai-4o-mini';
  if (m.includes('gpt-4o') || m.includes('gpt-4-')) return 'openai-4o';
  if (m.includes('gpt-4')) return 'openai-4';
  if (m.includes('gpt-3.5')) return 'openai-35';
  if (m.includes('o3-mini') || m.includes('o1-mini')) return 'openai-o-mini';
  if (m.includes('o3') || m.includes('o1')) return 'openai-o';
  // Anthropic
  if (m.includes('claude-3-opus')) return 'claude-opus';
  if (m.includes('claude-3.5') || m.includes('claude-3-5')) return 'claude-sonnet';
  if (m.includes('claude-3-haiku')) return 'claude-haiku';
  if (m.includes('claude-4')) return 'claude-sonnet';
  if (m.includes('claude')) return 'claude-sonnet';
  // Google Gemini
  if (m.includes('gemini-2.5-pro')) return 'gemini-25-pro';
  if (m.includes('gemini-2.5-flash')) return 'gemini-25-flash';
  if (m.includes('gemini-2.0')) return 'gemini-20';
  if (m.includes('gemini-1.5-pro')) return 'gemini-15-pro';
  if (m.includes('gemini-1.5-flash')) return 'gemini-15-flash';
  if (m.includes('gemini')) return 'gemini-20';
  // DeepSeek
  if (m.includes('deepseek-reasoner') || m.includes('deepseek-r1')) return 'deepseek-reasoner';
  if (m.includes('deepseek')) return 'deepseek-chat';
  // Groq
  if (m.includes('llama-3.3') || m.includes('llama-3-70')) return 'groq-large';
  if (m.includes('llama-3') || m.includes('llama-4')) return 'groq-small';
  if (m.includes('mixtral')) return 'groq-mixtral';
  if (m.includes('gemma')) return 'groq-small';
  // SiliconFlow
  if (m.includes('qwen')) return 'siliconflow-free';
  if (m.includes('deepseek') && m.includes('siliconflow')) return 'siliconflow-free';
  return 'default';
}

export const AI_PRICING_VERSION = 'lunartide-pricing-2026-08-25';
export const AI_PRICING_UPDATED_AT = '2026-08-25';

export function estimateKnownCost(
  providerType: ProviderType,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const tier = modelTier(model);
  if (tier === 'default') return undefined;
  return estimateCost(providerType, model, inputTokens, outputTokens);
}

const PRICING: Record<string, TierPricing> = {
  'openai-4o':        { input: 2.50,  output: 10.00 },
  'openai-4o-mini':   { input: 0.15,  output: 0.60  },
  'openai-4':         { input: 30.00, output: 60.00 },
  'openai-35':        { input: 0.50,  output: 1.50  },
  'openai-o':         { input: 15.00, output: 60.00 },
  'openai-o-mini':    { input: 1.10,  output: 4.40  },
  'claude-opus':      { input: 15.00, output: 75.00 },
  'claude-sonnet':    { input: 3.00,  output: 15.00 },
  'claude-haiku':     { input: 0.80,  output: 4.00  },
  'gemini-25-pro':    { input: 1.25,  output: 10.00 },
  'gemini-25-flash':  { input: 0.15,  output: 0.60  },
  'gemini-20':        { input: 0.10,  output: 0.40  },
  'gemini-15-pro':    { input: 1.25,  output: 5.00  },
  'gemini-15-flash':  { input: 0.075, output: 0.30  },
  'deepseek-chat':    { input: 0.27,  output: 1.10  },
  'deepseek-reasoner':{ input: 0.55,  output: 2.19  },
  'groq-large':       { input: 0.59,  output: 0.79  },
  'groq-small':       { input: 0.05,  output: 0.08  },
  'groq-mixtral':     { input: 0.24,  output: 0.24  },
  'siliconflow-free': { input: 0,     output: 0     },
  'default':          { input: 0.50,  output: 1.50  },
};

/**
 * Calculate cost in USD for a given provider, model, and token counts.
 * Returns 0 if pricing data is unavailable for the model.
 */
export function estimateCost(
  providerType: ProviderType,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const tier = modelTier(model);
  const pricing = PRICING[tier];
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal max
}
