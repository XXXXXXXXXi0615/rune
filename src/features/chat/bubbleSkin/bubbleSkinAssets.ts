import { useEffect, useState } from 'react';
import { getAsset } from '@/store/assets';
import type { BubbleSkinSource } from './types';

/**
 * Shared object-URL cache for bubble-skin assets (§11 / §13).
 *
 * Canonical IndexedDB asset layer (`src/store/assets.ts`) is reused — no new
 * database, no duplicate blobs, no per-message image generation. Multiple
 * bubbles referencing the same assetId share one object URL. URLs are never
 * revoked for the lifetime of the document (bubbles churn frequently; a stable
 * cache avoids flapping on long conversations).
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function keyOf(source: BubbleSkinSource): string {
  return source.kind === 'url' ? `url:${source.url}` : `asset:${source.assetId}`;
}

function resolveStatic(source: BubbleSkinSource): string | null {
  if (source.kind === 'url') return source.url;
  return null;
}

/** Resolve a source to a usable URL synchronously (cache hit) or null. */
export function getCachedSkinUrl(source: BubbleSkinSource): string | null {
  const key = keyOf(source);
  const staticUrl = resolveStatic(source);
  if (staticUrl) return staticUrl;
  return cache.get(key) ?? null;
}

/** Begin resolving; resolves when the blob URL is ready. Idempotent. */
export function ensureSkinUrl(source: BubbleSkinSource): Promise<string | null> {
  const staticUrl = resolveStatic(source);
  if (staticUrl) return Promise.resolve(staticUrl);
  const key = keyOf(source);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const existing = pending.get(key);
  if (existing) return existing;
  const next = (async () => {
    if (source.kind !== 'asset') return null;
    const blob = await getAsset(source.assetId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    cache.set(key, url);
    return url;
  })();
  pending.set(key, next);
  next.finally(() => { pending.delete(key); });
  return next;
}

/**
 * React hook. Returns a URL string when ready, otherwise null (renderer stays
 * on CSS fallback meanwhile — never renders a distorted placeholder).
 */
export function useBubbleSkinUrl(source: BubbleSkinSource | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (source ? getCachedSkinUrl(source) : null));
  useEffect(() => {
    let cancelled = false;
    if (!source) { setUrl(null); return undefined; }
    const initial = getCachedSkinUrl(source);
    if (initial) { setUrl(initial); return undefined; }
    ensureSkinUrl(source).then((resolved) => { if (!cancelled) setUrl(resolved); });
    return () => { cancelled = true; };
  }, [source ? keyOf(source) : '']);
  return url;
}
