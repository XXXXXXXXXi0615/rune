/**
 * FloatingEditorWindow — reusable draggable floating editor window.
 *
 * Features:
 * - Drag by header, bounded inside viewport
 * - Position remembered via localStorage (storageKey)
 * - Header (fixed) + Scrollable Body + Footer (fixed)
 * - ESC / close with dirty confirmation
 * - Click outside does NOT close
 * - Body scroll lock (page behind never scrolls)
 *
 * Designed to be reused for: Worldbook, Character Card, Prompt, Vault, etc.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import './FloatingEditorWindow.css';

export interface FloatingEditorWindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Scrollable body content */
  children: ReactNode;
  /** Footer actions (Cancel + Confirm buttons) */
  footer?: ReactNode;
  /** Window width in px (default 480) */
  width?: number;
  /** Default x,y when no saved position exists (centered by default) */
  defaultPosition?: { x: number; y: number };
  /** localStorage key for persisting position */
  storageKey?: string;
  /** If true, ESC / close button will show a confirm dialog */
  dirty?: boolean;
}

const MIN_EDGE = 20;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

function readPosition(key: string): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(`fe_${key}`);
    if (raw) return JSON.parse(raw) as { x: number; y: number };
  } catch { /* noop */ }
  return null;
}

function writePosition(key: string, pos: { x: number; y: number }) {
  try { localStorage.setItem(`fe_${key}`, JSON.stringify(pos)); } catch { /* noop */ }
}

export function FloatingEditorWindow({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  defaultPosition,
  storageKey,
  dirty = false,
}: FloatingEditorWindowProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef(position);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Keep ref in sync so onPointerUp saves correct position
  useEffect(() => { positionRef.current = position; }, [position]);
  const windowRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);

  // Initialise position
  useEffect(() => {
    if (!open) { initialised.current = false; return; }
    if (initialised.current) return;
    initialised.current = true;

    const saved = storageKey ? readPosition(storageKey) : null;
    if (saved) {
      setPosition(saved);
    } else if (defaultPosition) {
      setPosition(defaultPosition);
    } else {
      // Center
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition({
        x: Math.max(MIN_EDGE, (vw - width) / 2),
        y: Math.max(MIN_EDGE, (vh - 600) / 2),
      });
    }
  }, [open, width, defaultPosition, storageKey]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // ESC handler
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

  // Drag handlers
  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const el = windowRef.current;
    if (!el) return;
    const maxX = window.innerWidth - el.offsetWidth - MIN_EDGE;
    const maxY = window.innerHeight - 72 - MIN_EDGE; // keep footer accessible
    setPosition({
      x: clamp(dragStart.current.px + dx, MIN_EDGE, maxX),
      y: clamp(dragStart.current.py + dy, MIN_EDGE, maxY),
    });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    // Save position
    if (storageKey && windowRef.current) {
      writePosition(storageKey, positionRef.current);
    }
  }, [storageKey]);

  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('有未儲存的變更，確定要關閉嗎？')) return;
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="few-overlay" onClick={onClose}>
      <div
        ref={windowRef}
        className="few-window"
        style={{ width, left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header — draggable */}
        <div
          className="few-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="few-title">{title}</span>
          <button
            type="button"
            className="few-close"
            onClick={handleClose}
            aria-label="關閉"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="few-body">
          {children}
        </div>

        {/* Footer — fixed */}
        {footer && (
          <div className="few-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
