/**
 * applyTypography — centralized typography application engine.
 *
 * Single source of truth for:
 *  - building CSS font-family stacks (family + fallbacks)
 *  - syncing TypographyStore → document.documentElement CSS variables
 *  - loading fonts via FontFace API before application
 *  - startup restoration (before splash removal)
 */

import { useTypographyStore } from '@/store/useTypographyStore';
import { getFontById, FONT_MANIFEST } from '@/features/typography/fontManifest';
import { getDefaultPreset } from '@/features/typography/typographyPresets';
import type { FontFamilyDefinition } from '@/features/typography/types';
import type { CustomFontRecord } from '@/features/typography/types';

/** Draft/applied typography shape — mirrors store fields relevant to CSS. */
export interface TypographyDraft {
  displayFontId: string;
  bodyFontId: string;
  monoFontId: string;
  displayWeight: number;
  bodyWeight: number;
  monoWeight: number;
  baseSize: number;
  lineHeight: number;
  letterSpacing: number;
}

/** Read current typography from store. */
export function getStoreDraft(): TypographyDraft {
  const s = useTypographyStore.getState();
  return {
    displayFontId: s.displayFontId,
    bodyFontId: s.bodyFontId,
    monoFontId: s.monoFontId,
    displayWeight: s.displayWeight,
    bodyWeight: s.bodyWeight,
    monoWeight: s.monoWeight,
    baseSize: s.baseSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
  };
}

/** Resolve a fontId to its CSS font-family name (including custom fonts). */
export function resolveFontName(fontId: string): string {
  // Check manifest first
  const def = getFontById(fontId);
  if (def) return def.family;

  // Check custom fonts in store
  const cf = useTypographyStore.getState().customFonts.find(c => c.id === fontId);
  if (cf) return cf.family;

  // Fallback: raw ID (shouldn't happen, but safe)
  return fontId;
}

/** Build a full CSS font-family stack for a given fontId.
 *  e.g. "Iansui", "PingFang TC", "Microsoft JhengHei", sans-serif
 */
export function buildFontStack(fontId: string): string {
  const def = getFontById(fontId);
  if (def) {
    const fallback = def.fallbackStack.join(', ');
    return `"${def.family}", ${fallback}`;
  }

  const cf = useTypographyStore.getState().customFonts.find(c => c.id === fontId);
  if (cf) {
    return `${cf.family}, sans-serif`;
  }

  // Unknown font — use safe fallback
  return `${fontId}, sans-serif`;
}

/** Get font definition by ID (manifest or custom record). */
export function getFontDef(fontId: string): FontFamilyDefinition | CustomFontRecord | undefined {
  const def = getFontById(fontId);
  if (def) return def;

  return useTypographyStore.getState().customFonts.find(c => c.id === fontId);
}

/** Clamp a requested weight to the nearest supported weight.
 *  Returns both the effective weight and whether it was clamped.
 */
export function clampWeight(
  fontId: string,
  requested: number,
): { effective: number; clamped: boolean } {
  const def = getFontDef(fontId);
  if (!def) return { effective: requested, clamped: false };

  // 'supportedWeights' exists on FontFamilyDefinition; CustomFontRecord has 'weights'
  const weights = 'supportedWeights' in def
    ? def.supportedWeights
    : ('weights' in def ? def.weights : [400]);

  if (weights.length === 0) return { effective: requested, clamped: false };

  let closest = weights[0];
  let minDiff = Math.abs(requested - closest);
  for (const w of weights) {
    const diff = Math.abs(requested - w);
    if (diff < minDiff) { minDiff = diff; closest = w; }
  }
  return { effective: closest, clamped: closest !== requested };
}

/* ── CSS Variable Sync ── */

const CSS_VARS = {
  display: '--font-display',
  body: '--font-body',
  mono: '--font-mono',
  displayWeight: '--font-display-weight',
  bodyWeight: '--font-body-weight',
  monoWeight: '--font-mono-weight',
  sizeBase: '--font-size-base',
  lineHeight: '--line-height-base',
  letterSpacing: '--letter-spacing-base',
  // Legacy compat
  fontSize: '--font-size',
} as const;

/** Sync all typography CSS variables to document.documentElement. */
export function syncRootCSS(draft: TypographyDraft): void {
  const root = document.documentElement;
  root.style.setProperty(CSS_VARS.display, buildFontStack(draft.displayFontId));
  root.style.setProperty(CSS_VARS.body, buildFontStack(draft.bodyFontId));
  root.style.setProperty(CSS_VARS.mono, buildFontStack(draft.monoFontId));
  root.style.setProperty(CSS_VARS.displayWeight, String(draft.displayWeight));
  root.style.setProperty(CSS_VARS.bodyWeight, String(draft.bodyWeight));
  root.style.setProperty(CSS_VARS.monoWeight, String(draft.monoWeight));
  root.style.setProperty(CSS_VARS.sizeBase, `${draft.baseSize}px`);
  root.style.setProperty(CSS_VARS.lineHeight, String(draft.lineHeight));
  root.style.setProperty(CSS_VARS.letterSpacing, `${draft.letterSpacing}em`);
  // Legacy
  root.style.setProperty(CSS_VARS.fontSize, `${draft.baseSize}px`);

  // Also set the preview-only --lt-* vars for backward compat with tokens.css chain
  root.style.setProperty('--lt-font-display', buildFontStack(draft.displayFontId));
  root.style.setProperty('--lt-font-body', buildFontStack(draft.bodyFontId));
  root.style.setProperty('--lt-font-mono', buildFontStack(draft.monoFontId));
  root.style.setProperty('--lt-font-size-base', `${draft.baseSize}px`);
  root.style.setProperty('--lt-line-height', String(draft.lineHeight));
  root.style.setProperty('--lt-letter-spacing', `${draft.letterSpacing}em`);
}

/* ── Font Loading ── */

/** Load a single font via FontFace API.
 *  Returns true if the font was loaded, false if it failed or was already loaded.
 */
export async function loadFontById(fontId: string, weight?: number): Promise<boolean> {
  const def = getFontDef(fontId);
  if (!def) return false;

  const family = 'family' in def ? def.family : (def as CustomFontRecord).family;

  // Check if already in document.fonts
  const alreadyLoaded = document.fonts.check(`1em "${family}"`);
  if (alreadyLoaded) return true;

  // Try loading via FontFace API from Google Fonts CSS or fontManifest assets
  try {
    // For fonts with downloadable assets, use the asset URL
    if ('assets' in def && def.assets?.[0]?.url) {
      const asset = def.assets[0];
      const font = new FontFace(family, `url(${asset.url})`, {
        weight: String(weight || asset.weight || 400),
        style: 'normal',
      });
      await font.load();
      document.fonts.add(font);
      return true;
    }

    // For system fonts or bundled fonts, try loading via Google Fonts API
    const gFontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.replace(/\s+/g, '+'))}:wght@${weight || 400}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = gFontUrl;
    document.head.appendChild(link);

    // Wait for font to load
    try {
      await document.fonts.load(`1em "${family}"`);
    } catch {
      // font may still load via link
    }

    document.fonts.check(`1em "${family}"`);
    return true;
  } catch {
    return false;
  }
}

/** Load all 3 role fonts in parallel. Non-blocking — errors are swallowed. */
export async function loadAppliedFonts(draft: TypographyDraft): Promise<void> {
  const results = await Promise.allSettled([
    loadFontById(draft.displayFontId, draft.displayWeight),
    loadFontById(draft.bodyFontId, draft.bodyWeight),
    loadFontById(draft.monoFontId, draft.monoWeight),
  ]);
  // log failures for debugging
  const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
  if (failed.length > 0 && import.meta.env.DEV) {
    console.warn('[typography] Some fonts failed to load:', failed.length, 'of 3');
  }
}

/* ── Public API ── */

/** Apply typography to the document root (CSS custom properties).
 *  Synchronous — no font loading. This is the single entry point that writes
 *  --font-display / --font-body / --font-mono / weights / sizes to
 *  document.documentElement so every shell, portal and modal inherits it.
 *  Called by: startup restore, live preview, apply, cancel, reset, unmount.
 */
export function applyTypographyToDocument(draft: TypographyDraft): void {
  syncRootCSS(draft);
}

/** Apply typography: sync CSS + load fonts.
 *  Called from settings page "apply" button.
 */
export async function applyTypography(draft: TypographyDraft): Promise<void> {
  applyTypographyToDocument(draft);
  await loadAppliedFonts(draft).catch(() => {});
}

/** Restore typography from persisted store at startup.
 *  Must be called before splash removal.
 *  Syncs CSS synchronously; font loading is async (non-blocking).
 */
export function restoreTypography(): void {
  const draft = getStoreDraft();
  applyTypographyToDocument(draft);
  // Fire font loading in background — don't block splash
  loadAppliedFonts(draft).catch(() => {});
}

/** Reset typography to default profile.
 *  Reads from getDefaultPreset(), not from store mutations.
 */
export function resetToDefaultTypography(): void {
  const preset = getDefaultPreset();
  const draft: TypographyDraft = {
    displayFontId: preset.displayFontId,
    bodyFontId: preset.bodyFontId,
    monoFontId: preset.monoFontId,
    displayWeight: preset.displayWeight,
    bodyWeight: preset.bodyWeight,
    monoWeight: preset.monoWeight,
    baseSize: preset.baseSize,
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
  };
  applyTypographyToDocument(draft);
  loadAppliedFonts(draft).catch(() => {});
}
