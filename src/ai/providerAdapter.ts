import type { ProviderType } from '@/types';

export type ProviderConnectionState =
  | 'idle'
  | 'testing'
  | 'connected'
  | 'unauthorized'
  | 'model_not_found'
  | 'endpoint_unreachable'
  | 'timeout'
  | 'rate_limited'
  | 'unknown';

export interface ProviderAdapterMeta {
  id: ProviderType;
  displayName: string;
  defaultBaseUrl: string;
  apiKeyPlaceholder: string;
  apiKeyHelpText: string;
  supportsCustomBaseUrl: boolean;
  chatEndpointPath: string;
}

const adapterMeta: ProviderAdapterMeta[] = [
  {
    id: 'openai',
    displayName: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpText: '在 platform.openai.com/api-keys 建立 API Key',
    supportsCustomBaseUrl: true,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'claude',
    displayName: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHelpText: '在 console.anthropic.com 建立 API Key',
    supportsCustomBaseUrl: true,
    chatEndpointPath: '/messages',
  },
  {
    id: 'gemini',
    displayName: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHelpText: '在 aistudio.google.com 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '',
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpText: '在 platform.deepseek.com 建立 API Key',
    supportsCustomBaseUrl: true,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'qwen',
    displayName: 'Qwen',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpText: '在 dashscope.aliyun.com 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'glm',
    displayName: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyPlaceholder: '...',
    apiKeyHelpText: '在 open.bigmodel.cn 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.io/v1',
    apiKeyPlaceholder: '...',
    apiKeyHelpText: '在 minimax.io 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyHelpText: '在 openrouter.ai/keys 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...',
    apiKeyHelpText: '在 console.groq.com/keys 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'siliconflow',
    displayName: 'SiliconFlow',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpText: '在 siliconflow.cn 建立 API Key',
    supportsCustomBaseUrl: false,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    apiKeyPlaceholder: '',
    apiKeyHelpText: '本機 Ollama 不需要 API Key',
    supportsCustomBaseUrl: true,
    chatEndpointPath: '/chat/completions',
  },
  {
    id: 'custom',
    displayName: '自訂',
    defaultBaseUrl: '',
    apiKeyPlaceholder: '',
    apiKeyHelpText: '',
    supportsCustomBaseUrl: true,
    chatEndpointPath: '/chat/completions',
  },
];

const metaByProvider: Map<ProviderType, ProviderAdapterMeta> = new Map(
  adapterMeta.map((m) => [m.id, m]),
);

export function getProviderAdapterMeta(type: ProviderType): ProviderAdapterMeta {
  return (
    metaByProvider.get(type) ?? {
      id: type,
      displayName: type,
      defaultBaseUrl: '',
      apiKeyPlaceholder: '',
      apiKeyHelpText: '',
      supportsCustomBaseUrl: true,
      chatEndpointPath: '/chat/completions',
    }
  );
}

/** Read-only adapter registry view for coverage audits and provider-scoped UI. */
export function listProviderAdapterMeta(): ProviderAdapterMeta[] {
  return adapterMeta.map((meta) => ({ ...meta }));
}

export function normalizeConnectionState(
  errorMessage?: string,
): ProviderConnectionState {
  if (!errorMessage) return 'idle';
  const lower = errorMessage.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('forbidden'))
    return 'unauthorized';
  if (lower.includes('404') || lower.includes('model not found') || lower.includes('not found'))
    return 'model_not_found';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnrefused'))
    return 'timeout';
  if (lower.includes('429') || lower.includes('rate') || lower.includes('too many'))
    return 'rate_limited';
  if (lower.includes('econn') || lower.includes('enotfound') || lower.includes('unreachable'))
    return 'endpoint_unreachable';
  return 'unknown';
}

export function connectionStateLabel(state: ProviderConnectionState): string {
  switch (state) {
    case 'idle': return '尚未測試';
    case 'testing': return '測試中…';
    case 'connected': return '已連接';
    case 'unauthorized': return 'API Key 無效';
    case 'model_not_found': return '模型不存在';
    case 'endpoint_unreachable': return '無法連線至端點';
    case 'timeout': return '連線逾時';
    case 'rate_limited': return '請求頻率限制';
    case 'unknown': return '連線失敗';
  }
}
