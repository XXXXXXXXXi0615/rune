/**
 * EpubResourceResolver — resolves relative resources from EPUB archive
 *
 * Responsibilities:
 * - Resolve relative paths against OPF base path
 * - Normalize ./ and ../ references
 * - Extract blobs from ZIP archive
 * - Create and track object URLs
 * - Rewrite img src, stylesheet href, CSS url()
 * - Block javascript: and file: URLs
 * - Block remote http/https resources by default
 * - Block path traversal beyond archive root
 */

import JSZip from 'jszip';

const BLOCKED_PROTOCOLS = ['javascript:', 'file:', 'data:'];
const ALLOWED_PROTOCOLS = ['blob:'];
const MAX_RESOURCE_SIZE = 10 * 1024 * 1024; // 10 MB per resource

/** Normalize a relative path, resolving ./ and ../ */
export function normalizeEpubPath(path: string, basePath: string): string {
  // Decode URI components
  let decoded = decodeURIComponent(path);

  // Remove leading ./
  decoded = decoded.replace(/^\.\//g, '');

  // If path is absolute (starts with /), use as-is after removing leading /
  if (decoded.startsWith('/')) {
    decoded = decoded.substring(1);
    return decoded;
  }

  // Combine with base path
  const combined = basePath ? `${basePath}/${decoded}` : decoded;

  // Split into segments and resolve
  const segments = combined.split('/');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') {
      resolved.pop();
    } else {
      resolved.push(segment);
    }
  }

  return resolved.join('/');
}

/** Check if a URL is safe (not javascript:, file:, etc.) */
export function isSafeUrl(url: string): boolean {
  const lower = url.toLowerCase().trim();
  for (const protocol of BLOCKED_PROTOCOLS) {
    if (lower.startsWith(protocol)) return false;
  }
  return true;
}

/** Check if a path is within the archive root (no path traversal) */
export function isWithinArchiveRoot(path: string): boolean {
  // Check for path traversal attempts
  if (path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return true;
}

/** Check if a URL is a remote resource (http/https) */
export function isRemoteUrl(url: string): boolean {
  const lower = url.toLowerCase().trim();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

/** Get the directory portion of a path */
export function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.substring(0, lastSlash) : '';
}

/** Extract the file extension from a path */
export function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');
  if (lastDot > lastSlash) {
    return path.substring(lastDot + 1).toLowerCase();
  }
  return '';
}

/** Map file extensions to MIME types */
export function guessMimeType(path: string): string {
  const ext = getExtension(path);
  const mimeMap: Record<string, string> = {
    'html': 'application/xhtml+xml',
    'htm': 'application/xhtml+xml',
    'xhtml': 'application/xhtml+xml',
    'css': 'text/css',
    'js': 'application/javascript',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * EpubResourceResolver manages resource loading from an EPUB ZIP archive.
 * It creates object URLs for resources and tracks them for cleanup.
 */
export class EpubResourceResolver {
  private zip: JSZip;
  private basePath: string;
  private objectUrls = new Map<string, string>(); // path -> objectURL
  private resourceCache = new Map<string, Blob>(); // path -> blob
  private failedResources = new Set<string>();

  constructor(zip: JSZip, basePath: string) {
    this.zip = zip;
    this.basePath = basePath;
  }

  /** Resolve a relative href to an absolute archive path */
  resolvePath(href: string): string {
    return normalizeEpubPath(href, this.basePath);
  }

  /** Get a resource blob from the archive */
  async getResource(path: string): Promise<Blob | null> {
    // Security checks
    if (!isWithinArchiveRoot(path)) {
      console.warn(`[EpubResourceResolver] Path traversal blocked: ${path}`);
      return null;
    }

    // Check cache
    if (this.resourceCache.has(path)) {
      return this.resourceCache.get(path)!;
    }

    // Check if already failed
    if (this.failedResources.has(path)) {
      return null;
    }

    // Find file in ZIP
    const file = this.zip.file(path);
    if (!file) {
      this.failedResources.add(path);
      return null;
    }

    try {
      const arrayBuffer = await file.async('arraybuffer');

      // Check size
      if (arrayBuffer.byteLength > MAX_RESOURCE_SIZE) {
        console.warn(`[EpubResourceResolver] Resource too large: ${path} (${arrayBuffer.byteLength} bytes)`);
        this.failedResources.add(path);
        return null;
      }

      const mimeType = guessMimeType(path);
      const blob = new Blob([arrayBuffer], { type: mimeType });

      // Cache it
      this.resourceCache.set(path, blob);

      return blob;
    } catch (err) {
      console.warn(`[EpubResourceResolver] Failed to load: ${path}`, err);
      this.failedResources.add(path);
      return null;
    }
  }

  /** Get or create an object URL for a resource */
  async getObjectUrl(href: string): Promise<string | null> {
    // Security: block unsafe URLs
    if (!isSafeUrl(href)) {
      console.warn(`[EpubResourceResolver] Unsafe URL blocked: ${href}`);
      return null;
    }

    // Security: block remote URLs
    if (isRemoteUrl(href)) {
      console.warn(`[EpubResourceResolver] Remote URL blocked: ${href}`);
      return null;
    }

    const path = this.resolvePath(href);

    // Check cache
    if (this.objectUrls.has(path)) {
      return this.objectUrls.get(path)!;
    }

    const blob = await this.getResource(path);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.objectUrls.set(path, url);
    return url;
  }

  /** Rewrite HTML content to resolve resource references */
  async resolveHtml(html: string): Promise<string> {
    let resolved = html;

    // Rewrite img src
    resolved = await this.resolveImgSrcs(resolved);

    // Rewrite link href (stylesheets)
    resolved = await this.resolveLinkHrefs(resolved);

    // Rewrite style attributes with url()
    resolved = await this.resolveInlineStyles(resolved);

    // Rewrite internal href links
    resolved = this.resolveInternalLinks(resolved);

    // Block any remaining javascript: URLs
    resolved = resolved.replace(/javascript\s*:/gi, 'blocked:');

    return resolved;
  }

  /** Resolve img src attributes */
  private async resolveImgSrcs(html: string): Promise<string> {
    const imgRegex = /<img\s+([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)\/?>/gi;
    let result = html;
    const matches = [...html.matchAll(imgRegex)];

    for (const match of matches) {
      const [fullMatch, before, src, after] = match;

      // Skip data URIs and blob URLs
      if (src.startsWith('data:') || src.startsWith('blob:')) continue;

      // Skip unsafe URLs
      if (!isSafeUrl(src)) {
        result = result.replace(fullMatch, `<img ${before}src="" alt="[blocked]" class="moonread-img-placeholder" ${after}/>`);
        continue;
      }

      // Skip remote URLs
      if (isRemoteUrl(src)) {
        result = result.replace(fullMatch, `<img ${before}src="" alt="[remote blocked]" class="moonread-img-placeholder" ${after}/>`);
        continue;
      }

      // Resolve the path
      const objectUrl = await this.getObjectUrl(src);
      if (objectUrl) {
        result = result.replace(fullMatch, `<img ${before}src="${objectUrl}" ${after}/>`);
      } else {
        // Replace with visible placeholder for missing images
        result = result.replace(fullMatch, `<div class="moonread-img-placeholder" role="img" aria-label="此圖片無法顯示"><span>此圖片無法顯示</span></div>`);
      }
    }

    return result;
  }

  /** Resolve link href attributes (stylesheets) */
  private async resolveLinkHrefs(html: string): Promise<string> {
    const linkRegex = /<link\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)\/?>/gi;
    let result = html;
    const matches = [...html.matchAll(linkRegex)];

    for (const match of matches) {
      const [fullMatch, before, href, after] = match;

      // Only resolve stylesheets
      if (!before.includes('rel="stylesheet"') && !before.includes("rel='stylesheet'")) continue;

      // Skip unsafe URLs
      if (!isSafeUrl(href)) {
        result = result.replace(fullMatch, '');
        continue;
      }

      // Skip remote URLs
      if (isRemoteUrl(href)) {
        result = result.replace(fullMatch, '');
        continue;
      }

      const objectUrl = await this.getObjectUrl(href);
      if (objectUrl) {
        result = result.replace(fullMatch, `<link ${before}href="${objectUrl}" ${after}/>`);
      } else {
        result = result.replace(fullMatch, '');
      }
    }

    return result;
  }

  /** Resolve inline style url() references */
  private async resolveInlineStyles(html: string): Promise<string> {
    const styleRegex = /style\s*=\s*["']([^"']*url\s*\([^)]+\)[^"']*)["']/gi;
    let result = html;
    const matches = [...html.matchAll(styleRegex)];

    for (const match of matches) {
      const [fullMatch, styleContent] = match;
      let newStyle = styleContent;

      // Find all url() references
      const urlRegex = /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
      const urlMatches = [...styleContent.matchAll(urlRegex)];

      for (const urlMatch of urlMatches) {
        const [fullUrl, url] = urlMatch;

        // Skip data URIs and blob URLs
        if (url.startsWith('data:') || url.startsWith('blob:')) continue;

        // Skip unsafe URLs
        if (!isSafeUrl(url)) {
          newStyle = newStyle.replace(fullUrl, 'url("")');
          continue;
        }

        // Skip remote URLs
        if (isRemoteUrl(url)) {
          newStyle = newStyle.replace(fullUrl, 'url("")');
          continue;
        }

        const objectUrl = await this.getObjectUrl(url);
        if (objectUrl) {
          newStyle = newStyle.replace(fullUrl, `url("${objectUrl}")`);
        } else {
          newStyle = newStyle.replace(fullUrl, 'url("")');
        }
      }

      if (newStyle !== styleContent) {
        result = result.replace(fullMatch, `style="${newStyle}"`);
      }
    }

    return result;
  }

  /** Resolve internal chapter links */
  private resolveInternalLinks(html: string): string {
    // Rewrite href attributes that point to other chapters
    const hrefRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"'#]+)(#[^"']*)?["']([^>]*?)>/gi;
    let result = html;

    result = result.replace(hrefRegex, (match, before, href, fragment, after) => {
      // Skip unsafe URLs
      if (!isSafeUrl(href)) {
        return `<a ${before}href="#" ${after}>`;
      }

      // Skip remote URLs
      if (isRemoteUrl(href)) {
        return `<a ${before}href="#" ${after}>`;
      }

      // Keep internal links as-is for now (chapter navigation handled separately)
      return match;
    });

    return result;
  }

  /** Get the cover image blob with priority chain */
  async extractCover(manifest: { metadata: any; spine: any[]; coverHref: string | null; basePath: string }): Promise<Blob | null> {
    // Priority 1: manifest properties="cover-image"
    // Priority 2: meta name="cover"
    // Priority 3: guide type="cover"
    // Priority 4: title page first reasonable image
    // Priority 5: stable fallback

    // Try coverHref first
    if (manifest.coverHref) {
      const coverPath = this.resolvePath(manifest.coverHref);
      const blob = await this.getResource(coverPath);
      if (blob && blob.type.startsWith('image/')) {
        return blob;
      }
    }

    // Try to find an image in the first chapter (title page)
    const firstSpineItem = manifest.spine[0];
    if (firstSpineItem) {
      const chapterPath = this.resolvePath(firstSpineItem.href);
      const chapterFile = this.zip.file(chapterPath);
      if (chapterFile) {
        try {
          const html = await chapterFile.async('text');
          const imgMatch = /<img\s+[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html);
          if (imgMatch) {
            const imgSrc = imgMatch[1];
            if (isSafeUrl(imgSrc) && !isRemoteUrl(imgSrc)) {
              const imgPath = normalizeEpubPath(imgSrc, getDirectory(chapterPath));
              const blob = await this.getResource(imgPath);
              if (blob && blob.type.startsWith('image/')) {
                return blob;
              }
            }
          }
        } catch {
          // Ignore errors
        }
      }
    }

    return null;
  }

  /** Revoke all tracked object URLs */
  dispose(): void {
    for (const url of this.objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrls.clear();
    this.resourceCache.clear();
    this.failedResources.clear();
  }
}
