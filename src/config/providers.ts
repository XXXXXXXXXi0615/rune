import type { ProviderConfig, ProviderType } from '@/types';

export const LS_KEY = 'lunartide_providers_v1';

export const PROVIDER_DEFAULTS: Record<ProviderType, { label: string; baseUrl: string }> = {
  openai:      { label: 'OpenAI',             baseUrl: 'https://api.openai.com/v1' },
  claude:      { label: 'Anthropic',          baseUrl: 'https://api.anthropic.com/v1' },
  gemini:      { label: 'Gemini',             baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  deepseek:    { label: 'DeepSeek',           baseUrl: 'https://api.deepseek.com/v1' },
  qwen:        { label: 'Qwen',               baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  glm:         { label: 'GLM',                baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  minimax:     { label: 'MiniMax',            baseUrl: 'https://api.minimax.io/v1' },
  openrouter:  { label: 'OpenRouter',         baseUrl: 'https://openrouter.ai/api/v1' },
  groq:        { label: 'Groq',               baseUrl: 'https://api.groq.com/openai/v1' },
  siliconflow: { label: 'SiliconFlow',        baseUrl: 'https://api.siliconflow.cn/v1' },
  ollama:      { label: 'Ollama',             baseUrl: 'http://127.0.0.1:11434/v1' },
  custom:      { label: 'Custom',             baseUrl: '' },
};

export const PROVIDER_TYPES: ProviderType[] = [
  'openai', 'claude', 'gemini', 'deepseek', 'qwen', 'glm', 'minimax', 'openrouter', 'siliconflow', 'ollama',
];

export const AI_ROLE_LABELS: Record<string, string> = {
  chat: 'Chat Model',
  vision: 'Vision Model',
  embedding: 'Embedding Model',
  speech: 'Speech Model',
};

export function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizeProvider);
    }
  } catch { /* corrupt */ }
  return [];
}

function normalizeProvider(p: Partial<ProviderConfig>): ProviderConfig {
  const now = Date.now();
  return {
    id: p.id || crypto.randomUUID(),
    name: p.name || 'Provider',
    type: p.type || 'openai',
    baseUrl: p.baseUrl || '',
    apiKey: p.apiKey || '',
    model: p.model || '',
    enabled: p.enabled !== false,
    isDefault: p.isDefault || false,
    streamingEnabled: p.streamingEnabled ?? true,
    thinkingUiEnabled: p.thinkingUiEnabled ?? true,
    temperature: p.temperature ?? 0.7,
    maxTokens: p.maxTokens ?? 4096,
    contextMessageLimit: p.contextMessageLimit ?? 20,
    modelsEndpoint: p.modelsEndpoint || '',
    chatEndpoint: p.chatEndpoint || '',
    connectionStatus: p.connectionStatus || 'untested',
    lastTestedAt: p.lastTestedAt,
    lastTestLatencyMs: p.lastTestLatencyMs,
    lastConnectionError: p.lastConnectionError,
    credentialId: p.credentialId,
    hasCredential: p.hasCredential ?? false,
    credentialUpdatedAt: p.credentialUpdatedAt,
    createdAt: p.createdAt || now,
    updatedAt: p.updatedAt || now,
  };
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
    enabled: true,
    isDefault: false,
    streamingEnabled: true,
    thinkingUiEnabled: true,
    temperature: 0.7,
    maxTokens: 4096,
    contextMessageLimit: 20,
    modelsEndpoint: '',
    chatEndpoint: '',
    connectionStatus: 'untested',
    credentialId: undefined,
    hasCredential: false,
    credentialUpdatedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}
