import type { ProviderConfig } from '@/types';
import { getProviderUsageLedger } from '@/features/apiUsage/ProviderUsageLedger';
import type { ProviderTransportKind } from '@/features/apiUsage/apiUsageTypes';

export type TestResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; unsupported: true; error?: string };

function classifyError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return '連線超時';
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed')) {
    return 'Base URL 無法連線';
  }
  if (msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('blocked')) {
    return 'CORS 或瀏覽器限制';
  }
  return `無法連線：${msg.slice(0, 80)}`;
}

async function testOpenAICompatible(provider: ProviderConfig): Promise<TestResult> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { Authorization: `Bearer ${provider.apiKey}` };
  const endpoint = provider.chatEndpoint.trim();
  const url = /^https?:\/\//i.test(endpoint)
    ? endpoint
    : `${baseUrl}/${(endpoint || 'chat/completions').replace(/^\/+/, '')}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 2,
        stream: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) return { success: true };
    if (res.status === 401 || res.status === 403) return { success: false, error: 'API Key 無效' };
    if (res.status === 404) return { success: false, error: 'Base URL、Chat Endpoint 或模型不存在' };
    const text = await res.text().catch(() => '');
    return { success: false, error: text ? `伺服器錯誤 (${res.status})：${text.slice(0, 60)}` : `伺服器錯誤 (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: classifyError(err) };
  }
}

async function testAnthropic(provider: ProviderConfig): Promise<TestResult> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  try {
    // Test via models endpoint (no model required)
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { success: true };
    if (res.status === 401 || res.status === 403) return { success: false, error: 'API Key 無效' };
    if (res.status === 404) return { success: false, error: '模型端點無回應' };
    const text = await res.text().catch(() => '');
    return { success: false, error: text ? `伺服器錯誤 (${res.status})：${text.slice(0, 60)}` : `伺服器錯誤 (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: classifyError(err) };
  }
}

async function testGemini(provider: ProviderConfig): Promise<TestResult> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: provider.apiKey ? { 'x-goog-api-key': provider.apiKey } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { success: true };
    if (res.status === 401 || res.status === 403) return { success: false, error: 'API Key 無效' };
    if (res.status === 404) return { success: false, error: '模型端點無回應' };
    return { success: false, error: `伺服器錯誤 (HTTP ${res.status})` };
  } catch (err) {
    return { success: false, error: classifyError(err) };
  }
}

async function testOllama(provider: ProviderConfig): Promise<TestResult> {
  const ollamaBase = provider.baseUrl.replace(/\/v1$/, '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json().catch(() => ({ models: [] }));
      const models: string[] = (json.models || []).map((model: { name?: string }) => model.name || '');
      if (provider.model && !models.some((model) => model === provider.model || model.startsWith(`${provider.model}:`))) {
        return { success: false, error: `找不到模型 ${provider.model}` };
      }
      return { success: true };
    }
    const text = await res.text().catch(() => '');
    return { success: false, error: `Ollama 無法連線：${text.slice(0, 60) || `HTTP ${res.status}`}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('refused') || msg.includes('ECONNREFUSED')) {
      return { success: false, error: 'Ollama 尚未執行，請確認 Ollama 是否已啟動' };
    }
    return { success: false, error: classifyError(err) };
  }
}

async function testCustom(provider: ProviderConfig): Promise<TestResult> {
  if (!provider.baseUrl && !provider.modelsEndpoint && !provider.chatEndpoint) {
    return { success: false, unsupported: true };
  }

  const urls: string[] = [];
  if (provider.modelsEndpoint) urls.push(provider.modelsEndpoint);
  if (provider.baseUrl) {
    const base = provider.baseUrl.replace(/\/+$/, '');
    urls.push(`${base}/models`);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { success: true };
      if (res.status === 401 || res.status === 403) return { success: false, error: 'API Key 無效' };
    } catch { /* try next */ }
  }

  if (provider.chatEndpoint || provider.baseUrl) {
    const endpoint = provider.chatEndpoint || `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok || res.status === 400) return { success: true };
      if (res.status === 401 || res.status === 403) return { success: false, error: 'API Key 無效' };
      return { success: false, error: `連線失敗 (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: classifyError(err) };
    }
  }

  return { success: false, unsupported: true };
}

export async function testProviderConnection(provider: ProviderConfig): Promise<TestResult> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let result: TestResult;
  switch (provider.type) {
    case 'openai':
    case 'openrouter':
    case 'groq':
    case 'siliconflow':
    case 'deepseek':
    case 'qwen':
    case 'glm':
    case 'minimax':
      result = await testOpenAICompatible(provider); break;
    case 'claude':
      result = await testAnthropic(provider); break;
    case 'gemini':
      result = await testGemini(provider); break;
    case 'ollama':
      result = await testOllama(provider); break;
    case 'custom':
      result = await testCustom(provider); break;
    default:
      result = { success: false, unsupported: true };
  }
  const transportKind: ProviderTransportKind = provider.type === 'claude' ? 'anthropic'
    : provider.type === 'gemini' ? 'gemini'
      : provider.type === 'custom' ? 'custom-http' : 'openai-compatible';
  try {
    await getProviderUsageLedger().record({
      id: crypto.randomUUID(), requestId, timestamp: startedAt, completedAt: Date.now(),
      providerConfigId: provider.id, providerType: provider.type, transportKind,
      model: provider.model, requestType: 'connection_test', streaming: false,
      usageProvenance: 'unavailable', latencyMs: Math.max(0, Date.now() - startedAt),
      status: result.success ? 'success' : 'error',
      ...(!result.success ? { errorCode: 'CONNECTION_TEST_FAILED' } : {}),
    });
  } catch {
    // Connection behavior must not depend on observability persistence.
  }
  return result;
}

export async function fetchProviderModels(provider: ProviderConfig): Promise<{ id: string; name: string }[] | null> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');

  try {
    switch (provider.type) {
      case 'openai':
      case 'deepseek':
      case 'openrouter':
      case 'groq':
      case 'siliconflow':
      case 'qwen':
      case 'glm':
      case 'minimax': {
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${provider.apiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return (json.data || []).map((m: any) => ({ id: m.id, name: m.id })).filter((m: any) => m.id);
      }

      case 'claude': {
        const res = await fetch(`${baseUrl}/models`, {
          headers: { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return (json.data || []).map((m: any) => ({ id: m.id, name: m.id })).filter((m: any) => m.id);
      }

      case 'gemini': {
        const res = await fetch(`${baseUrl}/models`, {
          headers: provider.apiKey ? { 'x-goog-api-key': provider.apiKey } : {},
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return (json.models || [])
          .map((m: any) => {
            const id = (m.name || '').replace(/^models\//, '');
            return id ? { id, name: m.displayName || id } : null;
          })
          .filter(Boolean);
      }

      case 'ollama': {
        const ollamaBase = baseUrl.replace(/\/v1$/, '');
        const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const json = await res.json();
        return (json.models || []).map((m: any) => ({ id: m.name, name: m.name })).filter((m: any) => m.id);
      }

      case 'custom': {
        const testUrls: string[] = [];
        if (provider.modelsEndpoint) testUrls.push(provider.modelsEndpoint);
        if (provider.baseUrl) testUrls.push(`${baseUrl}/models`);

        for (const url of testUrls) {
          try {
            const res = await fetch(url, {
              headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
              signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
              const json = await res.json();
              const items = json.data || json.models || [];
              return items.map((m: any) => ({ id: m.id || m.name, name: m.name || m.id || m.id })).filter((m: any) => m.id);
            }
          } catch { /* try next */ }
        }
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}
