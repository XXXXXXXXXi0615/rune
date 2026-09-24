/* ═══════════════════════════════════════════════
   cacheCleaner — public facade
   Consumers (DailyCacheWindow) import from here.
   Auto-registers all safe-cache providers on first import.
   ═══════════════════════════════════════════════ */

import { registerAllCacheProviders } from './cacheScanner';

// Register providers once at module load
registerAllCacheProviders();

export { scanSafeCache, cleanSafeCache, isScanInProgress, isCleanInProgress } from './cacheRegistry';
export type { CacheScanResult, CacheCleanResult, CacheScanCategory, CacheScanItem } from './types';
