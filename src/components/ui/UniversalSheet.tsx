import { type FormEvent, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface UniversalSheetProps {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  children: ReactNode;
  as?: 'form' | 'section';
  onSubmit?: (e: FormEvent) => void;
}

export function UniversalSheet({
  title, eyebrow, onClose, onSave, saveLabel, cancelLabel,
  saveDisabled, children, as = 'section', onSubmit,
}: UniversalSheetProps) {
  useEffect(() => {
    document.body.classList.add('sheet-open');
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('sheet-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const Tag = as;

  const handleClickSave = () => {
    if (as === 'form') return; // use onSubmit instead
    onSave?.();
  };

  return createPortal(
    <div className="calendar-event-backdrop" onClick={onClose}>
      <Tag
        className="calendar-event-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="us-title"
        onClick={e => e.stopPropagation()}
        onSubmit={as === 'form' ? onSubmit : undefined}
      >
        <div className="calendar-event-sheet-handle" />
        <header className="calendar-event-sheet-header">
          <div>
            {eyebrow && <div className="universal-eyebrow">{eyebrow}</div>}
            <h2 id="us-title">{title}</h2>
          </div>
          <button type="button" className="calendar-event-sheet-close" onClick={onClose} aria-label="關閉">&#x2715;</button>
        </header>
        <div className="calendar-event-sheet-body">
          {children}
        </div>
        <footer className="calendar-event-sheet-footer">
          <button type="button" className="calendar-event-sheet-btn ghost" onClick={onClose}>{cancelLabel || '取消'}</button>
          <button
            type={as === 'form' ? 'submit' : 'button'}
            className="calendar-event-sheet-btn primary"
            onClick={as !== 'form' ? handleClickSave : undefined}
            disabled={saveDisabled}
            style={saveDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            {saveLabel || '儲存'}
          </button>
        </footer>
      </Tag>
    </div>,
    document.body,
  );
}
