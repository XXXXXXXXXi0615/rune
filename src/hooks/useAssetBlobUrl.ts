import { useEffect, useRef, useState } from 'react';
import { getAsset } from '@/store/assets';

export function createLatestAssetResolutionGuard() {
  let generation = 0;
  return {
    next: () => ++generation,
    isLatest: (candidate: number) => candidate === generation,
  };
}

async function decodeObjectUrl(url: string): Promise<void> {
  const image = new Image();
  image.src = url;
  if (typeof image.decode === 'function') await image.decode();
  else await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('asset decode failed')); });
}

/** Keeps the previous decoded URL visible until its replacement is ready. */
export function useResolvedAssetUrl(assetId?: string) {
  const [url, setUrl] = useState<string>();
  const currentUrl = useRef<string | undefined>(undefined);
  const guard = useRef(createLatestAssetResolutionGuard());

  useEffect(() => {
    const request = guard.current.next();
    if (!assetId) {
      const previous = currentUrl.current;
      currentUrl.current = undefined; setUrl(undefined);
      if (previous) URL.revokeObjectURL(previous);
      return;
    }
    let candidate: string | undefined;
    void getAsset(assetId).then(async (blob) => {
      if (!blob || !guard.current.isLatest(request)) return;
      candidate = URL.createObjectURL(blob);
      await decodeObjectUrl(candidate);
      if (!guard.current.isLatest(request)) { URL.revokeObjectURL(candidate); return; }
      const previous = currentUrl.current;
      currentUrl.current = candidate; setUrl(candidate);
      if (previous && previous !== candidate) URL.revokeObjectURL(previous);
    }).catch(() => { if (candidate) URL.revokeObjectURL(candidate); });
    return () => { guard.current.next(); };
  }, [assetId]);

  useEffect(() => () => {
    guard.current.next();
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = undefined;
  }, []);
  return assetId ? url : undefined;
}

export const useAssetBlobUrl = useResolvedAssetUrl;
