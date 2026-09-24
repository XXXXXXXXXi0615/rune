/* ═══════════════════════════════════════════════
   Daily Cache — type definitions
   ═══════════════════════════════════════════════ */

export type CacheCategoryId =
  | 'stale_cache_storage'
  | 'expired_metadata'
  | 'temporary_previews';

export const CACHE_CATEGORY_LABELS: Record<CacheCategoryId, { label: string; desc: string }> = {
  stale_cache_storage: { label: '過期快取', desc: '舊版 Service Worker 快取' },
  expired_metadata: { label: '過期 metadata', desc: 'AI 回覆、設定值暫存' },
  temporary_previews: { label: '臨時預覽', desc: '未提交的圖片、音訊預覽' },
};

export interface CacheScanItem {
  id: string;
  categoryId: CacheCategoryId;
  label: string;
  sizeBytes: number;
  count: number;
  safeToDelete: true;
  source: string;
  /** When true, the size is an estimate, not exact. */
  estimated?: boolean;
}

export interface CacheScanCategory {
  categoryId: CacheCategoryId;
  label: string;
  items: CacheScanItem[];
  totalBytes: number;
  totalCount: number;
}

export interface CacheScanResult {
  scannedAt: number;
  totalBytes: number;
  totalCount: number;
  categories: CacheScanCategory[];
  warnings: string[];
}

export interface CacheCleanFailure {
  itemId: string;
  categoryId: CacheCategoryId;
  reason: string;
}

export interface CacheCleanResult {
  cleanedAt: number;
  requestedBytes: number;
  releasedBytes: number;
  deletedCount: number;
  failedCount: number;
  failures: CacheCleanFailure[];
}

export interface CacheProvider {
  id: CacheCategoryId;
  scan(signal: AbortSignal): Promise<CacheScanCategory>;
  clean(items: CacheScanItem[], signal: AbortSignal): Promise<{ deleted: number; releasedBytes: number; failures: CacheCleanFailure[] }>;
}
