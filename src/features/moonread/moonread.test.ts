import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectMoonReadFormat, extractMoonReadTitle, extractMoonReadAuthor, countMoonReadWords, stripMarkdown, generateFallbackCover } from './importBook';
import { sanitizeHtml, isPathSafe, parseContainerXml, parseOpfMetadata } from './epubParser';

// Mock the asset store
vi.mock('@/store/assets', () => ({
  saveAsset: vi.fn(async () => 'asset-id-mocked'),
  getAsset: vi.fn(async () => null),
  deleteAsset: vi.fn(async () => {}),
  deleteAssets: vi.fn(async () => {}),
}));

const STORAGE_KEY = 'lunartide-moonread-v1';

describe('MoonRead importBook helpers', () => {
  it('detects supported formats', () => {
    expect(detectMoonReadFormat('story.txt')).toBe('txt');
    expect(detectMoonReadFormat('notes.md')).toBe('md');
    expect(detectMoonReadFormat('book.epub')).toBe('epub');
    expect(detectMoonReadFormat('image.png')).toBeNull();
  });

  it('extracts title from markdown H1', () => {
    const text = '# 月潮物語\n\n第一章';
    expect(extractMoonReadTitle('file.txt', text)).toBe('月潮物語');
  });

  it('falls back to filename for title', () => {
    expect(extractMoonReadTitle('my-story.txt')).toBe('my-story');
  });

  it('extracts author from text markers', () => {
    expect(extractMoonReadAuthor('作者：林夕\n正文')).toBe('林夕');
    expect(extractMoonReadAuthor('Author: Jane Doe')).toBe('Jane Doe');
  });

  it('counts CJK + Latin words', () => {
    expect(countMoonReadWords('今天天气很好 hello world')).toBe(8);
  });

  it('strips markdown syntax', () => {
    expect(stripMarkdown('# Title\n**bold** [link](url)')).toContain('Title');
    expect(stripMarkdown('**bold**')).toContain('bold');
  });

  it('generates fallback cover SVG', () => {
    const blob = generateFallbackCover('測試書名');
    expect(blob.type).toBe('image/svg+xml');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('generates stable fallback cover for same title', () => {
    const blob1 = generateFallbackCover('穩定測試');
    const blob2 = generateFallbackCover('穩定測試');
    expect(blob1.size).toBe(blob2.size);
  });
});

describe('EPUB Parser Security', () => {
  it('sanitizeHtml removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('sanitizeHtml removes event handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  it('sanitizeHtml blocks javascript: URLs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('blocked:');
  });

  it('sanitizeHtml removes iframe/object/embed', () => {
    const input = '<iframe src="x"></iframe><object data="x"></object><embed src="x">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('isPathSafe blocks path traversal', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
    expect(isPathSafe('/absolute/path')).toBe(false);
    expect(isPathSafe('C:\\windows')).toBe(false);
    expect(isPathSafe('valid/path/file.xhtml')).toBe(true);
  });

  it('parseContainerXml extracts rootfile path', () => {
    const xml = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>';
    const result = parseContainerXml(xml);
    expect(result).toBe('OEBPS/content.opf');
  });

  it('parseContainerXml rejects path traversal', () => {
    const xml = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="../../../etc/passwd"/></rootfiles></container>';
    const result = parseContainerXml(xml);
    expect(result).toBeNull();
  });

  it('parseOpfMetadata extracts metadata', () => {
    const opf = `<package xmlns:dc="http://purl.org/dc/elements/1.1/">
      <metadata>
        <dc:title>測試書名</dc:title>
        <dc:creator>作者名</dc:creator>
        <dc:language>zh-TW</dc:language>
        <dc:identifier>isbn-123</dc:identifier>
        <dc:publisher>出版社</dc:publisher>
        <dc:description>簡介</dc:description>
      </metadata>
    </package>`;
    const result = parseOpfMetadata(opf);
    expect(result.title).toBe('測試書名');
    expect(result.creator).toBe('作者名');
    expect(result.language).toBe('zh-TW');
    expect(result.identifier).toBe('isbn-123');
    expect(result.publisher).toBe('出版社');
    expect(result.description).toBe('簡介');
  });

  it('parseOpfMetadata handles missing fields gracefully', () => {
    const opf = '<package><metadata></metadata></package>';
    const result = parseOpfMetadata(opf);
    expect(result.title).toBe('');
    expect(result.creator).toBe('');
    expect(result.language).toBe('');
  });
});

describe('MoonRead store actions', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.removeItem(STORAGE_KEY);
  });

  it('imports a txt book and stores metadata without the blob', async () => {
    const { useMoonReadStore } = await import('./useMoonReadStore');
    const file = new File(['第一章 月潮'], 'moon-tide.txt', { type: 'text/plain' });
    const result = await useMoonReadStore.getState().importBook(file);
    expect('book' in result).toBe(true);
    if (!('book' in result)) return;
    expect(result.book.title).toBe('moon-tide');
    expect(result.book.format).toBe('txt');
    expect(result.book.sourceAssetId).toBe('asset-id-mocked');
    expect(useMoonReadStore.getState().books.length).toBe(1);
    expect(useMoonReadStore.getState().books[0].sourceAssetId).toBe('asset-id-mocked');
  });

  it('rejects unsupported formats', async () => {
    const { useMoonReadStore } = await import('./useMoonReadStore');
    const file = new File(['data'], 'image.png', { type: 'image/png' });
    const result = await useMoonReadStore.getState().importBook(file);
    expect('code' in result && result.code).toBe('unsupported');
  });

  it('rejects duplicate books', async () => {
    const { useMoonReadStore } = await import('./useMoonReadStore');
    const file = new File(['第一章'], 'same.txt', { type: 'text/plain' });
    await useMoonReadStore.getState().importBook(file);
    const duplicate = new File(['第二章'], 'same.txt', { type: 'text/plain' });
    const result = await useMoonReadStore.getState().importBook(duplicate);
    expect('code' in result && result.code).toBe('duplicate');
  });

  it('updates reading session and book progress', async () => {
    const { useMoonReadStore } = await import('./useMoonReadStore');
    const file = new File(['第一章 月潮 第二章 潮汐'], 'progress.txt', { type: 'text/plain' });
    const { book } = await useMoonReadStore.getState().importBook(file) as { book: { id: string } };
    useMoonReadStore.getState().updateSession(book.id, 5, 20, 0);
    expect(useMoonReadStore.getState().sessions[book.id].position).toBe(5);
    expect(useMoonReadStore.getState().books.find((b) => b.id === book.id)?.progress).toBe(0.25);
  });

  it('sets import status during import', async () => {
    const { useMoonReadStore } = await import('./useMoonReadStore');
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    // Check initial status
    expect(useMoonReadStore.getState().importStatus).toBe('idle');

    // Start import
    const importPromise = useMoonReadStore.getState().importBook(file);

    // Status should change during import
    await importPromise;

    // After completion, status should be ready
    expect(useMoonReadStore.getState().importStatus).toBe('ready');
  });
});
