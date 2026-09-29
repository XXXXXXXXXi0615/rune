/* ═══════════════════════════════════════════════
   cacheScanner.test.ts — unit tests for scanner/cleaner/registry
   ═══════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetRegistryState, _setProviders, scanSafeCache, cleanSafeCache, isScanInProgress, isCleanInProgress } from './cacheRegistry';
import type { CacheProvider, CacheScanCategory, CacheScanItem, CacheCategoryId } from './types';
import { scanResultToBreakdown, formatBytes } from './cacheMaintenanceMock';

/* ── Helpers ── */

function makeCache(name: string, requests: { url: string; contentLength?: number }[]): Cache {
  const map = new Map<string, { url: string; contentLength?: number }>();
  for (const r of requests) map.set(r.url, r);

  return {
    match: vi.fn(async (req: Request | string) => {
      const url = typeof req === 'string' ? req : req.url;
      const found = map.get(url);
      if (!found) return undefined;
      const headers = new Headers();
      if (found.contentLength) headers.set('Content-Length', String(found.contentLength));
      return new Response('x', { headers });
    }),
    keys: vi.fn(async () => requests.map((r) => new Request(r.url))),
    add: vi.fn(),
    addAll: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    matchAll: vi.fn(),
  } as unknown as Cache;
}

function fakeStorageGetAll(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) out[k] = localStorage.getItem(k) || '';
  }
  return out;
}

/* ── Shared mock provider for registry tests ── */

const mockProvider: CacheProvider = {
  id: 'stale_cache_storage',
  scan: vi.fn(async (_signal: AbortSignal): Promise<CacheScanCategory> => ({
    categoryId: 'stale_cache_storage' as CacheCategoryId,
    label: 'test',
    items: [{ id: 't1', categoryId: 'stale_cache_storage' as CacheCategoryId, label: 'x', sizeBytes: 100, count: 1, safeToDelete: true as const, source: 'test' }],
    totalBytes: 100,
    totalCount: 1,
  })),
  clean: vi.fn(async (_items: CacheScanItem[], _signal: AbortSignal) => ({ deleted: 1, releasedBytes: 100, failures: [] })),
};

/* ═══════════════════════════════════════════════
   Registry tests
   ═══════════════════════════════════════════════ */

describe('cacheRegistry', () => {
  beforeEach(() => {
    _resetRegistryState();
  });

  it('scan returns empty result when no providers registered', async () => {
    const ac = new AbortController();
    const result = await scanSafeCache(ac.signal);
    expect(result.totalBytes).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.categories).toEqual([]);
  });

  it('scan aggregates results from providers', async () => {
    _setProviders([mockProvider]);
    const ac = new AbortController();
    const result = await scanSafeCache(ac.signal);
    expect(result.totalBytes).toBe(100);
    expect(result.totalCount).toBe(1);
    expect(result.categories).toHaveLength(1);
  });

  it('prevents duplicate scans', async () => {
    _setProviders([mockProvider]);
    const ac = new AbortController();
    const p1 = scanSafeCache(ac.signal);
    await expect(scanSafeCache(ac.signal)).rejects.toThrow('already in progress');
    await p1;
  });

  it('prevents duplicate cleans', async () => {
    _setProviders([mockProvider]);
    const ac = new AbortController();
    const scanResult = await scanSafeCache(ac.signal);
    const p1 = cleanSafeCache(scanResult.categories, ac.signal);
    await expect(cleanSafeCache(scanResult.categories, ac.signal)).rejects.toThrow('already in progress');
    await p1;
  });

  it('aborts scan on signal', async () => {
    const provider: CacheProvider = {
      id: 'stale_cache_storage',
      scan: vi.fn(async (signal: AbortSignal): Promise<CacheScanCategory> => {
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
        return { categoryId: 'stale_cache_storage' as CacheCategoryId, label: 'x', items: [], totalBytes: 0, totalCount: 0 };
      }),
      clean: vi.fn(),
    };
    _setProviders([provider]);
    const ac = new AbortController();
    const promise = scanSafeCache(ac.signal);
    ac.abort();
    await expect(promise).rejects.toThrow('Aborted');
    expect(isScanInProgress()).toBe(false);
  });

  it('clean returns correct releasedBytes', async () => {
    _setProviders([mockProvider]);
    const ac = new AbortController();
    const scanResult = await scanSafeCache(ac.signal);
    const cleanResult = await cleanSafeCache(scanResult.categories, ac.signal);
    expect(cleanResult.releasedBytes).toBe(100);
    expect(cleanResult.deletedCount).toBe(1);
    expect(cleanResult.failedCount).toBe(0);
  });

  it('handles partial failure correctly', async () => {
    const failProvider: CacheProvider = {
      id: 'expired_metadata',
      scan: vi.fn(async () => ({
        categoryId: 'expired_metadata' as CacheCategoryId,
        label: 'meta',
        items: [
          { id: 'm1', categoryId: 'expired_metadata' as CacheCategoryId, label: 'ok', sizeBytes: 50, count: 1, safeToDelete: true as const, source: 'test' },
          { id: 'm2', categoryId: 'expired_metadata' as CacheCategoryId, label: 'fail', sizeBytes: 30, count: 1, safeToDelete: true as const, source: 'test' },
        ],
        totalBytes: 80,
        totalCount: 2,
      })),
      clean: vi.fn(async (_items: CacheScanItem[], _signal: AbortSignal) => ({
        deleted: 1,
        releasedBytes: 50,
        failures: [{ itemId: 'm2', categoryId: 'expired_metadata' as CacheCategoryId, reason: 'revalidation failed' }],
      })),
    };
    _setProviders([failProvider]);
    const ac = new AbortController();
    const scanResult = await scanSafeCache(ac.signal);
    const cleanResult = await cleanSafeCache(scanResult.categories, ac.signal);
    expect(cleanResult.releasedBytes).toBe(50);
    expect(cleanResult.failedCount).toBe(1);
    expect(cleanResult.failures[0].itemId).toBe('m2');
  });
});

/* ═══════════════════════════════════════════════
   Real scanner integration tests (with mocked browser APIs)
   ═══════════════════════════════════════════════ */

import { staleCacheProvider, expiredMetadataProvider, temporaryPreviewsProvider, registerAllCacheProviders } from './cacheScanner';

describe('staleCacheProvider', () => {
  beforeEach(() => {
    _resetRegistryState();
  });

  it('active cache is NOT included', async () => {
    const cache = makeCache('lunartide-v3', [{ url: 'http://localhost/', contentLength: 500 }]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => ['lunartide-v3']),
      open: vi.fn(async () => cache),
      delete: vi.fn(),
    };
    const ac = new AbortController();
    const result = await staleCacheProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('stale Lunartide cache IS included', async () => {
    const cache = makeCache('lunartide-old-v1', [{ url: 'http://localhost/old', contentLength: 200 }]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => ['lunartide-old-v1']),
      open: vi.fn(async () => cache),
      delete: vi.fn(),
    };
    const ac = new AbortController();
    const result = await staleCacheProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(200);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('cache:lunartide-old-v1');
  });

  it('non-Lunartide cache prefix NOT included', async () => {
    (globalThis as any).caches = {
      keys: vi.fn(async () => ['google-analytics-v1', 'vite-prefetch']),
      open: vi.fn(),
      delete: vi.fn(),
    };
    const ac = new AbortController();
    const result = await staleCacheProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('clean revalidates before deleting', async () => {
    const cache = makeCache('lunartide-old-v1', [{ url: 'http://localhost/old', contentLength: 100 }]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => ['lunartide-old-v1']),
      open: vi.fn(async () => cache),
      delete: vi.fn(async () => true),
    };
    const items: CacheScanItem[] = [{
      id: 'cache:lunartide-old-v1',
      categoryId: 'stale_cache_storage' as CacheCategoryId,
      label: 'lunartide-old-v1',
      sizeBytes: 100,
      count: 1,
      safeToDelete: true as const,
      source: 'test',
    }];
    const ac = new AbortController();
    const result = await staleCacheProvider.clean(items, ac.signal);
    expect(result.releasedBytes).toBe(100);
    expect(result.deleted).toBe(1);
  });
});

describe('expiredMetadataProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetRegistryState();
  });

  it('expired metadata IS included', async () => {
    const expired = Date.now() - 10000;
    localStorage.setItem('lunartide_ai_cache_xyz', JSON.stringify({
      owner: 'lunartide-cache',
      expiresAt: expired,
      cacheType: 'ai_response',
      schemaVersion: 1,
      sizeBytes: 500,
    }));
    const ac = new AbortController();
    const result = await expiredMetadataProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(500);
    expect(result.items).toHaveLength(1);
  });

  it('unexpired metadata NOT included', async () => {
    const future = Date.now() + 10000;
    localStorage.setItem('lunartide_ai_cache_xyz', JSON.stringify({
      owner: 'lunartide-cache',
      expiresAt: future,
      cacheType: 'ai_response',
      schemaVersion: 1,
    }));
    const ac = new AbortController();
    const result = await expiredMetadataProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });

  it('no ownership marker NOT included', async () => {
    localStorage.setItem('lunartide_ai_cache_xyz', JSON.stringify({
      expiresAt: Date.now() - 10000,
      cacheType: 'ai_response',
      schemaVersion: 1,
    }));
    const ac = new AbortController();
    const result = await expiredMetadataProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });

  it('no expiresAt NOT included', async () => {
    localStorage.setItem('lunartide_ai_cache_xyz', JSON.stringify({
      owner: 'lunartide-cache',
      cacheType: 'ai_response',
      schemaVersion: 1,
    }));
    const ac = new AbortController();
    const result = await expiredMetadataProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });

  it('no schemaVersion NOT included', async () => {
    localStorage.setItem('lunartide_ai_cache_xyz', JSON.stringify({
      owner: 'lunartide-cache',
      expiresAt: Date.now() - 10000,
      cacheType: 'ai_response',
    }));
    const ac = new AbortController();
    const result = await expiredMetadataProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });
});

describe('temporaryPreviewsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetRegistryState();
  });

  it('expired temporary preview IS included', async () => {
    localStorage.setItem('lunartide_temp_preview_img1', JSON.stringify({
      owner: 'lunartide-cache',
      temporary: true,
      expiresAt: Date.now() - 10000,
      sizeBytes: 300,
    }));
    const ac = new AbortController();
    const result = await temporaryPreviewsProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(300);
    expect(result.items).toHaveLength(1);
  });

  it('non-expired temporary preview NOT included', async () => {
    localStorage.setItem('lunartide_temp_preview_img1', JSON.stringify({
      owner: 'lunartide-cache',
      temporary: true,
      expiresAt: Date.now() + 10000,
    }));
    const ac = new AbortController();
    const result = await temporaryPreviewsProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });

  it('submitted preview NOT included', async () => {
    localStorage.setItem('lunartide_temp_preview_img1', JSON.stringify({
      owner: 'lunartide-cache',
      temporary: true,
      submitted: true,
      expiresAt: Date.now() - 10000,
    }));
    const ac = new AbortController();
    const result = await temporaryPreviewsProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });

  it('no temporary flag NOT included', async () => {
    localStorage.setItem('lunartide_temp_preview_img1', JSON.stringify({
      owner: 'lunartide-cache',
      expiresAt: Date.now() - 10000,
    }));
    const ac = new AbortController();
    const result = await temporaryPreviewsProvider.scan(ac.signal);
    expect(result.totalBytes).toBe(0);
  });
});

/* ═══════════════════════════════════════════════
   scanResultToBreakdown adapter
   ═══════════════════════════════════════════════ */

describe('scanResultToBreakdown', () => {
  it('maps categories correctly', () => {
    const result = scanResultToBreakdown({
      scannedAt: Date.now(),
      totalBytes: 300,
      totalCount: 3,
      categories: [
        { categoryId: 'stale_cache_storage', label: 'a', items: [], totalBytes: 100, totalCount: 1 },
        { categoryId: 'expired_metadata', label: 'b', items: [], totalBytes: 150, totalCount: 1 },
        { categoryId: 'temporary_previews', label: 'c', items: [], totalBytes: 50, totalCount: 1 },
      ],
      warnings: [],
    });
    expect(result.temporaryBytes).toBe(100);
    expect(result.mediaBytes).toBe(150);
    expect(result.orphanBytes).toBe(50);
    expect(result.totalBytes).toBe(300);
  });

  it('returns zeros for empty result', () => {
    const result = scanResultToBreakdown({
      scannedAt: Date.now(),
      totalBytes: 0,
      totalCount: 0,
      categories: [],
      warnings: [],
    });
    expect(result.temporaryBytes).toBe(0);
    expect(result.mediaBytes).toBe(0);
    expect(result.orphanBytes).toBe(0);
    expect(result.totalBytes).toBe(0);
  });
});

/* ═══════════════════════════════════════════════
   End-to-end: registry + providers
   ═══════════════════════════════════════════════ */

describe('end-to-end scan and clean', () => {
  beforeEach(() => {
    localStorage.clear();
    _resetRegistryState();
    // Mock caches
    const cache = makeCache('lunartide-old-v1', [{ url: 'http://localhost/old', contentLength: 200 }]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => ['lunartide-old-v1']),
      open: vi.fn(async () => cache),
      delete: vi.fn(async () => true),
    };
    // Register all providers
    registerAllCacheProviders();
  });

  it('full scan returns correct totals', async () => {
    // Add expired metadata
    localStorage.setItem('lunartide_ai_cache_test', JSON.stringify({
      owner: 'lunartide-cache', expiresAt: Date.now() - 10000, cacheType: 'ai', schemaVersion: 1, sizeBytes: 300,
    }));
    const ac = new AbortController();
    const result = await scanSafeCache(ac.signal);
    expect(result.totalBytes).toBeGreaterThan(0);
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it('clean reuses scan categories and releases bytes', async () => {
    localStorage.setItem('lunartide_ai_cache_test', JSON.stringify({
      owner: 'lunartide-cache', expiresAt: Date.now() - 10000, cacheType: 'ai', schemaVersion: 1, sizeBytes: 300,
    }));
    const ac = new AbortController();
    const scanResult = await scanSafeCache(ac.signal);
    expect(scanResult.totalBytes).toBeGreaterThan(0);
    const cleanResult = await cleanSafeCache(scanResult.categories, ac.signal);
    expect(cleanResult.releasedBytes).toBeGreaterThan(0);
  });

  it('clean after scan frees all tracked bytes', async () => {
    localStorage.setItem('lunartide_temp_preview_p1', JSON.stringify({
      owner: 'lunartide-cache', temporary: true, expiresAt: Date.now() - 10000, sizeBytes: 150,
    }));
    const ac = new AbortController();
    const scanResult = await scanSafeCache(ac.signal);
    const cleanResult = await cleanSafeCache(scanResult.categories, ac.signal);
    expect(cleanResult.releasedBytes).toBe(scanResult.totalBytes);
  });
});
