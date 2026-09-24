import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_LOCAL_STORAGE_KEYS, cacheRegistry, type CacheCleaner } from './cacheRegistry';
import { clearRegisteredCaches } from './cacheService';
import { createConversationState, useChatRuntimeStore } from '@/store/useChatRuntimeStore';

describe('storage cache safety', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatRuntimeStore.setState({ states: {} });
  });

  it('clears only registered local cache keys and preserves application data', async () => {
    const protectedPayload = JSON.stringify({ messages: [{ id: 'm1' }], memoryEntries: [{ id: 'mem1' }], tasks: [{ id: 't1' }], providers: [{ id: 'p1' }] });
    localStorage.setItem('lunartide_data', protectedPayload);
    localStorage.setItem(CACHE_LOCAL_STORAGE_KEYS.weather[0], 'weather');
    localStorage.setItem(CACHE_LOCAL_STORAGE_KEYS['model-metadata'][0], 'models');
    const clearSpy = vi.spyOn(localStorage, 'clear');

    await clearRegisteredCaches(['weather', 'model-metadata'], undefined, cacheRegistry);

    expect(localStorage.getItem('lunartide_data')).toBe(protectedPayload);
    expect(localStorage.getItem(CACHE_LOCAL_STORAGE_KEYS.weather[0])).toBeNull();
    expect(localStorage.getItem(CACHE_LOCAL_STORAGE_KEYS['model-metadata'][0])).toBeNull();
    expect(clearSpy).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('continues when one cleaner fails', async () => {
    const ok = vi.fn(async () => 24);
    const registry: CacheCleaner[] = [
      { id: 'weather', label: '天气', description: '', safeToClear: true, estimateSize: async () => ({ bytes: 10, approximate: false }), clear: async () => { throw new Error('locked'); } },
      { id: 'diagnostics', label: '诊断', description: '', safeToClear: true, estimateSize: async () => ({ bytes: 24, approximate: false }), clear: ok },
    ];
    const result = await clearRegisteredCaches(['weather', 'diagnostics'], undefined, registry);
    expect(ok).toHaveBeenCalledOnce();
    expect(result.clearedBytes).toBe(24);
    expect(result.errors).toHaveLength(1);
  });

  it('broadcasts cache invalidation without forcing a reload', async () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    vi.stubGlobal('BroadcastChannel', class { postMessage = postMessage; close = close; });
    await clearRegisteredCaches([], undefined, []);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'cache-cleared' }));
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

describe('chat session execution cache', () => {
  it('preserves summaries, long-term memories and settings', () => {
    const state = createConversationState('c1');
    state.contextState.summaryVersions = [{ id: 's1', content: 'summary', version: 1, createdAt: 1, updatedAt: 1, sourceMessageRange: { start: 0, end: 1 } }];
    state.contextState.longTermMemories = [{ id: 'l1', content: 'memory', pinned: false, paused: false, sourceMessageIds: [], createdAt: 1, updatedAt: 1 }];
    state.sessionUsage.requestCount = 3;
    state.recentRequests = [{ id: 'r1', provider: 'test', model: 'test', inputTokens: 1, outputTokens: 1, latencyMs: 1, estimatedCost: 0, usedSummary: true, rawRoundsUsed: 1, longTermMemoriesUsed: 1, timestamp: 1 }];
    useChatRuntimeStore.setState({ states: { c1: state } });

    useChatRuntimeStore.getState().clearSessionExecutionCache('c1');
    const next = useChatRuntimeStore.getState().states.c1;
    expect(next.contextState.summaryVersions).toEqual(state.contextState.summaryVersions);
    expect(next.contextState.longTermMemories).toEqual(state.contextState.longTermMemories);
    expect(next.settings).toEqual(state.settings);
    expect(next.sessionUsage.requestCount).toBe(0);
    expect(next.recentRequests).toEqual([]);
  });
});
