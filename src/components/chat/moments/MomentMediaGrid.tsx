import { useEffect, useMemo, useState } from 'react';
import type { MomentMediaItem } from '@/features/moments/domain';
import { getAsset } from '@/store/assets';
import { MomentImageViewer } from './MomentImageViewer';

const momentAssetUrlCache = new Map<string, Promise<string | undefined>>();
function resolveMomentAssetUrl(assetId: string): Promise<string | undefined> {
  if (!assetId) return Promise.resolve(undefined);
  const cached = momentAssetUrlCache.get(assetId); if (cached) return cached;
  const pending = getAsset(assetId).then((blob) => blob ? URL.createObjectURL(blob) : undefined).catch(() => undefined);
  momentAssetUrlCache.set(assetId, pending); return pending;
}

export function useMomentMediaUrl(assetId: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    void resolveMomentAssetUrl(assetId).then((resolved) => { if (active) setUrl(resolved); });
    return () => { active = false; };
  }, [assetId]);
  return url;
}

function useMomentMediaUrls(items: MomentMediaItem[]) {
  const [urls, setUrls] = useState<(string | undefined)[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(items.map((item) => resolveMomentAssetUrl(item.assetId))).then((next) => { if (active) setUrls(next); });
    return () => { active = false; };
  }, [items]);
  return urls;
}

function MomentMedia({ item, index, total, onOpen }: { item: MomentMediaItem; index: number; total: number; onOpen: () => void }) {
  const url = useMomentMediaUrl(item.assetId); const crop = item.crop;
  const aspectRatio = total === 1 ? (crop?.aspect === '1:1' ? '1' : crop?.aspect === '4:5' ? '4 / 5' : item.width && item.height ? `${item.width} / ${item.height}` : undefined) : undefined;
  return <button type="button" className="moment-media-cell" onClick={onOpen} aria-label={`開啟圖片 ${index + 1}，共 ${total} 張`} style={aspectRatio ? { aspectRatio } : undefined}>
    {url ? <img src={url} alt={`動態圖片 ${index + 1}`} draggable={false} style={crop ? { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` } : undefined} /> : <span className="moment-media-loading" aria-label={`動態圖片 ${index + 1} 載入中`} />}
  </button>;
}

export function MomentMediaGrid({ media, detail = false }: { media: MomentMediaItem[]; detail?: boolean }) {
  const ordered = useMemo(() => [...media].sort((a, b) => a.order - b.order).slice(0, 9), [media]);
  const resolvedUrls = useMomentMediaUrls(ordered);
  const [viewerIndex, setViewerIndex] = useState<number>();
  if (!ordered.length) return null;
  const availableUrls = resolvedUrls.filter((url): url is string => Boolean(url));
  const count = ordered.length;
  return <><div className={`moment-media-grid moment-media-grid--${count}${detail ? ' is-detail' : ''}`} data-media-count={count}>
    {ordered.map((item, index) => <MomentMedia key={item.id} item={item} index={index} total={count} onOpen={() => setViewerIndex(index)} />)}
  </div>{viewerIndex !== undefined && availableUrls.length > 0 && <MomentImageViewer urls={availableUrls} index={Math.min(viewerIndex, availableUrls.length - 1)} onIndex={setViewerIndex} onClose={() => setViewerIndex(undefined)} />}</>;
}
