import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GachaContextPayload } from '@/components/chat/ChatGachaPanel';
import { usePetRecede } from '@/hooks/usePetRecede';

interface GachaContextChipMenuProps {
  title: string;
  onEdit: () => void;
  onReselect: () => void;
  onRemove: () => void;
}

function MenuItems({ onPick, onEdit, onReselect, onRemove }: {
  onPick: () => void;
  onEdit: () => void;
  onReselect: () => void;
  onRemove: () => void;
}) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <>
      <button type="button" role="menuitem" onClick={() => { onPick(); onEdit(); }}>
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        <span>編輯素材</span>
      </button>
      <button type="button" role="menuitem" onClick={() => { onPick(); onReselect(); }}>
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>
        <span>重新選擇</span>
      </button>
      <button type="button" role="menuitem" className="is-danger" onClick={() => { onPick(); onRemove(); }}>
        <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>刪除</span>
      </button>
    </>
  );
}

/**
 * ⋯ actions for a gacha context chip.
 * Desktop: anchored popover. Mobile (<768px): bottom sheet.
 */
export function GachaContextChipMenu({ title, onEdit, onReselect, onRemove }: GachaContextChipMenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({
        left: Math.min(Math.max(8, rect.right - 150), window.innerWidth - 158),
        bottom: window.innerHeight - rect.top + 8,
      });
    }
    setOpen(true);
  };

  return (
    <span className="gc-chip-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="gc-chip-menu-trigger"
        aria-label={`素材選項：${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="gc-chip-menu"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
      </button>
      {open && !isMobile && anchor && createPortal(
        <div
          ref={menuRef}
          className="gc-chip-menu"
          role="menu"
          aria-label={`素材操作：${title}`}
          style={{ position: 'fixed', left: anchor.left, bottom: anchor.bottom }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MenuItems onPick={close} onEdit={onEdit} onReselect={onReselect} onRemove={onRemove} />
        </div>,
        document.body,
      )}
      {open && isMobile && createPortal(
        <div className="gc-chip-sheet-overlay" onClick={close}>
          <div
            className="gc-chip-sheet"
            role="menu"
            aria-label={`素材操作：${title}`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="gc-chip-sheet-handle" aria-hidden="true" />
            <p className="gc-chip-sheet-title">{title}</p>
            <MenuItems onPick={close} onEdit={onEdit} onReselect={onReselect} onRemove={onRemove} />
            <button type="button" className="gc-chip-sheet-cancel" onClick={close}>取消</button>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

interface GachaContextChipEditorProps {
  payload: GachaContextPayload;
  onSave: (patch: { titleSnapshot: string; contentSnapshot?: string }) => void;
  onClose: () => void;
}

/** Inline editor for a selected gacha material — edits the chat-local snapshot only. */
export function GachaContextChipEditor({ payload, onSave, onClose }: GachaContextChipEditorProps) {
  const [title, setTitle] = useState(payload.context.titleSnapshot);
  const [content, setContent] = useState(payload.context.contentSnapshot || '');
  usePetRecede(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const canSave = title.trim().length > 0;

  return createPortal(
    <div className="gc-chip-editor-backdrop" onClick={onClose}>
      <div
        className="gc-chip-editor"
        role="dialog"
        aria-modal="true"
        aria-label="編輯上下文素材"
        data-testid="gc-chip-editor"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h3>編輯素材</h3>
          <span className="gc-chip-editor-source">{payload.context.poolNameSnapshot}</span>
        </header>
        <label>
          <span>標題</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="素材標題" data-testid="gc-chip-editor-title" />
        </label>
        <label>
          <span>內容</span>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={3} aria-label="素材內容" />
        </label>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="is-primary"
            disabled={!canSave}
            data-testid="gc-chip-editor-save"
            onClick={() => onSave({ titleSnapshot: title.trim(), contentSnapshot: content.trim() || undefined })}
          >
            儲存
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
