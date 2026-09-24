/**
 * EPUB Parser — container.xml, OPF metadata, cover extraction
 * Security-first: sanitizes HTML, blocks scripts, limits sizes
 */

import JSZip from 'jszip';
import type { EpubManifest, EpubChapter, EpubSpineItem, EpubTocItem } from './types';
import { EpubResourceResolver, normalizeEpubPath, getDirectory, isSafeUrl, isRemoteUrl } from './epub/EpubResourceResolver';

const MAX_FILES_IN_ZIP = 1000;
const MAX_CHAPTER_SIZE = 5 * 1024 * 1024; // 5 MB per chapter

/** Security: block javascript: URLs and script tags */
export function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  // Block javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, 'blocked:');
  // Remove iframe/object/embed
  sanitized = sanitized.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^>]*>.*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');
  return sanitized;
}

/** Security: check for path traversal */
export function isPathSafe(path: string): boolean {
  if (path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return true;
}

/** Parse container.xml to get rootfile path */
export function parseContainerXml(xml: string): string | null {
  const match = /full-path\s*=\s*["']([^"']+)["']/i.exec(xml);
  if (!match) return null;
  const path = match[1].trim();
  return isPathSafe(path) ? path : null;
}

/** Parse OPF metadata section */
export function parseOpfMetadata(opfXml: string): EpubManifest['metadata'] {
  const getTag = (tag: string): string => {
    const match = new RegExp(`<[^:]*:${tag}[^>]*>([^<]*)<\\/[^:]*:${tag}>`, 'i').exec(opfXml);
    return match ? match[1].trim() : '';
  };

  return {
    title: getTag('title') || '',
    creator: getTag('creator') || '',
    language: getTag('language') || '',
    identifier: getTag('identifier') || '',
    publisher: getTag('publisher') || '',
    description: getTag('description') || '',
  };
}

/** Parse OPF manifest to get spine items and cover */
function parseOpfManifest(opfXml: string, basePath: string): { items: Map<string, EpubSpineItem>; coverId: string | null; coverHref: string | null } {
  const items = new Map<string, EpubSpineItem>();
  const itemRegex = /<item\s+([^>]*?)\/?\s*>/gi;
  let match: RegExpExecArray | null;
  let coverId: string | null = null;
  let coverHref: string | null = null;

  while ((match = itemRegex.exec(opfXml)) !== null) {
    const attrs = match[1];
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const mediaMatch = /\bmedia-type\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const propsMatch = /\bproperties\s*=\s*["']([^"']+)["']/i.exec(attrs);

    if (!idMatch || !hrefMatch) continue;

    const id = idMatch[1];
    const href = hrefMatch[1];
    const mediaType = mediaMatch ? mediaMatch[1] : '';
    const props = propsMatch ? propsMatch[1] : '';

    // Priority 1: properties="cover-image"
    if (props.includes('cover-image')) {
      coverId = id;
      coverHref = href;
    }

    // Priority 2: id contains "cover" (lowercase)
    if (!coverId && id.toLowerCase().includes('cover') && mediaType.startsWith('image/')) {
      coverId = id;
      coverHref = href;
    }

    items.set(id, { id, href, mediaType, order: 0 });
  }

  // Priority 3: meta name="cover" (if not found yet)
  if (!coverId) {
    const metaCoverMatch = /<meta\s+[^>]*name\s*=\s*["']cover["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(opfXml);
    if (metaCoverMatch) {
      const contentId = metaCoverMatch[1];
      const item = items.get(contentId);
      if (item) {
        coverId = contentId;
        coverHref = item.href;
      }
    }
  }

  // Parse spine for order
  const spineRegex = /<itemref\s+idref\s*=\s*["']([^"']+)["']\s*\/?\s*>/gi;
  let order = 0;
  while ((match = spineRegex.exec(opfXml)) !== null) {
    const idref = match[1];
    const item = items.get(idref);
    if (item) {
      item.order = order++;
    }
  }

  return { items, coverId, coverHref };
}

/** Extract cover image from EPUB with priority chain */
async function extractCover(
  zip: JSZip,
  manifest: EpubManifest,
  coverId: string | null,
  coverHref: string | null
): Promise<Blob | null> {
  // Priority 1: properties="cover-image"
  if (coverHref) {
    const coverPath = normalizeEpubPath(coverHref, manifest.basePath);
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      try {
        const blob = await coverFile.async('blob');
        if (blob.type.startsWith('image/') || blob.size > 100) {
          return new Blob([blob], { type: blob.type || 'image/jpeg' });
        }
      } catch {
        // Continue to next priority
      }
    }
  }

  // Priority 2: meta name="cover" or id contains "cover"
  if (coverId) {
    const coverItem = manifest.spine.find((item: EpubSpineItem) => item.id === coverId);
    if (coverItem) {
      const coverPath = normalizeEpubPath(coverItem.href, manifest.basePath);
      const coverFile = zip.file(coverPath);
      if (coverFile) {
        try {
          const blob = await coverFile.async('blob');
          return new Blob([blob], { type: coverItem.mediaType || 'image/jpeg' });
        } catch {
          // Continue to next priority
        }
      }
    }
  }

  // Priority 3: guide type="cover"
  const guideMatch = /<guide\s+[^>]*type\s*=\s*["']cover["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec('');
  if (guideMatch) {
    const guidePath = normalizeEpubPath(guideMatch[1], manifest.basePath);
    const guideFile = zip.file(guidePath);
    if (guideFile) {
      try {
        const blob = await guideFile.async('blob');
        return new Blob([blob], { type: 'image/jpeg' });
      } catch {
        // Continue to next priority
      }
    }
  }

  // Priority 4: title page first reasonable image
  const firstSpineItem = manifest.spine[0];
  if (firstSpineItem) {
    const chapterPath = normalizeEpubPath(firstSpineItem.href, manifest.basePath);
    const chapterFile = zip.file(chapterPath);
    if (chapterFile) {
      try {
        const html = await chapterFile.async('text');
        const imgMatch = /<img\s+[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html);
        if (imgMatch) {
          const imgSrc = imgMatch[1];
          if (isSafeUrl(imgSrc) && !isRemoteUrl(imgSrc)) {
            const imgPath = normalizeEpubPath(imgSrc, getDirectory(chapterPath));
            const imgFile = zip.file(imgPath);
            if (imgFile) {
              const blob = await imgFile.async('blob');
              if (blob.size > 100) {
                return new Blob([blob], { type: blob.type || 'image/jpeg' });
              }
            }
          }
        }
      } catch {
        // Continue to fallback
      }
    }
  }

  return null;
}

/** Main EPUB parser */
export async function parseEpub(file: File): Promise<{
  manifest: EpubManifest;
  cover: Blob | null;
  chapters: EpubChapter[];
  fingerprint: string;
  resolver: EpubResourceResolver;
}> {
  // Validate file size
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('EPUB 檔案超過 50 MB 上限');
  }

  // Load ZIP
  const zip = await JSZip.loadAsync(file);

  // Security: check file count
  const fileCount = Object.keys(zip.files).length;
  if (fileCount > MAX_FILES_IN_ZIP) {
    throw new Error('EPUB 包含過多檔案');
  }

  // Parse container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('缺少 META-INF/container.xml');
  }

  const containerXml = await containerFile.async('text');
  const rootfilePath = parseContainerXml(containerXml);
  if (!rootfilePath) {
    throw new Error('無法解析 container.xml');
  }

  // Security: validate rootfile path
  if (!isPathSafe(rootfilePath)) {
    throw new Error('container.xml 包含不安全路徑');
  }

  // Parse OPF
  const opfFile = zip.file(rootfilePath);
  if (!opfFile) {
    throw new Error(`找不到 OPF 檔案: ${rootfilePath}`);
  }

  const opfXml = await opfFile.async('text');
  const metadata = parseOpfMetadata(opfXml);
  const basePath = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/')) : '';
  const { items, coverId, coverHref } = parseOpfManifest(opfXml, basePath);

  // Build spine
  const spine: EpubSpineItem[] = Array.from(items.values())
    .filter(item => item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html')
    .sort((a, b) => a.order - b.order);

  // Extract cover with priority chain
  const cover = await extractCover(zip, { metadata, spine, toc: [], coverHref: null, basePath }, coverId, coverHref);

  // Generate fingerprint (SHA-256 of file content)
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Load chapters with resource resolution
  const resolver = new EpubResourceResolver(zip, basePath);
  const chapters: EpubChapter[] = [];

  for (const item of spine) {
    const chapterPath = normalizeEpubPath(item.href, basePath);
    const chapterFile = zip.file(chapterPath);

    if (!chapterFile) continue;

    try {
      let html = await chapterFile.async('text');

      // Security: sanitize HTML first
      html = sanitizeHtml(html);

      // Resolve resource references (img src, link href, style url())
      html = await resolver.resolveHtml(html);

      // Security: check chapter size
      if (html.length > MAX_CHAPTER_SIZE) {
        html = html.substring(0, MAX_CHAPTER_SIZE);
      }

      // Extract title from HTML
      const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
      const h1Match = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i.exec(html);
      const title = titleMatch?.[1]?.trim() || h1Match?.[1]?.trim() || `第 ${chapters.length + 1} 章`;

      // Check if chapter has meaningful content
      const textContent = html.replace(/<[^>]+>/g, '').trim();
      const hasContent = textContent.length > 0;

      chapters.push({
        id: item.id,
        title,
        html,
        charCount: textContent.length,
      });
    } catch {
      // Skip malformed chapters
      continue;
    }
  }

  return {
    manifest: {
      metadata,
      spine,
      toc: [],
      coverHref: coverHref || null,
      basePath,
    },
    cover,
    chapters,
    fingerprint,
    resolver,
  };
}

/** Load TOC from EPUB (async) */
export async function loadEpubToc(file: File, basePath: string): Promise<EpubTocItem[]> {
  const zip = await JSZip.loadAsync(file);

  // Try to find NCX
  const ncxFiles = zip.filter((path) => path.endsWith('.ncx'));
  if (ncxFiles.length === 0) return [];

  const ncxFile = ncxFiles[0];
  const ncxXml = await ncxFile.async('text');

  const items: EpubTocItem[] = [];
  const navPointRegex = /<navPoint[^>]*>[\s\S]*?<text>([^<]+)<\/text>[\s\S]*?<content\s+src\s*=\s*["']([^"']+)["'][^>]*\/?\s*>[\s\S]*?<\/navPoint>/gi;

  let match: RegExpExecArray | null;
  while ((match = navPointRegex.exec(ncxXml)) !== null) {
    items.push({
      title: match[1].trim(),
      href: match[2].trim(),
    });
  }

  return items;
}

/** Extract chapter content from EPUB by index */
export async function getEpubChapter(file: File, chapterHref: string, basePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const chapterPath = normalizeEpubPath(chapterHref, basePath);
  const chapterFile = zip.file(chapterPath);

  if (!chapterFile) {
    throw new Error(`找不到章節: ${chapterHref}`);
  }

  const html = await chapterFile.async('text');
  return sanitizeHtml(html);
}
