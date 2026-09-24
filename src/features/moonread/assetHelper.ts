import { saveAsset, getAsset } from '@/store/assets';

/**
 * Save a raw imported file into the unified asset store.
 * Returns the generated assetId.
 */
export async function saveMoonReadFile(file: File): Promise<string> {
  const assetId = await saveAsset(file, file.type);
  return assetId;
}

/**
 * Save a cover image blob into the unified asset store.
 * Returns the generated assetId.
 */
export async function saveMoonReadCover(cover: Blob, title: string): Promise<string> {
  const assetId = await saveAsset(cover, cover.type || 'image/jpeg');
  return assetId;
}

/**
 * Read a book file back as text. TXT/MD are decoded directly.
 * EPUB returns the raw zip-like blob (caller must parse with JSZip or fallback).
 */
export async function loadMoonReadFile(
  assetId: string
): Promise<{ text: string | null; blob: Blob }> {
  const blob = await getAsset(assetId);
  if (!blob) {
    throw new Error(`MoonRead asset not found: ${assetId}`);
  }

  if (blob.type === 'application/epub+zip' || (blob as File).name?.endsWith('.epub')) {
    return { text: null, blob };
  }

  const text = await blob.text();
  return { text, blob };
}

/**
 * Load a cover image blob from the asset store.
 * Returns null if not found.
 */
export async function loadMoonReadCover(
  coverAssetId: string
): Promise<Blob | null> {
  return getAsset(coverAssetId);
}

export function formatMoonReadWordCount(count: number): string {
  if (count >= 100000) {
    return `${(count / 10000).toFixed(1)} 萬字`;
  }
  if (count >= 10000) {
    return `${Math.round(count / 10000)} 萬字`;
  }
  return `${count.toLocaleString()} 字`;
}

export function estimateMoonReadReadMinutes(wordCount: number): number {
  // ~350 CPM for Chinese, ~200 WPM for English mixed content.
  // Use a conservative blended rate.
  return Math.max(1, Math.round(wordCount / 300));
}
