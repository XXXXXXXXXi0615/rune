// ================================================================
// Lunar Date Approximation
//
// Simple approximate lunar date using 30-day lunar months from
// a known Chinese New Year reference.
//
// Note: This is an APPROXIMATION for UI display only.
// For accurate lunar dates, a full lunar calendar library would
// be needed (lunar months can be 29 or 30 days with leap months).
// ================================================================

export const LUNAR_MONTHS_ZH = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '臘月',
];

export const LUNAR_DAYS_ZH = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

/** Reference: 2025-01-29 = 正月初一 (Chinese New Year 2025) */
const LUNAR_BASE_DATE = '2025-01-29';

function parseUTCDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const LUNAR_BASE_UTC = parseUTCDate(LUNAR_BASE_DATE);

export interface LunarDate {
  month: number; // 1–12
  day: number;   // 1–30
  label: string; // e.g. "三月十五"
}

/**
 * Approximate lunar date for a given YYYY-MM-DD solar date.
 * Returns null if the date is before the base reference (2025-01-29).
 */
export function approximateLunarDate(dateStr: string): LunarDate | null {
  const utc = parseUTCDate(dateStr);
  const diffDays = Math.round((utc - LUNAR_BASE_UTC) / 86400000);

  if (diffDays < 0) return null;

  // Simple 30-day lunar month approximation
  let remaining = diffDays;
  let month = 1;
  while (remaining >= 30) {
    remaining -= 30;
    month += 1;
  }

  const lunarMonth = month <= 12 ? month : ((month - 1) % 12) + 1;
  const lunarDay = Math.min(remaining + 1, 30);

  return {
    month: lunarMonth,
    day: lunarDay,
    label: `${LUNAR_MONTHS_ZH[lunarMonth - 1]}${LUNAR_DAYS_ZH[lunarDay - 1]}`,
  };
}
