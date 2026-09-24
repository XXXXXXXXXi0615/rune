import { cacheRegistry, type CacheCategoryId, type CacheCleaner } from './cacheRegistry';

export interface CacheClearError { id: CacheCategoryId; message: string }
export interface CacheClearResult { clearedBytes: number; skippedBytes: number; errors: CacheClearError[] }
export const STORAGE_MANAGEMENT_CHANNEL = 'lunartide-storage-management';

export async function estimateCaches(registry: readonly CacheCleaner[] = cacheRegistry) {
  return Promise.all(registry.map(async (cleaner) => {
    try { return { id: cleaner.id, ...(await cleaner.estimateSize()) }; }
    catch { return { id: cleaner.id, bytes: null, approximate: true }; }
  }));
}

export async function clearRegisteredCaches(
  ids: readonly CacheCategoryId[],
  onProgress?: (id: CacheCategoryId) => void,
  registry: readonly CacheCleaner[] = cacheRegistry,
): Promise<CacheClearResult> {
  let clearedBytes = 0;
  let skippedBytes = 0;
  const errors: CacheClearError[] = [];
  for (const cleaner of registry) {
    if (!ids.includes(cleaner.id) || !cleaner.safeToClear) continue;
    onProgress?.(cleaner.id);
    try { clearedBytes += await cleaner.clear(); }
    catch (error) {
      const estimate = await cleaner.estimateSize().catch(() => ({ bytes: null }));
      skippedBytes += estimate.bytes || 0;
      errors.push({ id: cleaner.id, message: error instanceof Error ? error.message : '清理失败' });
    }
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(STORAGE_MANAGEMENT_CHANNEL);
    channel.postMessage({ type: 'cache-cleared', ids, at: Date.now() });
    channel.close();
  }
  return { clearedBytes, skippedBytes, errors };
}
