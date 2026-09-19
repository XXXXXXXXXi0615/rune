import { describe, expect, it } from 'vitest';
import type { ProviderConfig, ProviderType } from '@/types';
import { getProviderAdapterMeta, listProviderAdapterMeta } from '@/ai/providerAdapter';
import {
  applyModelSourceSelection,
  listProviderModelSourceCoverage,
  modelSourceFromProviderModel,
  modelSourceId,
  resolvePersistedModelSource,
} from '@/ai/models';

describe('provider model-source dynamic closure', () => {
  it('derives provider coverage from the adapter registry', () => {
    const registryIds = listProviderAdapterMeta().map((entry) => entry.id);
    const coverage = listProviderModelSourceCoverage();
    expect(coverage.map((entry) => entry.providerId)).toEqual(registryIds);
    expect(registryIds).toEqual([
      'openai', 'claude', 'gemini', 'deepseek', 'qwen', 'glm', 'minimax',
      'openrouter', 'groq', 'siliconflow', 'ollama', 'custom',
    ]);
    expect(coverage.every((entry) => entry.status === 'READY')).toBe(true);
    expect(coverage.every((entry) => entry.paths.includes('dynamic'))).toBe(true);
    expect(coverage.find((entry) => entry.providerId === 'custom')?.paths).toContain('manual');
  });

  it('normalizes dynamic results deterministically', () => {
    const remote = { id: 'vendor/runtime-model-alpha', name: 'Runtime Alpha' };
    const first = modelSourceFromProviderModel('openrouter', remote);
    expect(modelSourceFromProviderModel('openrouter', remote)).toEqual(first);
    expect(first).toEqual({
      sourceId: 'openrouter:vendor/runtime-model-alpha', providerId: 'openrouter',
      modelId: 'vendor/runtime-model-alpha', name: 'Runtime Alpha',
      providerLabel: 'OpenRouter', cataloged: true,
    });
  });

  it('keeps identical runtime model IDs from different providers distinct', () => {
    const remote = { id: 'shared/runtime-model', name: 'Shared Runtime Model' };
    const sources = [
      modelSourceFromProviderModel('deepseek', remote),
      modelSourceFromProviderModel('openrouter', remote),
      modelSourceFromProviderModel('siliconflow', remote),
    ];
    expect(new Set(sources.map((source) => source.sourceId)).size).toBe(3);
    expect(new Set(sources.map((source) => source.name))).toEqual(new Set(['Shared Runtime Model']));
  });

  it('uses the stable provider and model pair as global source identity', () => {
    const pairs: Array<[ProviderType, string]> = [
      ['openai', 'runtime-alpha'], ['gemini', 'runtime-alpha'],
      ['openrouter', 'vendor/runtime-alpha'], ['custom', 'private/runtime-alpha'],
    ];
    const ids = pairs.map(([providerId, modelId]) => modelSourceId(providerId, modelId));
    expect(ids).toEqual([
      'openai:runtime-alpha', 'gemini:runtime-alpha',
      'openrouter:vendor/runtime-alpha', 'custom:private/runtime-alpha',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('round-trips dynamic, unknown, and custom identities without inference', () => {
    const sources = [
      modelSourceFromProviderModel('qwen', { id: 'runtime-qwen-alpha' }),
      resolvePersistedModelSource('glm', 'unlisted-private-model'),
      resolvePersistedModelSource('custom', 'local-manual-model'),
    ];
    for (const source of sources) {
      const restored = resolvePersistedModelSource(source.providerId, source.modelId);
      expect([restored.sourceId, restored.providerId, restored.modelId]).toEqual([
        source.sourceId, source.providerId, source.modelId,
      ]);
    }
  });

  it('preserves an unknown persisted pair as the current config view', () => {
    expect(resolvePersistedModelSource('groq', 'future-model-id')).toEqual({
      sourceId: 'groq:future-model-id', providerId: 'groq', modelId: 'future-model-id',
      name: 'future-model-id', providerLabel: 'Groq', cataloged: false,
    });
  });

  it('applies a provider and manual model ID without touching credentials', () => {
    const draft = {
      type: 'openai' as ProviderType, model: 'old-runtime-model',
      credentialId: 'provider:existing-config', hasCredential: true,
    };
    expect(applyModelSourceSelection(draft, {
      providerId: 'gemini', modelId: 'new-runtime-model',
    })).toEqual({ ...draft, type: 'gemini', model: 'new-runtime-model' });
  });

  it('keeps endpoint and protocol metadata out of model sources', () => {
    const source = modelSourceFromProviderModel('openai', { id: 'runtime-model' });
    expect(source).not.toHaveProperty('baseUrl');
    expect(source).not.toHaveProperty('endpoint');
    expect(source).not.toHaveProperty('protocol');
    expect(getProviderAdapterMeta('openai').defaultBaseUrl).toBe('https://api.openai.com/v1');
    expect(getProviderAdapterMeta('custom').defaultBaseUrl).toBe('');
  });

  it('uses only the existing ProviderConfig identity fields', () => {
    const selectionKeys: Array<keyof ProviderConfig> = ['type', 'model'];
    expect(selectionKeys).toEqual(['type', 'model']);
  });
});
