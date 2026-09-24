import { describe, it, expect } from 'vitest';
import { FONT_MANIFEST, getFontById, getFontsByRole, BUNDLED_FONTS, DOWNLOADABLE_FONTS, getDefaultFontIdForRole } from '../fontManifest';
import { TYPOGRAPHY_PRESETS, getPresetById, getDefaultPreset } from '../typographyPresets';
import { isFontAvailable } from '../fontAvailability';
import type { FontFamilyDefinition, FontSource, FontRole } from '../types';

describe('Font Manifest', () => {
  it('should contain all required bundled fonts', () => {
    const ids = BUNDLED_FONTS.map((f) => f.id);
    expect(ids).toContain('inter');
    expect(ids).toContain('lora');
    expect(ids).toContain('jetbrains-mono');
    expect(ids).toContain('noto-sans-tc');
    expect(ids).toContain('noto-serif-tc');
  });

  it('should contain all required downloadable fonts', () => {
    const ids = DOWNLOADABLE_FONTS.map((f) => f.id);
    expect(ids).toContain('source-han-sans-tc');
    expect(ids).toContain('source-han-serif-tc');
    expect(ids).toContain('source-sans-3');
    expect(ids).toContain('playfair-display');
    expect(ids).toContain('eb-garamond');
    expect(ids).toContain('cormorant-garamond');
    expect(ids).toContain('source-code-pro');
    expect(ids).toContain('iansui');
  });

  it('should have unique font IDs', () => {
    const ids = FONT_MANIFEST.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every font should have a license', () => {
    for (const font of FONT_MANIFEST) {
      expect(font.license).toBeDefined();
      expect(font.license.name).toBeTruthy();
    }
  });

  it('should find font by ID', () => {
    const inter = getFontById('inter');
    expect(inter).toBeDefined();
    expect(inter!.family).toBe('Inter');
  });

  it('should return undefined for unknown font ID', () => {
    expect(getFontById('nonexistent')).toBeUndefined();
  });

  it('should filter fonts by role', () => {
    const display = getFontsByRole('display');
    for (const font of display) {
      expect(font.roles.includes('display')).toBe(true);
    }
  });

  it('every font should have language coverage defined', () => {
    for (const font of FONT_MANIFEST) {
      expect(font.languageCoverage).toBeDefined();
      const cov = font.languageCoverage;
      expect(typeof cov.latin).toBe('boolean');
      expect(typeof cov.traditionalChinese).toBe('boolean');
      expect(typeof cov.simplifiedChinese).toBe('boolean');
    }
  });

  it('CJK fonts should have traditionalChinese coverage', () => {
    const cjkFonts = FONT_MANIFEST.filter((f) => f.id.includes('tc') || f.id === 'iansui');
    for (const font of cjkFonts) {
      expect(font.languageCoverage.traditionalChinese).toBe(true);
    }
  });

  it('should have sensible fallback stacks', () => {
    for (const font of FONT_MANIFEST) {
      expect(font.fallbackStack.length).toBeGreaterThan(0);
    }
  });
});

describe('Typography Presets', () => {
  it('should have 4 builtin profiles', () => {
    expect(TYPOGRAPHY_PRESETS.length).toBe(4);
  });

  it('each profile should reference valid font IDs', () => {
    for (const profile of TYPOGRAPHY_PRESETS) {
      expect(getFontById(profile.displayFontId)).toBeDefined();
      expect(getFontById(profile.bodyFontId)).toBeDefined();
      expect(getFontById(profile.monoFontId)).toBeDefined();
    }
  });

  it('should have unique profile IDs', () => {
    const ids = TYPOGRAPHY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should find profile by ID', () => {
    const profile = getPresetById('lunartide-softlight');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('月潮柔光');
  });

  it('should return default preset', () => {
    const preset = getDefaultPreset();
    expect(preset).toBeDefined();
    expect(preset.id).toBe('lunartide-softlight');
  });

  it('月潮手記 preset should use Iansui', () => {
    const handNote = TYPOGRAPHY_PRESETS.find((p) => p.id === 'lunartide-note');
    expect(handNote).toBeDefined();
    expect(handNote!.displayFontId).toBe('iansui');
  });

  it('深海極簡 preset should use Source Code Pro for mono', () => {
    const deepOcean = TYPOGRAPHY_PRESETS.find((p) => p.id === 'deep-sea-minimal');
    expect(deepOcean).toBeDefined();
    expect(deepOcean!.monoFontId).toBe('source-code-pro');
  });
});

describe('Font Availability', () => {
  it('isFontAvailable should return boolean', () => {
    const result = isFontAvailable('Arial');
    expect(typeof result).toBe('boolean');
  });

  it('isFontAvailable should return false for nonexistent font', () => {
    const result = isFontAvailable('__nonexistent_font_name_12345__');
    expect(result).toBe(false);
  });
});

describe('Types', () => {
  it('should export all expected types', () => {
    const testDef: FontFamilyDefinition = {
      id: 'test',
      family: 'Test',
      displayName: 'Test Font',
      source: 'bundled' as FontSource,
      roles: ['display' as FontRole],
      fallbackStack: ['serif'],
      supportedWeights: [400],
      variants: [],
      languageCoverage: { latin: true, traditionalChinese: false, simplifiedChinese: false, japanese: false, korean: false },
      license: { name: 'Test License' },
      status: 'available',
    };
    expect(testDef.id).toBe('test');
  });
});

describe('Default font IDs', () => {
  it('DEFAULT_DISPLAY_FONT_ID should reference a valid font', () => {
    expect(getFontById(getDefaultFontIdForRole('display'))).toBeDefined();
  });

  it('DEFAULT_BODY_FONT_ID should reference a valid font', () => {
    expect(getFontById(getDefaultFontIdForRole('body'))).toBeDefined();
  });

  it('DEFAULT_MONO_FONT_ID should reference a valid font', () => {
    expect(getFontById(getDefaultFontIdForRole('mono'))).toBeDefined();
  });
});
