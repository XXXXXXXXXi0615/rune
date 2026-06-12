import type { ProviderConfig, ProviderType } from '@/types';

export const LS_KEY = 'lunartide_providers_v1';

export const PROVIDER_DEFAULTS: Record<ProviderType, { label: string; baseUrl: string }> = {
  openai:     { label: 'OpenAI Compatible', baseUrl: 'https://api.openai.com/v1' },
  claude:     { label: 'Claude',           baseUrl: '' },
  gemini:     { label: 'Gemini',           baseUrl: '' },
  deepseek:   { label: 'DeepSeek',         baseUrl: 'https://api.deepseek.com/v1' },
  openrouter: { label: 'OpenRouter',       baseUrl: 'https://openrouter.ai/api/v1' },
  ollama:     { label: 'Ollama',           baseUrl: 'http://127.0.0.1:11434/v1' },
  custom:     { label: 'Custom',           baseUrl: '' },
};

export const PROVIDER_TYPES: ProviderType[] = [
  'openai', 'claude', 'gemini', 'deepseek', 'openrouter', 'ollama', 'custom',
];

export function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* corrupt */ }
  return [];
}

export function saveProviders(providers: ProviderConfig[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(providers)); } catch { /* quota */ }
}

export function createProvider(type: ProviderType, name?: string): ProviderConfig {
  const def = PROVIDER_DEFAULTS[type];
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name || def.label,
    type,
    baseUrl: def.baseUrl,
    apiKey: '',
    model: '',
    enabled: false,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}
