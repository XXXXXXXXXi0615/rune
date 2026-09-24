import type { FontFamilyDefinition, FontStatus } from './types';
import { getFontBlob, saveFontBlob, deleteFontBlob } from './fontStorage';

const REGISTERED_FONTS = new Map<string, FontFace>();

export function isFontRegistered(family: string): boolean {
  return REGISTERED_FONTS.has(family);
}

export function getRegisteredFont(family: string): FontFace | undefined {
  return REGISTERED_FONTS.get(family);
}

async function registerFontFromBlob(
  family: string,
  blob: Blob,
  format: string,
  weight: number,
  style: 'normal' | 'italic' = 'normal',
): Promise<FontFace> {
  const url = URL.createObjectURL(blob);
  const formatHint = format === 'woff2' ? 'woff2' : format === 'woff' ? 'woff' : format === 'ttf' ? 'truetype' : 'opentype';
  const font = new FontFace(family, `url(${url}) format('${formatHint}')`, {
    weight: String(weight),
    style,
  });
  try {
    const loaded = await font.load();
    document.fonts.add(loaded);
    REGISTERED_FONTS.set(family, loaded);
    URL.revokeObjectURL(url);
    return loaded;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function loadBundledFont(def: FontFamilyDefinition, weight = 400): Promise<FontStatus> {
  if (isFontRegistered(def.family)) return 'available';
  try {
    await document.fonts.load(`${weight} 16px "${def.family}"`);
    return 'available';
  } catch {
    return 'failed';
  }
}

export async function downloadAndRegisterFont(
  def: FontFamilyDefinition,
  downloadUrl: string,
  format: 'woff2' | 'woff' | 'ttf' | 'otf',
  assetId: string,
  weight = 400,
): Promise<FontStatus> {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    await saveFontBlob(assetId, blob, format);
    await registerFontFromBlob(def.family, blob, format, weight);
    return 'available';
  } catch {
    try { await deleteFontBlob(assetId); } catch {}
    return 'failed';
  }
}

export async function reloadDownloadedFont(def: FontFamilyDefinition, assetId: string, weight = 400): Promise<FontStatus> {
  if (isFontRegistered(def.family)) return 'available';

  try {
    const blob = await getFontBlob(assetId);
    if (!blob) return 'not-downloaded';
    await registerFontFromBlob(def.family, blob, 'woff2', weight);
    return 'available';
  } catch {
    return 'failed';
  }
}

export async function installCustomFont(
  family: string,
  blob: Blob,
  format: 'woff2' | 'woff' | 'ttf' | 'otf',
  weight = 400,
): Promise<FontFace> {
  return registerFontFromBlob(family, blob, format, weight);
}

export function unregisterFont(family: string): void {
  const font = REGISTERED_FONTS.get(family);
  if (font) {
    try { document.fonts.delete(font); } catch {}
    REGISTERED_FONTS.delete(family);
  }
}

export function buildFontStack(def: FontFamilyDefinition | undefined, cjkDef?: FontFamilyDefinition): string {
  if (!def && !cjkDef) return 'sans-serif';
  if (!def) return cjkDef ? `"${cjkDef.family}", ${cjkDef.fallbackStack.join(', ')}` : 'sans-serif';

  const parts: string[] = [`"${def.family}"`];

  if (cjkDef && cjkDef.id !== def.id) {
    parts.push(`"${cjkDef.family}"`);
  }

  parts.push(...def.fallbackStack);

  return parts.join(', ');
}

export function buildSafeFontStack(
  family: string | undefined,
  fallback: string,
  cjkFamily?: string,
  cjkFallback?: string,
): string {
  const parts: string[] = [];
  if (family) parts.push(`"${family}"`);
  if (cjkFamily && cjkFamily !== family) parts.push(`"${cjkFamily}"`);
  parts.push(fallback);
  if (cjkFallback) parts.push(cjkFallback);
  return parts.join(', ');
}
