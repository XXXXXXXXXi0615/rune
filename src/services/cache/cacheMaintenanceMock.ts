/* ═══════════════════════════════════════════════
   cacheMaintenanceMock — centralized formatters & test helpers
   No hard-coded mock bytes for production.
   ═══════════════════════════════════════════════ */

import type { CacheScanResult } from './types';

export interface CacheBreakdown {
  temporaryBytes: number;
  mediaBytes: number;
  orphanBytes: number;
  totalBytes: number;
  lastCleanedAt: string | null;
  autoCleanEnabled: boolean;
}

/** Map a CacheScanResult to the UI's CacheBreakdown shape. */
export function scanResultToBreakdown(result: CacheScanResult): CacheBreakdown {
  const breakdown: CacheBreakdown = {
    temporaryBytes: 0,
    mediaBytes: 0,
    orphanBytes: 0,
    totalBytes: result.totalBytes,
    lastCleanedAt: null,
    autoCleanEnabled: true,
  };

  for (const cat of result.categories) {
    const k = cat.categoryId;
    if (k === 'stale_cache_storage') breakdown.temporaryBytes = cat.totalBytes;
    else if (k === 'expired_metadata') breakdown.mediaBytes = cat.totalBytes;
    else if (k === 'temporary_previews') breakdown.orphanBytes = cat.totalBytes;
  }

  return breakdown;
}

/** Format bytes into a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Short format without unit — used in compact stat rows. */
export function formatBytesCompact(bytes: number): string {
  if (bytes === 0) return '0';
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Format an ISO timestamp for display. */
export function formatLastCleaned(iso: string | null): string {
  if (!iso) return '尚未整理';
  return new Date(iso).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
