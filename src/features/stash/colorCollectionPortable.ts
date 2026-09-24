import type { RuneStashColorCollectionItem } from './useRuneStashStore';

export const RUNE_COLOR_COLLECTION_FORMAT = 'rune-color-collection' as const;
export const RUNE_COLOR_COLLECTION_VERSION = 1 as const;
export const RUNE_COLOR_COLLECTION_MAX_FILE_BYTES = 256 * 1024;
export const RUNE_COLOR_COLLECTION_MAX_SWATCHES = 128;

export interface PortableColorSwatch {
  name: string;
  hex: string;
  note?: string;
}

export interface PortableColorCollection {
  title: string;
  subtitle: string;
  tags: string[];
  swatches: PortableColorSwatch[];
}

export interface RuneColorCollectionDocument {
  format: typeof RUNE_COLOR_COLLECTION_FORMAT;
  version: typeof RUNE_COLOR_COLLECTION_VERSION;
  collection: PortableColorCollection;
}

const HEX = /^#[0-9A-F]{6}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value: string) => value.trim();
const normalizeHex = (value: string) => cleanText(value).toUpperCase();

export function toPortableColorCollection(item: RuneStashColorCollectionItem): RuneColorCollectionDocument {
  return {
    format: RUNE_COLOR_COLLECTION_FORMAT,
    version: RUNE_COLOR_COLLECTION_VERSION,
    collection: {
      title: cleanText(item.title || item.value),
      subtitle: cleanText(item.note || ''),
      tags: item.tags.map(cleanText).filter(Boolean),
      swatches: item.swatches.map((swatch) => ({
        name: cleanText(swatch.name),
        hex: normalizeHex(swatch.hex),
        ...(swatch.note?.trim() ? { note: swatch.note.trim() } : {}),
      })),
    },
  };
}

export function serializeColorCollection(item: RuneStashColorCollectionItem): string {
  return `${JSON.stringify(toPortableColorCollection(item), null, 2)}\n`;
}

export function parseColorCollectionDocument(source: string): RuneColorCollectionDocument {
  let input: unknown;
  try { input = JSON.parse(source); } catch { throw new Error('檔案不是有效的 JSON。'); }
  if (!isRecord(input)) throw new Error('色卡集檔案結構無效。');
  if (input.format !== RUNE_COLOR_COLLECTION_FORMAT) throw new Error('不支援的色卡集格式。');
  if (input.version !== RUNE_COLOR_COLLECTION_VERSION) throw new Error('不支援的色卡集版本。');
  if (!isRecord(input.collection)) throw new Error('缺少色卡集內容。');
  const { title, subtitle = '', tags = [], swatches } = input.collection;
  if (typeof title !== 'string' || !title.trim()) throw new Error('色卡集必須有名稱。');
  if (typeof subtitle !== 'string') throw new Error('副標題格式無效。');
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) throw new Error('標籤格式無效。');
  if (!Array.isArray(swatches) || swatches.length === 0) throw new Error('色卡集至少需要一個色票。');
  if (swatches.length > RUNE_COLOR_COLLECTION_MAX_SWATCHES) throw new Error(`色票數量不可超過 ${RUNE_COLOR_COLLECTION_MAX_SWATCHES}。`);
  const normalizedSwatches = swatches.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`第 ${index + 1} 個色票格式無效。`);
    if (typeof candidate.name !== 'string' || !candidate.name.trim()) throw new Error(`第 ${index + 1} 個色票缺少名稱。`);
    if (typeof candidate.hex !== 'string' || !HEX.test(candidate.hex.trim())) throw new Error(`第 ${index + 1} 個色票 HEX 無效。`);
    if (candidate.note !== undefined && typeof candidate.note !== 'string') throw new Error(`第 ${index + 1} 個色票備註格式無效。`);
    return {
      name: candidate.name.trim(),
      hex: normalizeHex(candidate.hex),
      ...(candidate.note?.trim() ? { note: candidate.note.trim() } : {}),
    };
  });
  return {
    format: RUNE_COLOR_COLLECTION_FORMAT,
    version: RUNE_COLOR_COLLECTION_VERSION,
    collection: {
      title: title.trim(),
      subtitle: subtitle.trim(),
      tags: Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))),
      swatches: normalizedSwatches,
    },
  };
}

export function colorCollectionHexList(item: RuneStashColorCollectionItem): string {
  return item.swatches.map((swatch) => normalizeHex(swatch.hex)).join('\n');
}

export function cssVariableSlug(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function colorCollectionCssVariables(item: RuneStashColorCollectionItem): string {
  const used = new Map<string, number>();
  const lines = item.swatches.map((swatch, index) => {
    const base = cssVariableSlug(swatch.name) || `color-${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return `  --${base}${count > 1 ? `-${count}` : ''}: ${normalizeHex(swatch.hex)};`;
  });
  return `:root {\n${lines.join('\n')}\n}`;
}

export function colorCollectionMarkdown(item: RuneStashColorCollectionItem): string {
  const title = cleanText(item.title || item.value);
  const meta = [item.note?.trim(), item.tags.length ? item.tags.map((tag) => tag.trim()).filter(Boolean).map((tag) => `#${tag}`).join(' ') : ''].filter(Boolean);
  const rows = item.swatches.map((swatch) => `| ${cleanText(swatch.name).replace(/\|/g, '\\|')} | \`${normalizeHex(swatch.hex)}\` |`);
  return [`# ${title}`, ...meta.map((line) => `\n${line}`), '', '| Color | HEX |', '| --- | --- |', ...rows].join('\n');
}

export function colorCollectionFilename(item: RuneStashColorCollectionItem): string {
  const slug = cssVariableSlug(item.title || item.value) || 'rune-color-collection';
  return `${slug}.rune-colors.json`;
}
