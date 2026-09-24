import { useEffect, useRef, useState } from 'react';
import sparkleUrl from '@/assets/rune-cursor/rune-cursor-sparkle.png';
import './RuneCursorHost.css';

const TRAIL_POOL_SIZE = 10;
const TRAIL_DISTANCE_PX = 20;
const TRAIL_INTERVAL_MS = 42;
const TRAIL_LIFETIME_MS = 420;

type TrailPoint = { x: number; y: number; time: number };

function supportsRuneCursor() {
  return window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(hover: none)').matches;
}

function hasReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function RuneCursorHost() {
  const [trailMounted, setTrailMounted] = useState(() => supportsRuneCursor() && !hasReducedMotion());
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    const noHover = window.matchMedia('(hover: none)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = () => {
      const cursorEnabled = finePointer.matches && !noHover.matches;
      document.documentElement.toggleAttribute('data-rune-cursor-enabled', cursorEnabled);
      setTrailMounted(cursorEnabled && !reducedMotion.matches);
    };

    sync();
    finePointer.addEventListener('change', sync);
    noHover.addEventListener('change', sync);
    reducedMotion.addEventListener('change', sync);
    return () => {
      finePointer.removeEventListener('change', sync);
      noHover.removeEventListener('change', sync);
      reducedMotion.removeEventListener('change', sync);
      document.documentElement.removeAttribute('data-rune-cursor-enabled');
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!trailMounted || !layer) return;

    const nodes = Array.from(layer.querySelectorAll<HTMLElement>('[data-rune-sparkle]'));
    const animations = new Set<Animation>();
    const currentAnimation = new WeakMap<HTMLElement, Animation>();
    let previous: TrailPoint | null = null;
    let poolIndex = 0;

    const spawn = (x: number, y: number, directionX: number, directionY: number, click = false) => {
      const node = nodes[poolIndex];
      poolIndex = (poolIndex + 1) % nodes.length;
      node.getAnimations().forEach((animation) => animation.cancel());

      const length = Math.hypot(directionX, directionY) || 1;
      const backX = click ? 0 : -(directionX / length) * 8;
      const backY = click ? 0 : -(directionY / length) * 8;
      const size = click ? 24 : 20;
      const half = size / 2;
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      node.style.left = `${x - half + backX}px`;
      node.style.top = `${y - half + backY}px`;
      node.dataset.active = 'true';

      const animation = node.animate(
        click
          ? [
              { opacity: 0.82, transform: 'translate3d(0, 0, 0) scale(.72)' },
              { opacity: 0, transform: 'translate3d(0, -5px, 0) scale(1.12)' },
            ]
          : [
              { opacity: 0.7, transform: 'translate3d(0, 0, 0) scale(.65)' },
              { opacity: 0, transform: `translate3d(${backX * .55}px, ${backY * .55 - 6}px, 0) scale(1)` },
            ],
        { duration: click ? 360 : TRAIL_LIFETIME_MS, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' },
      );
      animations.add(animation);
      currentAnimation.set(node, animation);
      animation.onfinish = animation.oncancel = () => {
        if (currentAnimation.get(node) === animation) node.dataset.active = 'false';
        animations.delete(animation);
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const now = performance.now();
      if (!previous) {
        previous = { x: event.clientX, y: event.clientY, time: now };
        return;
      }
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (now - previous.time < TRAIL_INTERVAL_MS || Math.hypot(dx, dy) < TRAIL_DISTANCE_PX) return;
      spawn(event.clientX, event.clientY, dx, dy);
      previous = { x: event.clientX, y: event.clientY, time: now };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') spawn(event.clientX, event.clientY, 0, 0, true);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      animations.forEach((animation) => animation.cancel());
      nodes.forEach((node) => { node.dataset.active = 'false'; });
    };
  }, [trailMounted]);

  if (!trailMounted) return null;

  return (
    <div ref={layerRef} className="rune-cursor-trail" aria-hidden="true" data-testid="rune-cursor-trail">
      {Array.from({ length: TRAIL_POOL_SIZE }, (_, index) => (
        <img
          alt=""
          className="rune-cursor-sparkle"
          data-active="false"
          data-rune-sparkle=""
          draggable={false}
          key={index}
          src={sparkleUrl}
        />
      ))}
    </div>
  );
}
