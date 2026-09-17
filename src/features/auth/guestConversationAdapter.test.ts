import { beforeEach, describe, expect, it } from 'vitest';
import type { AIRequestConfig } from '@/ai/types';
import { createProvider } from '@/config/providers';
import { resolveProviderRequestConfig } from '@/ai/providerRuntime';
import {
  disableWebFallback,
  getCredentialStore,
  makeCredentialId,
  resetCredentialStore,
} from '@/ai/credentialStore';
import {
  GUEST_SYSTEM_INSTRUCTION,
  buildGuestConversationMessages,
  lockGuestRequestConfig,
} from './guestConversationAdapter';

const baseConfig: AIRequestConfig = {
  provider: 'openai',
  providerConfigId: 'canonical-provider',
  providerType: 'openai',
  model: 'test-model',
  apiKey: 'secret',
  baseUrl: 'https://example.invalid/v1',
  temperature: 0.7,
  maxTokens: 400,
  topP: 1,
  systemPrompt: 'AUTHENTICATED_PRIVATE_PROMPT',
  tools: [{ type: 'function', function: { name: 'private_tool', description: 'private', parameters: {} } }],
  telemetry: { conversationId: 'private-conversation' },
};

describe('GuestConversationAdapter privacy boundary', () => {
  it('builds context from the dedicated instruction and ephemeral guest messages only', () => {
    const messages = buildGuestConversationMessages([
      { id: '1', role: 'guest', content: '你好' },
      { id: '2', role: 'rune', content: '我在。' },
    ]);

    expect(messages).toEqual([
      { role: 'system', content: GUEST_SYSTEM_INSTRUCTION },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '我在。' },
    ]);
    expect(JSON.stringify(messages)).not.toContain('AUTHENTICATED_PRIVATE_PROMPT');
  });

  it('forces tools, telemetry, and local usage persistence off', () => {
    const config = lockGuestRequestConfig(baseConfig);
    expect(config.systemPrompt).toBe(GUEST_SYSTEM_INSTRUCTION);
    expect(config.tools).toBeUndefined();
    expect(config.telemetry).toBeUndefined();
    expect(config.persistUsage).toBe(false);
  });

  it('bounds context to the current ephemeral session window', () => {
    const source = Array.from({ length: 24 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? 'guest' as const : 'rune' as const,
      content: `message-${index}`,
    }));
    const messages = buildGuestConversationMessages(source, 4);
    expect(messages).toHaveLength(5);
    expect(messages[1]?.content).toBe('message-20');
    expect(messages[4]?.content).toBe('message-23');
  });
});

describe('provider availability resolver', () => {
  beforeEach(() => {
    disableWebFallback();
    resetCredentialStore();
    (globalThis as { __lunartide_cred_memory?: Map<string, string> }).__lunartide_cred_memory?.clear();
  });

  function guestProvider(overrides: Partial<ReturnType<typeof createProvider>> = {}) {
    return {
      ...createProvider('openai'),
      baseUrl: 'https://example.invalid/v1',
      model: 'test-model',
      credentialId: makeCredentialId('guest-provider'),
      hasCredential: true,
      ...overrides,
    };
  }

  it('carries the canonical credential store secret into the resolved request config', async () => {
    const provider = guestProvider();
    const store = await getCredentialStore();
    await store.setCredential(provider.credentialId!, 'sk-stored-secret');

    const config = await resolveProviderRequestConfig(provider, GUEST_SYSTEM_INSTRUCTION);

    expect(config.apiKey).toBe('sk-stored-secret');
    expect(config.systemPrompt).toBe(GUEST_SYSTEM_INSTRUCTION);
    expect(config.providerConfigId).toBe(provider.id);
    const raw = config as unknown as Record<string, unknown>;
    expect(raw.tools).toBeUndefined();
    expect(raw.telemetry).toBeUndefined();
  });

  it('prefers an inline provider key and never invents a credential', async () => {
    const inline = await resolveProviderRequestConfig(guestProvider({ apiKey: 'sk-inline' }), 'sys');
    expect(inline.apiKey).toBe('sk-inline');

    const missing = await resolveProviderRequestConfig(guestProvider(), 'sys');
    expect(missing.apiKey).toBe('');
  });

  it('keeps the resolver free of authenticated context', async () => {
    const config = await resolveProviderRequestConfig(guestProvider({ apiKey: 'sk-inline' }), GUEST_SYSTEM_INSTRUCTION);
    expect(Object.keys(config).sort()).toEqual([
      'apiKey',
      'apiKeyOptional',
      'baseUrl',
      'chatEndpoint',
      'maxTokens',
      'model',
      'provider',
      'providerConfigId',
      'providerType',
      'streamingEnabled',
      'systemPrompt',
      'temperature',
      'topP',
    ]);
  });
});
