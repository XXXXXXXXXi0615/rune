import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useTypographyStore } from '@/store/useTypographyStore';
import { reloadCustomFont, registerGoogleFont } from '@/utils/fontLibrary';
import { injectAllZones } from '@/utils/customCssStorage';
import { applyThemePack, loadRuntimeThemePack, resetTheme, THEME_PACK_EVENT } from '@/utils/themePacks';
import { getFontById, FONT_MANIFEST } from '@/features/typography/fontManifest';
import { installCustomFont, reloadDownloadedFont } from '@/features/typography/fontLoader';
import { getFontBlob } from '@/features/typography/fontStorage';
import type { FontFamilyDefinition } from '@/features/typography/types';

function resolveFontStack(def: FontFamilyDefinition | undefined, cjkDef: FontFamilyDefinition | undefined): string {
  if (!def && !cjkDef) return 'sans-serif';
  if (!def) return cjkDef ? `"${cjkDef.family}", ${cjkDef.fallbackStack.join(', ')}` : 'sans-serif';
  const parts: string[] = [`"${def.family}"`];
  if (cjkDef && cjkDef.id !== def.id) parts.push(`"${cjkDef.family}"`);
  parts.push(...def.fallbackStack);
  return parts.join(', ');
}

export function useAppTheme() {
  const theme = useAppStore((s) => s.theme);
  const themeConfig = useAppStore((s) => s.themeConfig);
  const displayFont = useAppStore((s) => s.displayFont);
  const bodyFont = useAppStore((s) => s.bodyFont);
  const fontSize = useAppStore((s) => s.fontSize);
  const customFonts = useAppStore((s) => s.customFonts || []);

  const displayFontId = useTypographyStore((s) => s.displayFontId);
  const bodyFontId = useTypographyStore((s) => s.bodyFontId);
  const monoFontId = useTypographyStore((s) => s.monoFontId);
  const typoBaseSize = useTypographyStore((s) => s.baseSize);
  const typoLineHeight = useTypographyStore((s) => s.lineHeight);
  const typoLetterSpacing = useTypographyStore((s) => s.letterSpacing);
  const downloadedFontIds = useTypographyStore((s) => s.downloadedFontIds);
  const typoCustomFonts = useTypographyStore((s) => s.customFonts);

  useEffect(() => {
    const applyThemeAttribute = () => {
      const resolved = theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : theme;
      resetTheme();
      document.documentElement.setAttribute('data-theme', resolved);
      applyThemePack(loadRuntimeThemePack());
      const root = document.documentElement;
      try {
        ['--text', '--text-2', '--accent'].forEach((v, i) => {
          const key = ['lunartide_custom_text', 'lunartide_custom_text2', 'lunartide_custom_accent'][i];
          const cv = localStorage.getItem(key);
          if (cv) root.style.setProperty(v, cv);
        });
      } catch { /* localStorage may not be available */ }
    };
    applyThemeAttribute();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyThemeAttribute);
    return () => mq.removeEventListener('change', applyThemeAttribute);
  }, [theme]);

  useEffect(() => {
    const h = document.documentElement;
    const { backgroundPreset, glassIntensity, radius, bubbleStyle, fontScale } = themeConfig;
    if (backgroundPreset !== 'default') h.setAttribute('data-background-preset', backgroundPreset);
    else h.removeAttribute('data-background-preset');
    if (glassIntensity !== 'medium') h.setAttribute('data-glass', glassIntensity);
    else h.removeAttribute('data-glass');
    if (radius !== 'soft') h.setAttribute('data-radius', radius);
    else h.removeAttribute('data-radius');
    if (bubbleStyle !== 'glass') h.setAttribute('data-bubble', bubbleStyle);
    else h.removeAttribute('data-bubble');
    // Global typography scale — CSS var only. Never root font-size, never geometry.
    if (typeof fontScale === 'number' && fontScale !== 1) h.style.setProperty('--font-scale', String(fontScale));
    else h.style.removeProperty('--font-scale');
  }, [themeConfig]);

  useEffect(() => {
    const apply = () => applyThemePack(loadRuntimeThemePack());
    apply();
    window.addEventListener(THEME_PACK_EVENT, apply);
    return () => {
      window.removeEventListener(THEME_PACK_EVENT, apply);
      applyThemePack(null);
    };
  }, []);

  useEffect(() => {
    const r = document.documentElement;
    if (displayFont) r.style.setProperty('--font-display', displayFont);
    else r.style.removeProperty('--font-display');
    if (bodyFont) r.style.setProperty('--font-body', bodyFont);
    else r.style.removeProperty('--font-body');
    r.style.setProperty('--font-size', `${fontSize}px`);
  }, [displayFont, bodyFont, fontSize]);

  useEffect(() => {
    const r = document.documentElement;
    const displayDef = getFontById(displayFontId);
    const bodyDef = getFontById(bodyFontId);
    const monoDef = getFontById(monoFontId);

    const displayCjkDef = (!displayDef || !displayDef.languageCoverage.traditionalChinese)
      ? getFontById('noto-sans-tc')
      : undefined;
    const bodyCjkDef = (!bodyDef || !bodyDef.languageCoverage.traditionalChinese)
      ? getFontById('noto-sans-tc')
      : undefined;

    const displayStack = resolveFontStack(displayDef, displayCjkDef);
    const bodyStack = resolveFontStack(bodyDef, bodyCjkDef);
    const monoStack = monoDef
      ? `"${monoDef.family}", ${monoDef.fallbackStack.join(', ')}`
      : 'ui-monospace, monospace';

    r.style.setProperty('--lt-font-display', displayStack);
    r.style.setProperty('--lt-font-body', bodyStack);
    r.style.setProperty('--lt-font-mono', monoStack);
    r.style.setProperty('--lt-font-size-base', `${typoBaseSize}px`);
    r.style.setProperty('--lt-line-height', String(typoLineHeight));
    r.style.setProperty('--lt-letter-spacing', `${typoLetterSpacing}em`);

    r.style.setProperty('--font-display', displayStack);
    r.style.setProperty('--font-body', bodyStack);
    r.style.setProperty('--font-size', `${typoBaseSize}px`);
  }, [displayFontId, bodyFontId, monoFontId, typoBaseSize, typoLineHeight, typoLetterSpacing]);

  useEffect(() => {
    (async () => {
      for (const f of customFonts) {
        try {
          if (f.category === 'custom' && f.assetId && f.format) await reloadCustomFont(f.name, f.assetId, f.format);
          else if (f.category === 'google' && f.url) await registerGoogleFont(f.name, f.url);
        } catch {}
      }
    })();
  }, [customFonts]);

  useEffect(() => {
    (async () => {
      for (const fid of downloadedFontIds) {
        try {
          const def = FONT_MANIFEST.find((f) => f.id === fid);
          if (def && def.source === 'downloadable') {
            await reloadDownloadedFont(def, fid);
          }
        } catch {}
      }
      for (const cf of typoCustomFonts) {
        try {
          const blob = await getFontBlob(cf.assetId);
          if (blob) {
            await installCustomFont(cf.family, blob, cf.format, cf.weights[0] || 400);
          }
        } catch {}
      }
    })();
  }, []);

  useEffect(() => {
    const r = document.documentElement;
    ['--text', '--text-2', '--accent'].forEach((v, i) => {
      try {
        const key = ['lunartide_custom_text', 'lunartide_custom_text2', 'lunartide_custom_accent'][i];
        const cv = localStorage.getItem(key);
        if (cv) r.style.setProperty(v, cv);
        else r.style.removeProperty(v);
      } catch {}
    });
  }, []);

  useEffect(() => {
    injectAllZones();
    const h = () => injectAllZones();
    window.addEventListener('lunartide-css-updated', h);
    return () => window.removeEventListener('lunartide-css-updated', h);
  }, []);
}
