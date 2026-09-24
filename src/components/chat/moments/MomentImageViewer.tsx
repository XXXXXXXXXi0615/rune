import { useEffect, useRef } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';

export function MomentImageViewer({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const touchStart = useRef<number | undefined>(undefined);
  const previous = () => onIndex((index - 1 + urls.length) % urls.length);
  const next = () => onIndex((index + 1) % urls.length);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); else if (event.key === 'ArrowLeft') previous(); else if (event.key === 'ArrowRight') next(); }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); });
  return <MobileShellOverlay variant="fullscreen" onClose={onClose} className="moment-viewer-overlay"><section className="moment-image-viewer" role="dialog" aria-modal="true" aria-label="圖片檢視器" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX; }} onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0]?.clientX; if (start === undefined || end === undefined || Math.abs(end - start) < 42) return; if (end < start) next(); else previous(); }}>
    <button type="button" className="moment-viewer-close" onClick={onClose} aria-label="關閉圖片檢視器">×</button>{urls.length > 1 && <span className="moment-viewer-count" aria-live="polite">{index + 1} / {urls.length}</span>}{urls[index] && <img src={urls[index]} alt={`原圖 ${index + 1}，共 ${urls.length} 張`} />}{urls.length > 1 && <><button type="button" className="moment-viewer-prev" onClick={previous} aria-label="上一張圖片">‹</button><button type="button" className="moment-viewer-next" onClick={next} aria-label="下一張圖片">›</button></>}
  </section></MobileShellOverlay>;
}
