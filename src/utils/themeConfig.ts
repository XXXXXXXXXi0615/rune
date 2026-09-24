/**
 * Theme configuration utilities.
 * Safe appearance customizer — all presets are whitelist-based.
 */
import type { ThemeConfig } from '@/types';

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.25;
export const FONT_SCALE_STEP = 0.05;
export const FONT_SCALE_DEFAULT = 1;

/** Legacy enum values (pre-numeric schema). */
const LEGACY_FONT_SCALE: Record<string, number> = {
  small: 0.9,
  normal: 1,
  large: 1.1,
};

/**
 * Normalize any persisted fontScale value to a valid step-aligned number.
 * - number → clamped to [FONT_SCALE_MIN, FONT_SCALE_MAX], snapped to 0.05 step
 * - legacy 'small' | 'normal' | 'large' → 0.9 / 1 / 1.1
 * - anything else → FONT_SCALE_DEFAULT (1)
 * Idempotent: normalize(normalize(x)) === normalize(x).
 */
export function normalizeFontScale(value: unknown): number {
  let n: number;
  if (typeof value === 'number' && Number.isFinite(value)) n = value;
  else if (typeof value === 'string' && value in LEGACY_FONT_SCALE) n = LEGACY_FONT_SCALE[value];
  else n = FONT_SCALE_DEFAULT;
  const snapped = Math.round(n / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Number(snapped.toFixed(2))));
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  accent: '',
  backgroundPreset: 'default',
  glassIntensity: 'medium',
  radius: 'soft',
  bubbleStyle: 'glass',
  fontScale: FONT_SCALE_DEFAULT,
};

const THEME_CONFIG_KEYS: (keyof ThemeConfig)[] = [
  'accent', 'backgroundPreset', 'glassIntensity', 'radius', 'bubbleStyle', 'fontScale',
];

const THEME_CONFIG_VALUES: Record<Exclude<keyof ThemeConfig, 'fontScale'>, readonly string[]> = {
  accent: ['', 'coral', 'teal', 'lavender', 'amber', 'rose'],
  backgroundPreset: ['default', 'moonlight', 'pink', 'blue', 'terminal'],
  glassIntensity: ['low', 'medium', 'high'],
  radius: ['soft', 'round', 'pill'],
  bubbleStyle: ['glass', 'wechat', 'paper', 'terminal'],
};

/** Validate an imported theme config JSON object. Returns sanitized ThemeConfig or null. */
export function validateThemeConfig(raw: unknown): ThemeConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const result: Partial<ThemeConfig> = {};
  for (const key of THEME_CONFIG_KEYS) {
    const val = obj[key];
    if (key === 'fontScale') {
      // Numeric scale (or legacy enum string); normalize instead of rejecting.
      if (typeof val !== 'number' && !(typeof val === 'string' && val in LEGACY_FONT_SCALE)) return null;
      result.fontScale = normalizeFontScale(val);
      continue;
    }
    if (typeof val !== 'string') return null;
    if (!(THEME_CONFIG_VALUES[key] as readonly string[]).includes(val)) return null;
    (result as Record<string, string>)[key] = val;
  }
  for (const key of THEME_CONFIG_KEYS) {
    if (result[key] === undefined) return null;
  }
  return result as ThemeConfig;
}
