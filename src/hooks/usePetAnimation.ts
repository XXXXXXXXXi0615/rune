import { useEffect, useRef, useState } from 'react';
import type { PetAtlas } from '@/features/pet/types';

const DEFAULT_ANIMATION = 'idle-calm';
let atlasPromise: Promise<PetAtlas> | null = null;

export function loadJiyiAtlas(): Promise<PetAtlas> {
  if (!atlasPromise) {
    atlasPromise = fetch(`${import.meta.env.BASE_URL}pets/jiyi/atlas.json`).then((response) => {
      if (!response.ok) throw new Error(`Pet atlas failed: ${response.status}`);
      return response.json() as Promise<PetAtlas>;
    }).catch((error) => {
      atlasPromise = null;
      throw error;
    });
  }
  return atlasPromise;
}

interface UsePetAnimationOptions {
  animationId: string;
  playing?: boolean;
  loop?: boolean;
  onAnimationEnd?: () => void;
  speed?: number;
}

export function usePetAnimation({ animationId, playing = true, loop, onAnimationEnd, speed = 1 }: UsePetAnimationOptions) {
  const [atlas, setAtlas] = useState<PetAtlas | null>(null);
  const [frameCursor, setFrameCursor] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const endCallback = useRef(onAnimationEnd);
  endCallback.current = onAnimationEnd;

  useEffect(() => {
    let live = true;
    loadJiyiAtlas().then((value) => {
      if (live) setAtlas(value);
    }).catch(() => {
      if (live) setLoadError(true);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const definition = atlas?.animations[animationId] || atlas?.animations[DEFAULT_ANIMATION];

  useEffect(() => setFrameCursor(0), [animationId]);

  useEffect(() => {
    if (!atlas || !definition || !playing || reducedMotion || definition.frames.length < 2) return;
    const shouldLoop = loop ?? definition.loop;
    const timer = window.setInterval(() => {
      setFrameCursor((current) => {
        const next = current + 1;
        if (next < definition.frames.length) return next;
        if (shouldLoop) return 0;
        window.clearInterval(timer);
        queueMicrotask(() => endCallback.current?.());
        return definition.frames.length - 1;
      });
    }, 1000 / Math.max(1, definition.fps * speed));
    return () => window.clearInterval(timer);
  }, [atlas, definition, loop, playing, reducedMotion, speed]);

  return {
    atlas,
    frameIndex: definition?.frames[Math.min(frameCursor, Math.max(0, definition.frames.length - 1))] ?? 0,
    loadError,
    reducedMotion,
  };
}
