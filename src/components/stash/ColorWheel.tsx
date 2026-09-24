import { useRef } from 'react';
import { hsvToHex, type HsvColor } from '@/features/stash/colorMath';

export function ColorWheel({ value, onChange }: { value: HsvColor; onChange: (value: HsvColor) => void }) {
  const ringRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const updateHue = (clientX: number, clientY: number) => {
    const rect = ringRef.current!.getBoundingClientRect();
    const angle = Math.atan2(clientY - (rect.top + rect.height / 2), clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
    onChange({ ...value, h: Math.round((angle + 450) % 360) });
  };
  const updatePlane = (clientX: number, clientY: number) => {
    const rect = planeRef.current!.getBoundingClientRect();
    onChange({ ...value, s: Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * 100), v: Math.round((1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))) * 100) });
  };
  const pointer = (update: (x: number, y: number) => void) => ({
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); update(event.clientX, event.clientY); },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event.clientX, event.clientY); },
  });
  return <div className="stash-color-wheel" data-pet-safe-region="critical" aria-label="色輪">
    <div ref={ringRef} className="stash-color-wheel__ring" {...pointer(updateHue)} aria-label="色相環" role="slider" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(value.h)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onChange({ ...value, h: (value.h + 359) % 360 }); if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onChange({ ...value, h: (value.h + 1) % 360 }); }}><i style={{ transform: `rotate(${value.h}deg) translateY(calc(var(--wheel-size) / -2 + 10px))` }}/></div>
    <div ref={planeRef} className="stash-color-wheel__plane" style={{ '--wheel-hue': hsvToHex({ h: value.h, s: 100, v: 100 }) } as React.CSSProperties} {...pointer(updatePlane)} aria-label="飽和度與明度平面"><i style={{ left: `${value.s}%`, top: `${100 - value.v}%`, background: hsvToHex(value) }}/></div>
  </div>;
}
