/* ═══════════════════════════════════════════════
   cacheRegistry — unified provider registration
   DailyCacheWindow calls scanSafeCache / cleanSafeCache only.
   ═══════════════════════════════════════════════ */

import type { CacheProvider, CacheScanResult, CacheCleanResult, CacheCategoryId, CacheScanCategory, CacheScanItem } from './types';

const providers = new Map<CacheCategoryId, CacheProvider>();

let scanInProgress = false;
let cleanInProgress = false;

export function registerProvider(provider: CacheProvider): void {
  providers.set(provider.id, provider);
}

export function isScanInProgress(): boolean {
  return scanInProgress;
}

export function isCleanInProgress(): boolean {
  return cleanInProgress;
}

export async function scanSafeCache(signal: AbortSignal): Promise<CacheScanResult> {
  if (scanInProgress) throw new Error('A scan is already in progress');
  scanInProgress = true;
  const startedAt = Date.now();
  const warnings: string[] = [];
  const categories: CacheScanCategory[] = [];

  try {
    const entries = Array.from(providers.entries());
    for (const [, provider] of entries) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      try {
        const cat = await provider.scan(signal);
        if (cat.items.length > 0) {
          categories.push(cat);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        warnings.push(`Provider ${provider.id} scan failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const totalBytes = categories.reduce((sum, c) => sum + c.totalBytes, 0);
    const totalCount = categories.reduce((sum, c) => sum + c.totalCount, 0);

    return { scannedAt: Date.now(), totalBytes, totalCount, categories, warnings };
  } finally {
    scanInProgress = false;
  }
}

export async function cleanSafeCache(
  categories: CacheScanCategory[],
  signal: AbortSignal,
): Promise<CacheCleanResult> {
  if (cleanInProgress) throw new Error('A clean is already in progress');
  cleanInProgress = true;

  const requestedBytes = categories.reduce((sum, c) => sum + c.totalBytes, 0);
  let releasedBytes = 0;
  let deletedCount = 0;
  const allFailures: CacheCleanResult['failures'] = [];

  try {
    for (const cat of categories) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const provider = providers.get(cat.categoryId);
      if (!provider) {
        allFailures.push(...cat.items.map((item) => ({ itemId: item.id, categoryId: item.categoryId, reason: 'No provider registered' })));
        continue;
      }
      try {
        const result = await provider.clean(cat.items, signal);
        deletedCount += result.deleted;
        releasedBytes += result.releasedBytes;
        allFailures.push(...result.failures);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        allFailures.push(...cat.items.map((item) => ({ itemId: item.id, categoryId: item.categoryId, reason: err instanceof Error ? err.message : String(err) })));
      }
    }

    return {
      cleanedAt: Date.now(),
      requestedBytes,
      releasedBytes,
      deletedCount,
      failedCount: allFailures.length,
      failures: allFailures,
    };
  } finally {
    cleanInProgress = false;
  }
}

/** For testing only: reset state. */
export function _resetRegistryState(): void {
  providers.clear();
  scanInProgress = false;
  cleanInProgress = false;
}

/** For testing only: register mock providers. */
export function _setProviders(mockProviders: CacheProvider[]): void {
  providers.clear();
  for (const p of mockProviders) providers.set(p.id, p);
}
