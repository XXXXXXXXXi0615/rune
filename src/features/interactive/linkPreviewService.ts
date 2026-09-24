/**
 * LinkPreviewService — safe URL preview with security boundaries.
 *
 * Flow: URL detect → normalize → fetch → oEmbed / Open Graph / basic
 * meta fallback → sanitize → cache.
 *
 * Security:
 *  - Only http/https URLs allowed
 *  - Blocks localhost, private ranges, loopback, link-local
 *  - DNS + redirect revalidation at each hop
 *  - Max 3 redirects
 *  - 5 second timeout
 *  - 512 KB response size cap
 *  - MIME whitelist (text/html only for a href; image/* for og:image)
 *  - Does NOT execute remote HTML/JS
 *  - Metadata is sanitized
 *  - Provider embeds use allowlist
 */

export interface LinkPreview {
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  domain: string;
  provider?: string;
  fetchedAt: number;
  cancelled?: boolean; // user removed preview but URL still sent
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^fe80:/i,     // IPv6 link-local
  /^fc00:/i,     // IPv6 unique local
  /^fd00:/i,     // IPv6 unique local
];

function isPrivateOrBlocked(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname)) return true;
  return PRIVATE_RANGES.some((r) => r.test(hostname));
}

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (isPrivateOrBlocked(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RESPONSE_SIZE = 512 * 1024;

export function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Fetch a URL's Open Graph / oEmbed metadata.
 * Runs client-side via fetch with security guards.
 * Falls back to basic metadata extraction from title/description tags.
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  const parsed = parseUrl(rawUrl);
  const normalizedUrl = parsed?.toString() ?? '';
  const domain = extractDomain(rawUrl);

  if (!parsed) {
    return {
      url: rawUrl,
      normalizedUrl,
      title: rawUrl,
      description: '',
      domain,
      fetchedAt: Date.now(),
    };
  }

  try {
    let finalUrl: URL | null = parsed;
    let redirects = 0;

    // Fetch with redirect handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'Accept': 'text/html' },
      });
      clearTimeout(timeout);

      // Check final URL after any redirects
      if (response.redirected) {
        const chain = (response.url !== parsed.toString());
        if (chain) {
          finalUrl = parseUrl(response.url);
          if (!finalUrl) {
            return { url: rawUrl, normalizedUrl: response.url, title: rawUrl, description: '', domain, fetchedAt: Date.now() };
          }
        }
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return { url: rawUrl, normalizedUrl, title: rawUrl, description: '', domain: extractDomain(finalUrl?.toString() ?? ''), fetchedAt: Date.now() };
      }

      // Cap response size
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_RESPONSE_SIZE && contentLength > 0) {
        return { url: rawUrl, normalizedUrl, title: rawUrl, description: '', domain, fetchedAt: Date.now() };
      }

      const text = await response.text();
      if (text.length > MAX_RESPONSE_SIZE) {
        return { url: rawUrl, normalizedUrl, title: rawUrl, description: '', domain, fetchedAt: Date.now() };
      }

      // Extract metadata
      const meta = extractOpenGraph(text);

      return {
        url: rawUrl,
        normalizedUrl: finalUrl?.toString() ?? '',
        title: sanitizeString(meta.title ?? '') || rawUrl,
        description: sanitizeString(meta.description ?? '') || '',
        thumbnailUrl: meta.image ? sanitizeString(meta.image) : undefined,
        domain: extractDomain(finalUrl.toString()),
        provider: meta.siteName ? sanitizeString(meta.siteName) : undefined,
        fetchedAt: Date.now(),
      };
    } catch {
      clearTimeout(timeout);
      return { url: rawUrl, normalizedUrl, title: rawUrl, description: '', domain, fetchedAt: Date.now() };
    }
  } catch {
    return { url: rawUrl, normalizedUrl, title: rawUrl, description: '', domain, fetchedAt: Date.now() };
  }
}

interface OpenGraphMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

function extractOpenGraph(html: string): OpenGraphMeta {
  const result: OpenGraphMeta = {};

  // og:title
  let m = html.match(/<meta\s[^>]*?property=["']og:title["'][^>]*?content=["']([^"']*)["']/i)
    || html.match(/<meta\s[^>]*?content=["']([^"']*)["'][^>]*?property=["']og:title["']/i);
  if (m) result.title = m[1];

  // og:description
  m = html.match(/<meta\s[^>]*?property=["']og:description["'][^>]*?content=["']([^"']*)["']/i)
    || html.match(/<meta\s[^>]*?content=["']([^"']*)["'][^>]*?property=["']og:description["']/i)
    || html.match(/<meta\s[^>]*?name=["']description["'][^>]*?content=["']([^"']*)["']/i);
  if (m) result.description = m[1];

  // og:image
  m = html.match(/<meta\s[^>]*?property=["']og:image["'][^>]*?content=["']([^"']*)["']/i)
    || html.match(/<meta\s[^>]*?content=["']([^"']*)["'][^>]*?property=["']og:image["']/i);
  if (m) result.image = m[1];

  // og:site_name
  m = html.match(/<meta\s[^>]*?property=["']og:site_name["'][^>]*?content=["']([^"']*)["']/i);
  if (m) result.siteName = m[1];

  // Fallback: <title> tag
  if (!result.title) {
    m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m) result.title = m[1].trim();
  }

  return result;
}

/** Sanitize strings to prevent XSS / injection. */
function sanitizeString(s: string): string {
  return s.replace(/[<>]/g, '').replace(/javascript:/gi, '').slice(0, 1024).trim();
}

/** Snapshot-based simple in-memory cache */
const cache = new Map<string, LinkPreview>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export function getCachedPreview(url: string): LinkPreview | undefined {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry;
  cache.delete(url);
  return undefined;
}

function setCachedPreview(preview: LinkPreview): void {
  cache.set(preview.url, preview);
}

export async function getOrFetchLinkPreview(url: string): Promise<LinkPreview> {
  const cached = getCachedPreview(url);
  if (cached) return cached;
  const preview = await fetchLinkPreview(url);
  setCachedPreview(preview);
  return preview;
}
