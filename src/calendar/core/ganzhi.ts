// ================================================================
// 干支计算 — Absolute Days Algorithm
// Anchor: 1984-01-31 = 甲子日 (index 0) — single source of truth
//
// Strictly UTC-based. No local time, no lunar library,
// no year/month derivation, no fallback dates.
// ================================================================

/** Full sexagenary cycle (60 pairs), index 0 = 甲子 */
export const SEXAGENARY: readonly string[] = [
  '甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉',
  '甲戌', '乙亥', '丙子', '丁丑', '戊寅', '己卯', '庚辰', '辛巳', '壬午', '癸未',
  '甲申', '乙酉', '丙戌', '丁亥', '戊子', '己丑', '庚寅', '辛卯', '壬辰', '癸巳',
  '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑', '壬寅', '癸卯',
  '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑',
  '甲寅', '乙卯', '丙辰', '丁巳', '戊午', '己未', '庚申', '辛酉', '壬戌', '癸亥',
];

/** Anchor: 1984-01-31 = 甲子 (index 0) — DO NOT ADD OTHER REFERENCES */
const BASE_UTC = Date.UTC(1984, 0, 31); // 1984-01-31 UTC

/**
 * Parse a YYYY-MM-DD string and return its sexagenary index (0–59).
 * Uses UTC exclusively — no local timezone involved.
 */
export function ganzhiIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const days = Math.floor((utc - BASE_UTC) / 86400000);
  return ((days % 60) + 60) % 60;
}

/**
 * Return the full 干支 (two-character sexagenary) for a YYYY-MM-DD date.
 * Example: dayGanzhi('2027-07-27') → '丁未'
 */
export function dayGanzhi(dateStr: string): string {
  return SEXAGENARY[ganzhiIndex(dateStr)];
}

/** Return the 天干 (first character) for a YYYY-MM-DD date. */
export function dayStem(dateStr: string): string {
  return SEXAGENARY[ganzhiIndex(dateStr)][0];
}

/** Return the 地支 (second character) for a YYYY-MM-DD date. */
export function dayBranch(dateStr: string): string {
  return SEXAGENARY[ganzhiIndex(dateStr)][1];
}

export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export type FiveElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

const CHARACTER_ELEMENTS: Readonly<Record<string, FiveElement>> = {
  甲: 'wood', 乙: 'wood', 寅: 'wood', 卯: 'wood',
  丙: 'fire', 丁: 'fire', 巳: 'fire', 午: 'fire',
  戊: 'earth', 己: 'earth', 辰: 'earth', 未: 'earth', 戌: 'earth', 丑: 'earth',
  庚: 'metal', 辛: 'metal', 申: 'metal', 酉: 'metal',
  壬: 'water', 癸: 'water', 亥: 'water', 子: 'water',
};

export function fiveElementOf(character: string): FiveElement {
  const element = CHARACTER_ELEMENTS[character];
  if (!element) throw new Error(`Unsupported Ganzhi character: ${character}`);
  return element;
}
