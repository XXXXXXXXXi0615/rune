/* ═══════════════════════════════════════════════
   cacheScanner — 3 safe-cache providers
   Only scans:
   1. stale Cache Storage (old Lunartide versions)
   2. expired metadata (AI/provider caches with ownership marker)
   3. temporary previews (explicit temporary=true flag, expired)
   ═══════════════════════════════════════════════ */

import type { CacheProvider, CacheScanCategory, CacheScanItem, CacheCleanFailure } from './types';

/* ── prefixes and markers ── */

/** Only caches starting with this prefix are considered Lunartide-owned. */
const LUNARTIDE_CACHE_PREFIX = 'lunartide-';

/** Cache names that are currently active and must NOT be deleted. */
const ACTIVE_CACHE_NAMES = new Set<string>([
  'lunartide-v3',
  'lunartide-app-shell-v1',
  'lunartide-assets-v1',
  'lunartide-fonts-v1',
]);

/** Metadata ownership marker. Only records with this owner are scanned. */
const OWNERSHIP_MARKER = 'lunartide-cache';

/** localStorage key patterns for metadata caches. */
const METADATA_PREFIXES = ['lunartide_ai_cache_', 'lunartide_provider_meta_', 'lunartide_search_meta_'];

/** Key prefix for temporary previews in localStorage. */
const TEMP_PREVIEW_PREFIX = 'lunartide_temp_preview_';

/* ───────────────────────────────────────────────
   Provider 1: Stale Cache Storage
   ─────────────────────────────────────────────── */

async function scanStaleCaches(signal: AbortSignal): Promise<CacheScanCategory> {
  const items: CacheScanItem[] = [];
  let totalBytes = 0;
  let totalCount = 0;

  if (typeof caches === 'undefined') {
    return { categoryId: 'stale_cache_storage', label: '過期快取', items, totalBytes, totalCount };
  }

  const names = await caches.keys();
  for (const name of names) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (ACTIVE_CACHE_NAMES.has(name)) continue;
    if (!name.startsWith(LUNARTIDE_CACHE_PREFIX)) continue;

    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Estimate size: sum Content-Length of cached responses
    let sizeBytes = 0;
    let count = 0;
    for (const req of keys) {
      try {
        const resp = await cache.match(req);
        if (resp) {
          const cl = resp.headers.get('Content-Length');
          if (cl) sizeBytes += Number(cl);
          else sizeBytes += resp.url.length * 2; // rough estimate
          count++;
        }
      } catch {
        // skip unreadable entries
      }
    }

    if (count > 0) {
      items.push({
        id: `cache:${name}`,
        categoryId: 'stale_cache_storage',
        label: name,
        sizeBytes,
        count,
        safeToDelete: true,
        source: `Cache Storage: ${name}`,
        estimated: sizeBytes === 0,
      });
      totalBytes += sizeBytes;
      totalCount += count;
    }
  }

  return { categoryId: 'stale_cache_storage', label: '過期快取', items, totalBytes, totalCount };
}

async function cleanStaleCaches(
  scanItems: CacheScanItem[],
  signal: AbortSignal,
): Promise<{ deleted: number; releasedBytes: number; failures: CacheCleanFailure[] }> {
  let deleted = 0;
  let releasedBytes = 0;
  const failures: CacheCleanFailure[] = [];

  if (typeof caches === 'undefined') return { deleted, releasedBytes, failures };

  for (const item of scanItems) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Revalidate: check cache still exists and is still stale
    const cacheName = item.id.replace('cache:', '');
    if (ACTIVE_CACHE_NAMES.has(cacheName)) {
      failures.push({ itemId: item.id, categoryId: 'stale_cache_storage', reason: 'Cache is now active' });
      continue;
    }
    if (!cacheName.startsWith(LUNARTIDE_CACHE_PREFIX)) {
      failures.push({ itemId: item.id, categoryId: 'stale_cache_storage', reason: 'Not a Lunartide cache' });
      continue;
    }

    try {
      const allNames = await caches.keys();
      if (!allNames.includes(cacheName)) {
        failures.push({ itemId: item.id, categoryId: 'stale_cache_storage', reason: 'Cache no longer exists' });
        continue;
      }
      await caches.delete(cacheName);
      deleted += item.count;
      releasedBytes += item.sizeBytes;
    } catch (err) {
      failures.push({ itemId: item.id, categoryId: 'stale_cache_storage', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { deleted, releasedBytes, failures };
}

export const staleCacheProvider: CacheProvider = {
  id: 'stale_cache_storage',
  scan: scanStaleCaches,
  clean: cleanStaleCaches,
};

/* ───────────────────────────────────────────────
   Provider 2: Expired Metadata
   ─────────────────────────────────────────────── */

function isExpiredMetadataRecord(key: string, value: unknown): CacheScanItem | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.owner !== OWNERSHIP_MARKER) return null;
    if (!parsed.expiresAt || typeof parsed.expiresAt !== 'number') return null;
    if (!parsed.cacheType || typeof parsed.cacheType !== 'string') return null;
    if (!parsed.schemaVersion) return null;
    if (parsed.expiresAt > Date.now()) return null; // not expired

    const sizeBytes = typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : value.length;
    return {
      id: `meta:${key}`,
      categoryId: 'expired_metadata' as const,
      label: key,
      sizeBytes,
      count: 1,
      safeToDelete: true,
      source: `localStorage: ${key}`,
      estimated: typeof parsed.sizeBytes !== 'number',
    };
  } catch {
    return null;
  }
}

async function scanExpiredMetadata(signal: AbortSignal): Promise<CacheScanCategory> {
  const items: CacheScanItem[] = [];
  let totalBytes = 0;
  let totalCount = 0;

  for (const prefix of METADATA_PREFIXES) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const item = isExpiredMetadataRecord(key, raw);
      if (item) {
        items.push(item);
        totalBytes += item.sizeBytes;
        totalCount++;
      }
    }
  }

  return { categoryId: 'expired_metadata', label: '過期 metadata', items, totalBytes, totalCount };
}

async function cleanExpiredMetadata(
  scanItems: CacheScanItem[],
  signal: AbortSignal,
): Promise<{ deleted: number; releasedBytes: number; failures: CacheCleanFailure[] }> {
  let deleted = 0;
  let releasedBytes = 0;
  const failures: CacheCleanFailure[] = [];

  for (const item of scanItems) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const key = item.id.replace('meta:', '');
    // Revalidate before delete
    const raw = localStorage.getItem(key);
    if (raw === null) {
      failures.push({ itemId: item.id, categoryId: 'expired_metadata', reason: 'Key no longer exists' });
      continue;
    }
    const revalidated = isExpiredMetadataRecord(key, raw);
    if (!revalidated) {
      failures.push({ itemId: item.id, categoryId: 'expired_metadata', reason: 'No longer eligible for cleanup' });
      continue;
    }

    try {
      localStorage.removeItem(key);
      deleted++;
      releasedBytes += item.sizeBytes;
    } catch (err) {
      failures.push({ itemId: item.id, categoryId: 'expired_metadata', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { deleted, releasedBytes, failures };
}

export const expiredMetadataProvider: CacheProvider = {
  id: 'expired_metadata',
  scan: scanExpiredMetadata,
  clean: cleanExpiredMetadata,
};

/* ───────────────────────────────────────────────
   Provider 3: Temporary Previews
   ─────────────────────────────────────────────── */

interface TempPreviewRecord {
  owner?: string;
  temporary?: boolean;
  expiresAt?: number;
  submitted?: boolean;
  sizeBytes?: number;
}

function isExpiredTempPreview(key: string, raw: string): CacheScanItem | null {
  try {
    const parsed: TempPreviewRecord = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.owner !== OWNERSHIP_MARKER) return null;
    if (parsed.temporary !== true) return null;
    if (parsed.submitted === true) return null; // already committed — do not delete
    if (!parsed.expiresAt || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt > Date.now()) return null; // not expired

    const sizeBytes = typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : raw.length;

    return {
      id: `preview:${key}`,
      categoryId: 'temporary_previews',
      label: key,
      sizeBytes,
      count: 1,
      safeToDelete: true,
      source: `localStorage: ${key}`,
      estimated: typeof parsed.sizeBytes !== 'number',
    };
  } catch {
    return null;
  }
}

async function scanTemporaryPreviews(signal: AbortSignal): Promise<CacheScanCategory> {
  const items: CacheScanItem[] = [];
  let totalBytes = 0;
  let totalCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const key = localStorage.key(i);
    if (!key || !key.startsWith(TEMP_PREVIEW_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    const item = isExpiredTempPreview(key, raw);
    if (item) {
      items.push(item);
      totalBytes += item.sizeBytes;
      totalCount++;
    }
  }

  return { categoryId: 'temporary_previews', label: '臨時預覽', items, totalBytes, totalCount };
}

async function cleanTemporaryPreviews(
  scanItems: CacheScanItem[],
  signal: AbortSignal,
): Promise<{ deleted: number; releasedBytes: number; failures: CacheCleanFailure[] }> {
  let deleted = 0;
  let releasedBytes = 0;
  const failures: CacheCleanFailure[] = [];

  for (const item of scanItems) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const key = item.id.replace('preview:', '');
    // Revalidate before delete
    const raw = localStorage.getItem(key);
    if (raw === null) {
      failures.push({ itemId: item.id, categoryId: 'temporary_previews', reason: 'Key no longer exists' });
      continue;
    }
    const revalidated = isExpiredTempPreview(key, raw);
    if (!revalidated) {
      failures.push({ itemId: item.id, categoryId: 'temporary_previews', reason: 'No longer eligible for cleanup' });
      continue;
    }

    try {
      localStorage.removeItem(key);
      deleted++;
      releasedBytes += item.sizeBytes;
    } catch (err) {
      failures.push({ itemId: item.id, categoryId: 'temporary_previews', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { deleted, releasedBytes, failures };
}

export const temporaryPreviewsProvider: CacheProvider = {
  id: 'temporary_previews',
  scan: scanTemporaryPreviews,
  clean: cleanTemporaryPreviews,
};

/* ───────────────────────────────────────────────
   Register all providers
   ─────────────────────────────────────────────── */

import { registerProvider } from './cacheRegistry';

export function registerAllCacheProviders(): void {
  registerProvider(staleCacheProvider);
  registerProvider(expiredMetadataProvider);
  registerProvider(temporaryPreviewsProvider);
}
