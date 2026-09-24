import type { CheckIn } from '@/features/tidewatch/types';

export function formatCheckInAgeZh(timestamp: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

/** Pure read-only projection: latest N canonical check-ins. Never writes. */
export function deriveRecentCheckIns(checkIns: CheckIn[], max = 3): CheckIn[] {
  return [...checkIns].sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.max(0, max));
}
