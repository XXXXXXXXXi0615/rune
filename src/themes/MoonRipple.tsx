import { useEffect } from 'react';
import './moon-ripple.css';

export function MoonRipple() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = (event.target as Element | null)?.closest<HTMLElement>('button:not(:disabled),a[href],[role="button"]:not([aria-disabled="true"])');
      if (!target) return;
      const ripple = document.createElement('span');
      ripple.className = 'moon-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 320);
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);
  return null;
}
