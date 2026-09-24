export interface StorageEstimateResult { usage: number | null; quota: number | null }

export async function estimateDeviceStorage(): Promise<StorageEstimateResult> {
  if (!navigator.storage?.estimate) return { usage: null, quota: null };
  try {
    const result = await navigator.storage.estimate();
    return { usage: result.usage ?? null, quota: result.quota ?? null };
  } catch {
    return { usage: null, quota: null };
  }
}

export function formatStorageSize(bytes: number | null, approximate = false): string {
  if (bytes === null) return '无法估算';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return '不足 1 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${approximate ? '约 ' : ''}${formatted} ${units[unit]}`;
}

export const formatStorageBytes = formatStorageSize;
