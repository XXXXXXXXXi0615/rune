/**
 * ResizableEditorWindow — macOS-style draggable + resizable floating editor.
 *
 * Positioning: direct DOM style manipulation with !important priority
 * to guarantee exact dimensions regardless of CSS cascade.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import './ResizableEditorWindow.css';

export interface ResizableEditorWindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  dirty?: boolean;
}

type ResizeEdge = 'n' | 'e' | 's' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_EDGES: ResizeEdge[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'];
const EDGE_MARGIN = 20;
const DEFAULT_W = 520;
const DEFAULT_H = 640;
const MIN_W = 380;
const MIN_H = 460;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

const MOBILE_BP = 640;

function isDesktopViewport(): boolean {
  return window.innerWidth > MOBILE_BP;
}

/** Apply desktop frame directly to DOM element with !important priority. */
function applyFrame(el: HTMLElement, f: { x: number; y: number; w: number; h: number }) {
  if (!isDesktopViewport()) return;
  el.style.setProperty('left', `${f.x}px`, 'important');
  el.style.setProperty('top', `${f.y}px`, 'important');
  el.style.setProperty('width', `${f.w}px`, 'important');
  el.style.setProperty('height', `${f.h}px`, 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  el.style.setProperty('transform', 'none', 'important');
}

/** Clear all !important inline positioning so CSS takes over (mobile fallback). */
function clearFrame(el: HTMLElement) {
  el.style.removeProperty('left');
  el.style.removeProperty('top');
  el.style.removeProperty('width');
  el.style.removeProperty('height');
  el.style.removeProperty('right');
  el.style.removeProperty('bottom');
  el.style.removeProperty('transform');
}

function computeInitFrame(vw: number, vh: number) {
  const w = (vw > DEFAULT_W + EDGE_MARGIN * 2) ? DEFAULT_W : Math.max(MIN_W, vw - EDGE_MARGIN * 2);
  const h = (vh > DEFAULT_H + EDGE_MARGIN * 2) ? DEFAULT_H : Math.max(MIN_H, vh - EDGE_MARGIN * 2);
  const x = Math.max(EDGE_MARGIN, Math.round((vw - w) / 2));
  const y = Math.max(EDGE_MARGIN, Math.round((vh - h) / 2));
  return { x, y, w, h };
}

export function ResizableEditorWindow({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  defaultWidth = DEFAULT_W,
  defaultHeight = DEFAULT_H,
  minWidth = MIN_W,
  minHeight = MIN_H,
  dirty = false,
}: ResizableEditorWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef({ x: 0, y: 0, w: defaultWidth, h: defaultHeight });

  /* ── Initialise position & apply directly to DOM ── */
  useLayoutEffect(() => {
    if (!open) return;
    const el = windowRef.current;
    if (!el) return;

    if (isDesktopViewport()) {
      const f = computeInitFrame(window.innerWidth, window.innerHeight);
      frameRef.current = f;
      applyFrame(el, f);
    } else {
      clearFrame(el);
    }
  }, [open]);

  /* ── Viewport resize: switch desktop/mobile positioning ── */
  useEffect(() => {
    if (!open) return;
    let wasDesktop = isDesktopViewport();

    const onResize = () => {
      const nowDesktop = isDesktopViewport();
      if (nowDesktop === wasDesktop) return;
      wasDesktop = nowDesktop;

      const el = windowRef.current;
      if (!el) return;

      if (nowDesktop) {
        const f = computeInitFrame(window.innerWidth, window.innerHeight);
        frameRef.current = f;
        applyFrame(el, f);
      } else {
        clearFrame(el);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  /* ── Body scroll lock ── */
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  /* ── ESC handler ── */
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dirty) {
          if (!window.confirm('有未儲存的變更，確定要關閉嗎？')) return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, dirty, onClose]);

  /* ════════════════════════════════════════
     Drag
     ════════════════════════════════════════ */
  const dragRef = useRef<{ sx: number; sy: number; fx: number; fy: number } | null>(null);

  const onTitlePointerDown = useCallback((e: ReactPointerEvent) => {
    const f = frameRef.current;
    dragRef.current = { sx: e.clientX, sy: e.clientY, fx: f.x, fy: f.y };
    const el = windowRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, []);

  const onDragMove = useCallback((e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    const f = frameRef.current;
    const maxX = window.innerWidth - f.w - EDGE_MARGIN;
    const maxY = window.innerHeight - f.h - EDGE_MARGIN;

    const next = {
      x: clamp(dragRef.current.fx + dx, EDGE_MARGIN, maxX),
      y: clamp(dragRef.current.fy + dy, EDGE_MARGIN, maxY),
      w: f.w,
      h: f.h,
    };
    frameRef.current = next;
    if (windowRef.current) applyFrame(windowRef.current, next);
  }, []);

  const onDragUp = useCallback((e: ReactPointerEvent) => {
    dragRef.current = null;
    const el = windowRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  /* ════════════════════════════════════════
     Resize
     ════════════════════════════════════════ */
  const resizeRef = useRef<{
    edge: ResizeEdge;
    sx: number; sy: number;
    x: number; y: number; w: number; h: number;
  } | null>(null);

  const onResizePointerDown = useCallback((edge: ResizeEdge) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    const f = frameRef.current;
    resizeRef.current = { edge, sx: e.clientX, sy: e.clientY, x: f.x, y: f.y, w: f.w, h: f.h };
    const el = windowRef.current;
    if (el) el.setPointerCapture(e.pointerId);
  }, []);

  const onResizeMove = useCallback((e: ReactPointerEvent) => {
    const state = resizeRef.current;
    if (!state) return;
    const dx = e.clientX - state.sx;
    const dy = e.clientY - state.sy;

    const maxW = Math.max(minWidth, window.innerWidth - EDGE_MARGIN * 2);
    const maxH = Math.max(minHeight, window.innerHeight - EDGE_MARGIN * 2);

    let nextX = state.x;
    let nextY = state.y;
    let nextW = state.w;
    let nextH = state.h;

    if (state.edge.includes('e')) nextW = clamp(state.w + dx, minWidth, maxW);
    if (state.edge.includes('s')) nextH = clamp(state.h + dy, minHeight, maxH);
    if (state.edge.includes('w')) {
      const right = state.x + state.w;
      nextW = clamp(state.w - dx, minWidth, maxW);
      nextX = right - nextW;
    }
    if (state.edge.includes('n')) {
      const bottom = state.y + state.h;
      nextH = clamp(state.h - dy, minHeight, maxH);
      nextY = bottom - nextH;
    }

    const next = { x: nextX, y: nextY, w: nextW, h: nextH };
    frameRef.current = next;
    if (windowRef.current) applyFrame(windowRef.current, next);
  }, [minWidth, minHeight]);

  const onResizeUp = useCallback((e: ReactPointerEvent) => {
    resizeRef.current = null;
    const el = windowRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  /* ════════════════════════════════════════
     Pointer dispatch
     ════════════════════════════════════════ */
  const onWindowPointerMove = useCallback((e: ReactPointerEvent) => {
    if (resizeRef.current) { onResizeMove(e); return; }
    if (dragRef.current) onDragMove(e);
  }, [onDragMove, onResizeMove]);

  const onWindowPointerUp = useCallback((e: ReactPointerEvent) => {
    if (resizeRef.current) { onResizeUp(e); return; }
    if (dragRef.current) onDragUp(e);
  }, [onDragUp, onResizeUp]);

  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('有未儲存的變更，確定要關閉嗎？')) return;
    }
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={windowRef}
      className="rew-window"
      onPointerMove={onWindowPointerMove}
      onPointerUp={onWindowPointerUp}
      onPointerCancel={onWindowPointerUp}
    >
      {/* ── Header (drag handle) ── */}
      <div className="rew-header" onPointerDown={onTitlePointerDown}>
        <div className="rew-traffic">
          <button
            type="button"
            className="rew-traffic-btn rew-traffic-btn--close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            aria-label="關閉"
            title="關閉"
          />
        </div>
        <div className="rew-title-group">
          <span className="rew-title">{title}</span>
          {subtitle && <span className="rew-subtitle">{subtitle}</span>}
        </div>
      </div>

      {/* ── Body (scrollable, container query root) ── */}
      <div className="rew-body">
        {children}
      </div>

      {/* ── Footer (fixed at bottom) ── */}
      {footer && (
        <div className="rew-footer">
          {footer}
        </div>
      )}

      {/* ── Resize zones (hidden on mobile via CSS) ── */}
      <div className="rew-resize-layer" aria-hidden="true">
        {RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            className={`rew-resize-zone rew-resize-zone--${edge}`}
            onPointerDown={onResizePointerDown(edge)}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
