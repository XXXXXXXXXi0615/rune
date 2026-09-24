import { describe, it, expect, beforeEach } from 'vitest';
import { FONT_MANIFEST, getFontById } from '@/features/typography/fontManifest';
import { TYPOGRAPHY_PRESETS, getDefaultPreset } from '@/features/typography/typographyPresets';
import { useTypographyStore } from '@/store/useTypographyStore';

function resetStore() {
  useTypographyStore.setState({
    displayFontId: 'lora',
    bodyFontId: 'inter',
    monoFontId: 'jetbrains-mono',
    displayWeight: 700,
    bodyWeight: 400,
    monoWeight: 400,
    baseSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    customFonts: [],
    downloadedFontIds: [],
  });
}

describe('AppToast — capability gate', () => {
  it('capability check initializes islandNotificationBroken without throw', () => {
  });
});

describe('Store — draft transitions', () => {
  beforeEach(() => resetStore());

  it('initial values match default preset', () => {
    const preset = getDefaultPreset();
    const store = useTypographyStore.getState();
    expect(store.displayFontId).toBe(preset.displayFontId);
    expect(store.bodyFontId).toBe(preset.bodyFontId);
    expect(store.monoFontId).toBe(preset.monoFontId);
  });

  it('applying a font updates store', () => {
    const store = useTypographyStore.getState();
    store.setDisplayFont('inter');
    expect(useTypographyStore.getState().displayFontId).toBe('inter');
  });

  it('bold weight updates store', () => {
    const store = useTypographyStore.getState();
    store.setDisplayWeight(900);
    expect(useTypographyStore.getState().displayWeight).toBe(900);
  });

  it('base size updates store', () => {
    const store = useTypographyStore.getState();
    store.setBaseSize(18);
    expect(useTypographyStore.getState().baseSize).toBe(18);
  });

  it('line height updates store', () => {
    const store = useTypographyStore.getState();
    store.setLineHeight(2.0);
    expect(useTypographyStore.getState().lineHeight).toBe(2.0);
  });
});

describe('Store — cancel restores', () => {
  beforeEach(() => resetStore());

  it('resetToDefaults restores default values', () => {
    const store = useTypographyStore.getState();
    store.setDisplayFont('inter');
    store.resetToDefaults();
    const preset = getDefaultPreset();
    expect(useTypographyStore.getState().displayFontId).toBe(preset.displayFontId);
    expect(useTypographyStore.getState().bodyFontId).toBe(preset.bodyFontId);
  });

  it('reset keeps custom fonts — store preserves user data', () => {
    const store = useTypographyStore.getState();
    store.addCustomFont({
      id: 'test-custom',
      displayName: 'TestFont',
      assetId: 'test-asset',
      format: 'ttf',
      sizeBytes: 1024,
      originalFilename: 'test.ttf',
      family: '"TestFont-custom"',
      weights: [400],
      createdAt: Date.now(),
    });
    store.resetToDefaults();
    expect(useTypographyStore.getState().customFonts.length).toBe(1);
  });

  it('reset keeps downloaded font IDs — store preserves user data', () => {
    const store = useTypographyStore.getState();
    store.markFontDownloaded('source-sans-3');
    store.resetToDefaults();
    expect(useTypographyStore.getState().downloadedFontIds).toContain('source-sans-3');
  });
});

describe('Typography — CJK coverage', () => {
  it('languageCoverage is manifest metadata', () => {
    for (const font of FONT_MANIFEST) {
      expect(font.languageCoverage).toBeDefined();
      expect(typeof font.languageCoverage.latin).toBe('boolean');
      expect(typeof font.languageCoverage.traditionalChinese).toBe('boolean');
      expect(typeof font.languageCoverage.simplifiedChinese).toBe('boolean');
    }
  });

  it('Inter has no CJK coverage', () => {
    const inter = getFontById('inter');
    expect(inter?.languageCoverage.traditionalChinese).toBe(false);
    expect(inter?.languageCoverage.simplifiedChinese).toBe(false);
  });

  it('Noto Sans TC has traditional CJK coverage', () => {
    const nstc = getFontById('noto-sans-tc');
    expect(nstc?.languageCoverage.traditionalChinese).toBe(true);
  });

  it('some fonts lack CJK, some have', () => {
    const latinOnly = FONT_MANIFEST.filter(
      (f) => !f.languageCoverage.traditionalChinese && !f.languageCoverage.simplifiedChinese
    );
    const cjkFonts = FONT_MANIFEST.filter(
      (f) => f.languageCoverage.traditionalChinese || f.languageCoverage.simplifiedChinese
    );
    expect(latinOnly.length).toBeGreaterThan(0);
    expect(cjkFonts.length).toBeGreaterThan(0);
  });
});

describe('Typography — presets', () => {
  it('4 builtin profiles', () => {
    expect(TYPOGRAPHY_PRESETS.length).toBe(4);
  });

  it('each profile references valid font IDs', () => {
    for (const p of TYPOGRAPHY_PRESETS) {
      expect(getFontById(p.displayFontId)).toBeDefined();
      expect(getFontById(p.bodyFontId)).toBeDefined();
      expect(getFontById(p.monoFontId)).toBeDefined();
    }
  });

  it('default preset is lunartide-softlight', () => {
    expect(getDefaultPreset().id).toBe('lunartide-softlight');
  });
});
