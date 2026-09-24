import { describe, it, expect } from 'vitest';
import {
  validateThemeConfig,
  normalizeFontScale,
  DEFAULT_THEME_CONFIG,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
} from '@/utils/themeConfig';

describe('normalizeFontScale', () => {
  it('keeps valid scale values', () => {
    expect(normalizeFontScale(1)).toBe(1);
    expect(normalizeFontScale(0.85)).toBe(0.85);
    expect(normalizeFontScale(1.25)).toBe(1.25);
    expect(normalizeFontScale(1.1)).toBe(1.1);
  });

  it('clamps out-of-range values into [0.85, 1.25]', () => {
    expect(normalizeFontScale(0.5)).toBe(FONT_SCALE_MIN);
    expect(normalizeFontScale(2)).toBe(FONT_SCALE_MAX);
    expect(normalizeFontScale(-1)).toBe(FONT_SCALE_MIN);
  });

  it('snaps to the 0.05 step', () => {
    expect(normalizeFontScale(0.93)).toBe(0.95);
    expect(normalizeFontScale(1.02)).toBe(1);
  });

  it('maps legacy enum values', () => {
    expect(normalizeFontScale('small')).toBe(0.9);
    expect(normalizeFontScale('normal')).toBe(1);
    expect(normalizeFontScale('large')).toBe(1.1);
  });

  it('falls back to default for invalid input', () => {
    expect(normalizeFontScale(undefined)).toBe(1);
    expect(normalizeFontScale(null)).toBe(1);
    expect(normalizeFontScale('bogus')).toBe(1);
    expect(normalizeFontScale(NaN)).toBe(1);
    expect(normalizeFontScale({})).toBe(1);
  });

  it('is idempotent', () => {
    for (const value of [0.5, 1, 1.02, 2, 'normal', 'large', undefined]) {
      const once = normalizeFontScale(value);
      expect(normalizeFontScale(once)).toBe(once);
    }
  });
});

describe('validateThemeConfig fontScale', () => {
  const base = { accent: '', backgroundPreset: 'default', glassIntensity: 'medium', radius: 'soft', bubbleStyle: 'glass' };

  it('accepts numeric fontScale and normalizes it', () => {
    const result = validateThemeConfig({ ...base, fontScale: 1.1 });
    expect(result).not.toBeNull();
    expect(result?.fontScale).toBe(1.1);
  });

  it('clamps out-of-range numeric fontScale', () => {
    const result = validateThemeConfig({ ...base, fontScale: 3 });
    expect(result?.fontScale).toBe(FONT_SCALE_MAX);
  });

  it('maps legacy enum strings instead of rejecting', () => {
    expect(validateThemeConfig({ ...base, fontScale: 'normal' })?.fontScale).toBe(1);
    expect(validateThemeConfig({ ...base, fontScale: 'large' })?.fontScale).toBe(1.1);
    expect(validateThemeConfig({ ...base, fontScale: 'small' })?.fontScale).toBe(0.9);
  });

  it('rejects non-numeric non-legacy fontScale', () => {
    expect(validateThemeConfig({ ...base, fontScale: true })).toBeNull();
    expect(validateThemeConfig({ ...base, fontScale: 'huge' })).toBeNull();
    expect(validateThemeConfig({ ...base, fontScale: {} })).toBeNull();
  });

  it('rejects missing fontScale key', () => {
    expect(validateThemeConfig(base)).toBeNull();
  });

  it('does not mutate theme/wallpaper fields while normalizing', () => {
    const result = validateThemeConfig({ ...base, fontScale: 1.25 });
    expect(result).toEqual({ ...base, fontScale: 1.25 });
  });

  it('default config uses scale 1', () => {
    expect(DEFAULT_THEME_CONFIG.fontScale).toBe(1);
  });
});
