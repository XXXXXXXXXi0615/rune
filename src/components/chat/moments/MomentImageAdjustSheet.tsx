import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MomentMediaAspect, MomentMediaCrop } from '@/features/moments/domain';

const DEFAULT_CROP: MomentMediaCrop = { x: 50, y: 50, zoom: 1, aspect: 'original' };

export function MomentImageAdjustSheet({ url, crop, onChange, onClose }: { url: string; crop?: MomentMediaCrop; onChange: (crop: MomentMediaCrop) => void; onClose: () => void }) {
  const value = crop ?? DEFAULT_CROP;
  const dragging = useRef(false);
  const set = (patch: Partial<MomentMediaCrop>) => onChange({ ...value, ...patch });
  const updatePoint = (element: HTMLElement, clientX: number, clientY: number) => { const rect = element.getBoundingClientRect(); set({ x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)) }); };
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [onClose]);
  const app = document.getElementById('app');
  if (!app) return null;
  return createPortal(<div className="moment-adjust-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="moment-adjust-sheet" role="dialog" aria-modal="true" aria-label="調整圖片">
    <header><h3>調整圖片</h3><button type="button" onClick={onClose}>完成</button></header>
    <div className={`moment-adjust-preview is-${value.aspect.replace(':', '-')}`} onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); updatePoint(event.currentTarget, event.clientX, event.clientY); }} onPointerMove={(event) => { if (dragging.current) updatePoint(event.currentTarget, event.clientX, event.clientY); }} onPointerUp={() => { dragging.current = false; }}>
      <img src={url} alt="圖片裁切預覽" draggable={false} style={{ objectPosition: `${value.x}% ${value.y}%`, transform: `scale(${value.zoom})` }} /><span aria-hidden="true" />
    </div>
    <div className="moment-adjust-aspects" role="group" aria-label="圖片比例">{(['original', '1:1', '4:5'] as MomentMediaAspect[]).map((aspect) => <button key={aspect} type="button" aria-pressed={value.aspect === aspect} onClick={() => set({ aspect })}>{aspect === 'original' ? 'Original' : aspect}</button>)}</div>
    <label>縮放<input type="range" min="1" max="3" step="0.05" value={value.zoom} onChange={(event) => set({ zoom: Number(event.target.value) })} aria-label="圖片縮放" /></label><p>拖曳圖片以調整焦點</p>
  </section></div>, app);
}
