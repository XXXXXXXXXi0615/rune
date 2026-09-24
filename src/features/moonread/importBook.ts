import { saveMoonReadFile, saveMoonReadCover } from './assetHelper';
import { parseEpub } from './epubParser';
import type { MoonReadBook, MoonReadBookFormat, MoonReadImportError, MoonReadImportResult, MoonReadImportStatus } from './types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function detectMoonReadFormat(fileName: string): MoonReadBookFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.epub')) return 'epub';
  return null;
}

export function extractMoonReadTitle(fileName: string, text?: string): string {
  // Prefer first markdown H1 if available.
  if (text) {
    const h1 = /^#\s*(.+)$/m.exec(text);
    if (h1) return h1[1].trim().slice(0, 120);
  }

  const base = fileName.replace(/\.[^/.]+$/, '').trim();
  return base.slice(0, 120) || '未命名書籍';
}

export function extractMoonReadAuthor(text?: string): string {
  if (!text) return '未知作者';
  const m = /(?:作者|Author|By)[:：\s]+(.+)/im.exec(text);
  return m ? m[1].trim().slice(0, 80) : '未知作者';
}

export function countMoonReadWords(text: string): number {
  // Mixed Chinese + English heuristic.
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length;
  const latin = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  return cjk + latin;
}

export function stripFrontMatter(text: string): string {
  return text.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,2}|_{1,2}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/\n{2,}/g, '\n');
}

/** Generate a stable fallback cover SVG blob */
export function generateFallbackCover(title: string): Blob {
  const initials = title.slice(0, 1) || '書';
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:hsl(${hue},60%,24%)"/>
        <stop offset="100%" style="stop-color:hsl(${hue},50%,12%)"/>
      </linearGradient>
    </defs>
    <rect width="200" height="280" fill="url(#bg)"/>
    <text x="100" y="140" text-anchor="middle" dominant-baseline="central" fill="white" font-size="48" font-family="sans-serif">${initials}</text>
  </svg>`;

  return new Blob([svg], { type: 'image/svg+xml' });
}

/** Parse EPUB and return import result */
async function parseEpubFile(
  file: File,
  existingBooks: MoonReadBook[],
  onStatusChange?: (status: MoonReadImportStatus) => void,
): Promise<MoonReadImportResult | MoonReadImportError> {
  onStatusChange?.('reading');

  // Parse EPUB structure
  onStatusChange?.('parsing');
  const { manifest, cover, chapters, fingerprint } = await parseEpub(file);

  // Check for duplicate by fingerprint
  const duplicate = existingBooks.find((b) => b.fingerprint === fingerprint);
  if (duplicate) {
    onStatusChange?.('duplicate');
    return {
      code: 'duplicate',
      message: `這本書已經在書架裡：${duplicate.title}`,
      title: duplicate.title,
    };
  }

  // Extract metadata
  const title = manifest.metadata.title || extractMoonReadTitle(file.name);
  const author = manifest.metadata.creator || '未知作者';
  const description = manifest.metadata.description || '';

  // Save cover
  onStatusChange?.('extracting-cover');
  let coverAssetId: string | undefined;
  if (cover) {
    coverAssetId = await saveMoonReadCover(cover, title);
  } else {
    // Generate fallback cover
    const fallbackCover = generateFallbackCover(title);
    coverAssetId = await saveMoonReadCover(fallbackCover, title);
  }

  // Save source EPUB
  onStatusChange?.('saving');
  const sourceAssetId = await saveMoonReadFile(file);

  // Calculate word count from chapters
  const totalChars = chapters.reduce((sum, ch) => sum + ch.charCount, 0);

  const book: MoonReadBook = {
    id: crypto.randomUUID(),
    title,
    author,
    description: description.slice(0, 240).replace(/\n/g, ' '),
    format: 'epub',
    sourceAssetId,
    assetId: sourceAssetId, // Legacy alias
    fileName: file.name,
    wordCount: totalChars,
    importedAt: Date.now(),
    lastOpenedAt: Date.now(),
    progress: 0,
    coverAssetId,
    tags: [],
    language: manifest.metadata.language,
    identifier: manifest.metadata.identifier,
    publisher: manifest.metadata.publisher,
    fingerprint,
    importStatus: 'ready',
    sourceType: 'epub',
    libraryState: 'active',
  };

  onStatusChange?.('ready');

  // Build preview from first chapter
  const firstChapter = chapters[0];
  const preview = firstChapter
    ? firstChapter.html.replace(/<[^>]+>/g, '').slice(0, 500)
    : '';

  return { book, preview };
}

export async function parseMoonReadFile(
  file: File,
  existingBooks: MoonReadBook[],
  onStatusChange?: (status: MoonReadImportStatus) => void,
): Promise<MoonReadImportResult | MoonReadImportError> {
  const format = detectMoonReadFormat(file.name);
  if (!format) {
    return { code: 'unsupported', message: '不支援的格式，請上傳 .txt / .md / .epub' };
  }

  if (file.size === 0) {
    return { code: 'empty', message: '檔案為空' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { code: 'too_large', message: '檔案超過 50 MB 上限' };
  }

  try {
    if (format === 'epub') {
      return await parseEpubFile(file, existingBooks, onStatusChange);
    }

    // TXT/MD handling
    onStatusChange?.('reading');
    const text = await file.text();
    onStatusChange?.('parsing');

    const cleanText = format === 'md' ? stripMarkdown(stripFrontMatter(text)) : text;
    const title = extractMoonReadTitle(file.name, cleanText);
    const author = extractMoonReadAuthor(cleanText);
    const wordCount = countMoonReadWords(cleanText);

    // Check for duplicate by title+author+format
    const duplicate = existingBooks.find(
      (b) => b.title === title && b.author === author && b.format === format
    );
    if (duplicate) {
      onStatusChange?.('duplicate');
      return {
        code: 'duplicate',
        message: `已存在相同書籍：${title}`,
        title,
      };
    }

    onStatusChange?.('saving');
    const sourceAssetId = await saveMoonReadFile(file);
    const preview = cleanText.slice(0, 500);

    // Generate fallback cover
    const fallbackCover = generateFallbackCover(title);
    const coverAssetId = await saveMoonReadCover(fallbackCover, title);

    const book: MoonReadBook = {
      id: crypto.randomUUID(),
      title,
      author,
      description: cleanText.slice(0, 240).replace(/\n/g, ' '),
      format,
      sourceAssetId,
      assetId: sourceAssetId,
      fileName: file.name,
      wordCount,
      importedAt: Date.now(),
      lastOpenedAt: Date.now(),
      progress: 0,
      coverAssetId,
      tags: [],
      importStatus: 'ready',
      sourceType: 'local',
      libraryState: 'active',
    };

    onStatusChange?.('ready');
    return { book, preview };
  } catch (err) {
    onStatusChange?.('failed');
    return {
      code: 'parse_error',
      message: err instanceof Error ? err.message : '解析失敗',
      title: extractMoonReadTitle(file.name),
    };
  }
}
