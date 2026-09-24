import { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDailyCacheWindowStore } from '@/store/useDailyCacheWindowStore';
import { DailyCacheBody } from '@/components/cache/DailyCacheBody';
import './daily-cache-window.css';

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_EDGES: ResizeEdge[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'];

function clamp(v: number, mn: number, mx: number) {
  return Math.min(Math.max(mn, v), mx);
}

function getResizeBounds() {
  const maxW = Math.min(440, window.innerWidth - 32);
  const maxH = Math.min(680, window.innerHeight * 0.9);
  return {
    minWidth: Math.min(340, maxW),
    minHeight: Math.min(400, maxH),
    maxWidth: maxW,
    maxHeight: maxH,
  };
}

export function DailyCacheWindow() {
  const win = useDailyCacheWindowStore();
  const windowRef = useRef<HTMLDivElement>(null);

  /* ── Esc to close ── */
  useEffect(() => {
    if (!win.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); win.closeWindow(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [win.isOpen, win.closeWindow]);

  /* ── Drag ── */
  const dragRef = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const onTitlePointerDown = useCallback((e: React.PointerEvent) => {
    if (win.isMaximized) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, wx: win.x, wy: win.y };
    windowRef.current?.setPointerCapture(e.pointerId);
  }, [win.isMaximized, win.x, win.y]);

  const onDragPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    win.setPosition(dragRef.current.wx + dx, dragRef.current.wy + dy);
  }, [win]);

  const onDragPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resizeRef = useRef<{ edge: ResizeEdge; sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const onResizePointerDown = useCallback((edge: ResizeEdge) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (win.isMaximized) return;
    resizeRef.current = { edge, sx: e.clientX, sy: e.clientY, x: win.x, y: win.y, w: win.width, h: win.height };
    windowRef.current?.setPointerCapture(e.pointerId);
  }, [win.isMaximized, win.x, win.y, win.width, win.height]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    const s = resizeRef.current;
    if (!s) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    const b = getResizeBounds();
    let nx = s.x, ny = s.y, nw = s.w, nh = s.h;
    if (s.edge.includes('e')) nw = clamp(s.w + dx, b.minWidth, b.maxWidth);
    if (s.edge.includes('s')) nh = clamp(s.h + dy, b.minHeight, b.maxHeight);
    if (s.edge.includes('w')) { const r = s.x + s.w; nw = clamp(s.w - dx, b.minWidth, b.maxWidth); nx = r - nw; }
    if (s.edge.includes('n')) { const bo = s.y + s.h; nh = clamp(s.h - dy, b.minHeight, b.maxHeight); ny = bo - nh; }
    win.setFrame(nx, ny, nw, nh);
  }, [win]);

  const onResizeUp = useCallback(() => { resizeRef.current = null; }, []);

  const onWindowPointerMove = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current) { onResizeMove(e); return; }
    if (dragRef.current) onDragPointerMove(e);
  }, [onDragPointerMove, onResizeMove]);

  const onWindowPointerUp = useCallback(() => {
    if (resizeRef.current) onResizeUp();
    else if (dragRef.current) onDragPointerUp();
  }, [onDragPointerUp, onResizeUp]);

  if (!win.isOpen) return null;

  const isMobile = window.innerWidth <= 640;
  const style: React.CSSProperties = win.isMaximized
    ? { top: 0, left: 0, width: '100vw', height: '100dvh', borderRadius: 0 }
    : isMobile
      ? { bottom: 0, left: 0, right: 0, width: '100%', height: 'auto', maxHeight: '85dvh' }
      : { top: win.y, left: win.x, width: win.width, height: win.height };

  return createPortal(
    <div
      ref={windowRef}
      data-testid="daily-cache-window"
      className={`dc-window ${win.isMaximized ? 'maximized' : ''} ${isMobile ? 'dc-window--mobile' : ''}`}
      style={style}
      role="dialog"
      aria-label="每日緩存"
      onPointerMove={onWindowPointerMove}
      onPointerUp={onWindowPointerUp}
      onPointerCancel={onWindowPointerUp}
    >
      <div className="dc-header" onPointerDown={onTitlePointerDown}>
        {!isMobile && (
          <div className="dc-traffic" aria-label="視窗控制">
            <button type="button" className="dc-traffic-btn dc-traffic-btn--close" onPointerDown={(e) => e.stopPropagation()} onClick={win.closeWindow} aria-label="關閉" title="關閉" tabIndex={0} />
          </div>
        )}
        {isMobile && <span className="dc-header-side-spacer" aria-hidden="true" />}
        <span className="dc-header-title">每日緩存</span>
        <button type="button" className="dc-header-btn" onPointerDown={(e) => e.stopPropagation()} onClick={win.closeWindow} aria-label="關閉" title="關閉" tabIndex={0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <DailyCacheBody active={win.isOpen} />

      {!isMobile && !win.isMaximized && RESIZE_EDGES.map((edge) => (
        <div key={edge} className={`dc-resize-zone dc-resize-zone--${edge}`} onPointerDown={onResizePointerDown(edge)} aria-hidden="true" />
      ))}
    </div>,
    document.body,
  );
}
