import type { AIProvider } from '@/ai/types';
import type { ProviderConfig, ProviderType, AiRolesMap, AiRole } from '@/types';
import { getCredentialStore, makeCredentialId } from './credentialStore';

export interface ProviderRuntimeState {
  provider: ProviderConfig | null;
  configured: boolean;
  reason: 'ready' | 'disabled' | 'missing-base-url' | 'missing-model' | 'missing-api-key' | 'none';
}

function mapProviderType(type: ProviderType): AIProvider {
  if (type === 'claude') return 'anthropic';
  if (type === 'gemini') return 'google';
  if (type === 'deepseek') return 'deepseek';
  if (type === 'openai') return 'openai';
  return 'custom';
}

export function providerRequiresApiKey(provider: ProviderConfig): boolean {
  return provider.type !== 'ollama';
}

export async function resolveProviderApiKey(provider: ProviderConfig): Promise<string> {
  if (!providerRequiresApiKey(provider)) return '';
  if (provider.apiKey?.trim()) return provider.apiKey.trim();
  const credId = provider.credentialId || makeCredentialId(provider.id);
  const store = await getCredentialStore();
  const stored = await store.getCredential(credId);
  return stored || '';
}

export function resolveActiveProvider(providers: ProviderConfig[]): ProviderRuntimeState {
  const provider = providers.find((item) => item.isDefault && item.enabled)
    || providers.find((item) => item.enabled)
    || null;

  if (!provider) return { provider: null, configured: false, reason: 'none' };
  if (!provider.enabled) return { provider, configured: false, reason: 'disabled' };
  if (!provider.baseUrl.trim()) return { provider, configured: false, reason: 'missing-base-url' };
  if (!provider.model.trim()) return { provider, configured: false, reason: 'missing-model' };
  if (providerRequiresApiKey(provider) && !provider.apiKey.trim() && !provider.hasCredential) {
    return { provider, configured: false, reason: 'missing-api-key' };
  }
  return { provider, configured: true, reason: 'ready' };
}

export function resolveRoleProvider(
  role: AiRole,
  aiRoles: AiRolesMap,
  providers: ProviderConfig[],
): ProviderRuntimeState {
  const roleConfig = aiRoles?.[role];
  if (!roleConfig?.providerId) return resolveActiveProvider(providers);

  const provider = providers.find((p) => p.id === roleConfig.providerId && p.enabled);
  if (!provider) return resolveActiveProvider(providers);

  const virtual: ProviderConfig = {
    ...provider,
    model: roleConfig.model || provider.model,
    temperature: roleConfig.temperature ?? provider.temperature,
    maxTokens: roleConfig.maxTokens ?? provider.maxTokens,
    contextMessageLimit: roleConfig.contextWindow ?? provider.contextMessageLimit,
    streamingEnabled: roleConfig.streaming ?? provider.streamingEnabled,
    thinkingUiEnabled: roleConfig.thinkingUi ?? provider.thinkingUiEnabled,
    updatedAt: Date.now(),
  };
  return { provider: virtual, configured: true, reason: 'ready' };
}

export function resolveChatProvider(
  aiRoles: AiRolesMap,
  providers: ProviderConfig[],
): ProviderRuntimeState {
  return resolveRoleProvider('chat', aiRoles, providers);
}

export function resolveVisionProvider(
  aiRoles: AiRolesMap,
  providers: ProviderConfig[],
): ProviderRuntimeState {
  return resolveRoleProvider('vision', aiRoles, providers);
}

export function createProviderRequestConfig(provider: ProviderConfig, systemPrompt: string) {
  return {
    provider: mapProviderType(provider.type),
    providerConfigId: provider.id,
    providerType: provider.type,
    model: provider.model.trim(),
    apiKey: provider.apiKey.trim(),
    baseUrl: provider.baseUrl.trim(),
    temperature: provider.temperature,
    maxTokens: provider.maxTokens,
    topP: 1,
    systemPrompt,
    streamingEnabled: provider.streamingEnabled,
    chatEndpoint: provider.chatEndpoint.trim(),
    apiKeyOptional: !providerRequiresApiKey(provider),
  };
}

/**
 * Canonical credential-aware request-config resolver.
 *
 * Every AI request path builds its config through this seam: the canonical
 * CredentialStore secret resolved by `resolveProviderApiKey` becomes
 * `AIRequestConfig.apiKey`, while the provider record keeps `apiKey: ''`.
 */
export async function resolveProviderRequestConfig(provider: ProviderConfig, systemPrompt: string) {
  const apiKey = await resolveProviderApiKey(provider);
  return { ...createProviderRequestConfig(provider, systemPrompt), apiKey };
}
