/** Capabilities a specific model supports. Used to filter UI controls and API params. */

export interface ModelCapabilities {
  supportsTemperature: boolean;
  temperatureRange: [number, number];
  supportsTopP: boolean;
  topPRange: [number, number];
  supportsMaxOutputTokens: boolean;
  maxOutputTokens: number;
  supportsReasoningControl: boolean;
  reasoningModes: string[];
  supportsSeed: boolean;
  supportsFrequencyPenalty: boolean;
  frequencyPenaltyRange: [number, number];
  supportsPresencePenalty: boolean;
  presencePenaltyRange: [number, number];
  supportsPromptCacheMetrics: boolean;
  supportsContextUsage: boolean;
}

const DEFAULT_CAPS: ModelCapabilities = {
  supportsTemperature: true,
  temperatureRange: [0, 2] as [number, number],
  supportsTopP: true,
  topPRange: [0, 1] as [number, number],
  supportsMaxOutputTokens: true,
  maxOutputTokens: 128_000,
  supportsReasoningControl: false,
  reasoningModes: [],
  supportsSeed: false,
  supportsFrequencyPenalty: false,
  frequencyPenaltyRange: [-2, 2] as [number, number],
  supportsPresencePenalty: false,
  presencePenaltyRange: [-2, 2] as [number, number],
  supportsPromptCacheMetrics: false,
  supportsContextUsage: false,
};

/** Per-model capability overrides. Partial — missing keys fall back to DEFAULT_CAPS. */
const CAPABILITY_MAP: Record<string, Partial<ModelCapabilities>> = {
  // OpenAI
  'gpt-4o': { maxOutputTokens: 16384, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'gpt-4o-mini': { maxOutputTokens: 16384, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'gpt-4-turbo': { maxOutputTokens: 4096, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'gpt-4': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'gpt-3.5-turbo': { maxOutputTokens: 4096, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'o1': { maxOutputTokens: 100_000, supportsTemperature: false, supportsTopP: false, supportsFrequencyPenalty: false, supportsPresencePenalty: false, supportsReasoningControl: true, reasoningModes: ['low', 'medium', 'high'], supportsSeed: true },
  'o1-mini': { maxOutputTokens: 65536, supportsTemperature: false, supportsTopP: false, supportsFrequencyPenalty: false, supportsPresencePenalty: false, supportsReasoningControl: true, reasoningModes: ['low', 'medium', 'high'] },
  'o3-mini': { maxOutputTokens: 100_000, supportsTemperature: false, supportsTopP: false, supportsFrequencyPenalty: false, supportsPresencePenalty: false, supportsReasoningControl: true, reasoningModes: ['low', 'medium', 'high'] },
  'gpt-4.1': { maxOutputTokens: 128_000, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },

  // Anthropic
  'claude-3-opus': { maxOutputTokens: 4096, supportsTemperature: true, temperatureRange: [0, 1], supportsTopP: true, supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3.5-sonnet': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 1], supportsTopP: true, supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3.5-haiku': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 1], supportsTopP: true, supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3-sonnet': { maxOutputTokens: 4096, supportsTemperature: true, temperatureRange: [0, 1], supportsTopP: true, supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3-haiku': { maxOutputTokens: 4096, supportsTemperature: true, temperatureRange: [0, 1], supportsTopP: true, supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-4-opus': { maxOutputTokens: 32768, supportsFrequencyPenalty: true, frequencyPenaltyRange: [0, 1], supportsPresencePenalty: true, presencePenaltyRange: [0, 1], supportsTopP: true, supportsTemperature: true, temperatureRange: [0, 1], supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-4-sonnet': { maxOutputTokens: 16384, supportsTopP: true, supportsTemperature: true, temperatureRange: [0, 1], supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3.7-sonnet': { maxOutputTokens: 8192, supportsTopP: true, supportsTemperature: true, temperatureRange: [0, 1], supportsPromptCacheMetrics: true, supportsContextUsage: true },
  'claude-3.5-haiku-extended': { maxOutputTokens: 8192, supportsTopP: true, supportsTemperature: true, temperatureRange: [0, 1] },

  // Google Gemini
  'gemini-2.0-flash': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, topPRange: [0, 1], supportsSeed: true },
  'gemini-2.0-flash-lite': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, topPRange: [0, 1] },
  'gemini-2.5-pro': { maxOutputTokens: 65536, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, topPRange: [0, 1], supportsReasoningControl: true, reasoningModes: ['basic', 'detailed'], supportsSeed: true },
  'gemini-1.5-pro': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, topPRange: [0, 1], supportsSeed: true },
  'gemini-1.5-flash': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, topPRange: [0, 1], supportsSeed: true },

  // DeepSeek
  'deepseek-v3': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'deepseek-r1': { maxOutputTokens: 8192, supportsTemperature: false, supportsTopP: false, supportsFrequencyPenalty: false, supportsPresencePenalty: false },
  'deepseek-v2.5': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'deepseek-chat': { maxOutputTokens: 8192, supportsTemperature: true, temperatureRange: [0, 2], supportsTopP: true, supportsFrequencyPenalty: true, supportsPresencePenalty: true },
  'deepseek-reasoner': { maxOutputTokens: 8192, supportsTemperature: false, supportsTopP: false, supportsFrequencyPenalty: false, supportsPresencePenalty: false },
};

/** Resolve capabilities for a model. Falls back to sensible defaults for unknown models. */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  const key = Object.keys(CAPABILITY_MAP).find((k) =>
    modelName.toLowerCase().includes(k.toLowerCase()),
  );

  if (key) {
    return { ...DEFAULT_CAPS, ...CAPABILITY_MAP[key] };
  }
  return { ...DEFAULT_CAPS };
}

/** Generation style presets. */
export type GenerationStyle = 'precise' | 'balanced' | 'natural' | 'creative' | 'custom';

export function styleDefaults(style: GenerationStyle): { temperature: number; topP: number } {
  switch (style) {
    case 'precise': return { temperature: 0.1, topP: 0.9 };
    case 'balanced': return { temperature: 0.5, topP: 0.95 };
    case 'natural': return { temperature: 0.8, topP: 0.95 };
    case 'creative': return { temperature: 1.2, topP: 0.95 };
    default: return { temperature: 0.8, topP: 0.95 };
  }
}

export const GENERATION_STYLES: { value: GenerationStyle; label: string; description: string }[] = [
  { value: 'precise', label: '精確', description: '低溫度，結構化輸出' },
  { value: 'balanced', label: '平衡', description: '中等變化，適合一般對話' },
  { value: 'natural', label: '自然', description: '偏暖，更接近日常說話' },
  { value: 'creative', label: '創意', description: '高溫度，多變且富想像力' },
  { value: 'custom', label: '自訂', description: '手動調整所有參數' },
];
