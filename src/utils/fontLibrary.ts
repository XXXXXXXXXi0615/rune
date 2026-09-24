/**
 * fontLibrary.ts — Dynamic Font Registration + Management
 *
 * Supports:
 *   - System fonts (already installed, listed for reference)
 *   - Google Fonts (fetched + registered via FontFace API)
 *   - Custom fonts (.ttf/.otf/.woff/.woff2 uploaded to IndexedDB)
 *
 * Uses FontFace API + document.fonts.add() for runtime registration.
 */

import { saveAsset, getAsset, deleteAsset } from '@/store/assets';

// ── Types ──

export type FontCategory = 'system' | 'google' | 'custom';
export type FontRole = 'display' | 'body' | 'mono';

export interface CustomFont {
  id: string;
  name: string;
  category: FontCategory;
  fontFamily: string;       // CSS font-family value to use
  assetId?: string;         // IndexedDB key (custom fonts only)
  url?: string;             // Google Fonts CDN URL
  format?: 'truetype' | 'opentype' | 'woff' | 'woff2';
  weight?: string;
  style?: string;
  createdAt: number;
}

// ── System Fonts (reference list for the picker) ──

export const SYSTEM_DISPLAY_FONTS: Omit<CustomFont, 'id' | 'createdAt'>[] = [
  { name: 'Cormorant Garamond', category: 'system', fontFamily: "'Cormorant Garamond', serif" },
  { name: 'Noto Serif SC', category: 'system', fontFamily: "'Noto Serif SC', serif" },
  { name: 'Source Han Serif SC', category: 'system', fontFamily: "'Source Han Serif SC', serif" },
  { name: 'Lora', category: 'system', fontFamily: "'Lora', serif" },
  { name: 'Playfair Display', category: 'system', fontFamily: "'Playfair Display', serif" },
  { name: 'EB Garamond', category: 'system', fontFamily: "'EB Garamond', serif" },
  { name: 'Georgia', category: 'system', fontFamily: "Georgia, 'Times New Roman', serif" },
];

export const SYSTEM_BODY_FONTS: Omit<CustomFont, 'id' | 'createdAt'>[] = [
  { name: 'Inter', category: 'system', fontFamily: "'Inter', sans-serif" },
  { name: 'Noto Sans SC', category: 'system', fontFamily: "'Noto Sans SC', sans-serif" },
  { name: 'Source Han Sans SC', category: 'system', fontFamily: "'Source Han Sans SC', sans-serif" },
  { name: 'Manrope', category: 'system', fontFamily: "'Manrope', sans-serif" },
  { name: 'DM Sans', category: 'system', fontFamily: "'DM Sans', sans-serif" },
  { name: 'Helvetica Neue', category: 'system', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
];

export const SYSTEM_MONO_FONTS: Omit<CustomFont, 'id' | 'createdAt'>[] = [
  { name: 'JetBrains Mono', category: 'system', fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
  { name: 'Cascadia Code', category: 'system', fontFamily: "'Cascadia Code', 'Fira Code', monospace" },
  { name: 'Source Code Pro', category: 'system', fontFamily: "'Source Code Pro', monospace" },
  { name: 'SF Mono', category: 'system', fontFamily: "'SF Mono', 'Menlo', monospace" },
];

// ── FontFace Registration ──

const _registeredFonts = new Set<string>();

/** Register a font via FontFace API from a Blob (custom upload). */
export async function registerCustomFont(
  name: string,
  blob: Blob,
  format: 'truetype' | 'opentype' | 'woff' | 'woff2',
  weight = '400',
  style = 'normal',
): Promise<string> {
  const url = URL.createObjectURL(blob);
  const fontFamily = `"${name}"`;

  try {
    const font = new FontFace(fontFamily, `url(${url})`, {
      weight, style,
    });
    const loaded = await font.load();
    document.fonts.add(loaded);

    // Keep the object URL alive — don't revoke while font is in use
    _registeredFonts.add(fontFamily);

    return fontFamily;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Register a Google Font from a CDN URL. */
export async function registerGoogleFont(
  name: string,
  url: string,
  weight = '400',
  style = 'normal',
): Promise<string> {
  const fontFamily = `"${name}"`;

  try {
    const font = new FontFace(fontFamily, `url(${url})`, {
      weight, style,
    });
    const loaded = await font.load();
    document.fonts.add(loaded);
    _registeredFonts.add(fontFamily);

    return fontFamily;
  } catch (err) {
    console.warn(`[FontLibrary] Failed to register Google Font "${name}":`, err);
    throw err;
  }
}

/** Re-register a custom font from IndexedDB (on app startup). */
export async function reloadCustomFont(
  name: string,
  assetId: string,
  format: 'truetype' | 'opentype' | 'woff' | 'woff2',
  weight = '400',
  style = 'normal',
): Promise<string | null> {
  try {
    const blob = await getAsset(assetId);
    if (!blob) return null;
    return registerCustomFont(name, blob, format, weight, style);
  } catch {
    return null;
  }
}

/** Check if a font family name is already registered. */
export function isFontRegistered(fontFamily: string): boolean {
  return _registeredFonts.has(fontFamily);
}

// ── Upload helpers ──

const FONT_EXTENSIONS: Record<string, 'truetype' | 'opentype' | 'woff' | 'woff2'> = {
  '.ttf': 'truetype',
  '.otf': 'opentype',
  '.woff': 'woff',
  '.woff2': 'woff2',
};

function getFontFormat(filename: string): 'truetype' | 'opentype' | 'woff' | 'woff2' | null {
  const lower = filename.toLowerCase();
  for (const [ext, fmt] of Object.entries(FONT_EXTENSIONS)) {
    if (lower.endsWith(ext)) return fmt;
  }
  return null;
}

/** Upload a font file: save to IndexedDB, register via FontFace, return metadata. */
export async function uploadCustomFont(file: File): Promise<CustomFont> {
  const format = getFontFormat(file.name);
  if (!format) throw new Error(`Unsupported font format: ${file.name}`);

  // Save blob to IndexedDB
  const assetId = await saveAsset(file, `font/${format}`);

  // Register the font
  const name = file.name.replace(/\.[^.]+$/, '');
  const fontFamily = await registerCustomFont(name, file, format);

  return {
    id: crypto.randomUUID(),
    name,
    category: 'custom',
    fontFamily,
    assetId,
    format,
    weight: '400',
    style: 'normal',
    createdAt: Date.now(),
  };
}

/** Delete a custom font: unregister + remove from IndexedDB. */
export async function deleteCustomFont(font: CustomFont): Promise<void> {
  if (font.assetId) {
    await deleteAsset(font.assetId).catch(() => {});
  }
  _registeredFonts.delete(font.fontFamily);
}

// ── Preview text ──

export const FONT_PREVIEW_TEXT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz';
export const FONT_PREVIEW_CJK = '月潮如詩 溫柔地記錄每一個當下 今天也慢慢來';
export const FONT_PREVIEW_DIGITS = '0123456789 ½ ¼ ¾';
export const FONT_PREVIEW_PUNCT = '「」『』、。！？；：（）—…·';
