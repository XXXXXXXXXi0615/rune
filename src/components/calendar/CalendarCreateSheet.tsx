import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface CalendarCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  typeLabel: string;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  children: React.ReactNode;
  deleteButton?: React.ReactNode;
  dirty?: boolean;
  showClose?: boolean;
  testId?: string;
  className?: string;
}

export function CalendarCreateSheet({
  isOpen,
  onClose,
  onConfirm,
  typeLabel,
  title,
  subtitle,
  confirmLabel = '建立',
  confirmDisabled,
  children,
  deleteButton,
  dirty,
  showClose,
  testId,
  className,
}: CalendarCreateSheetProps) {
  const [showDiscard, setShowDiscard] = useState(false);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    const prev = prevFocusRef.current;
    onClose();
    requestAnimationFrame(() => prev?.focus?.());
  }, [onClose]);

  const attemptClose = useCallback(() => {
    if (dirty) {
      setShowDiscard(true);
    } else {
      handleClose();
    }
  }, [dirty, handleClose]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscard(false);
    handleClose();
  }, [handleClose]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscard(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    prevFocusRef.current = document.activeElement as HTMLElement;
    const timer = requestAnimationFrame(() => {
      const body = sheetRef.current?.querySelector('.cal-create-body');
      if (body) {
        const first = body.querySelector('input, button, textarea, select') as HTMLElement | null;
        first?.focus();
      }
    });
    return () => {
      cancelAnimationFrame(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        attemptClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, attemptClose]);

  useEffect(() => {
    if (!isOpen) setShowDiscard(false);
  }, [isOpen]);

  const handleTrapTab = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !sheetRef.current) return;
    const focusables = Array.from(
      sheetRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="cal-create-backdrop" onClick={attemptClose}>
      <div
        className={className ? `cal-create-sheet ${className}` : 'cal-create-sheet'}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleTrapTab}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <div className="cal-create-header">
          <span className="cal-create-type-label">{typeLabel}</span>
          <h2>{title}</h2>
          {subtitle && <p className="cal-create-subtitle">{subtitle}</p>}
          {showClose && <button type="button" className="cal-create-close-btn" onClick={attemptClose} aria-label="關閉">×</button>}
        </div>

        <div className="cal-create-body">
          {children}
        </div>

        <div className="cal-create-footer">
          <div className="cal-create-footer-left">
            {deleteButton}
          </div>
          <div className="cal-create-footer-right">
            <button type="button" className="cal-create-cancel-btn" onClick={attemptClose}>取消</button>
            <button type="button" className="cal-create-confirm-btn" onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </button>
          </div>
        </div>

        {showDiscard && (
          <div className="cal-create-discard-overlay" onClick={handleDiscardCancel}>
            <div className="cal-create-discard-card" onClick={(e) => e.stopPropagation()}>
              <strong>捨棄變更？</strong>
              <p>你已修改了表單內容，確定要捨棄嗎？</p>
              <div className="cal-create-discard-actions">
                <button type="button" className="cal-create-cancel-btn" onClick={handleDiscardCancel}>繼續編輯</button>
                <button type="button" className="cal-create-danger-btn" onClick={handleDiscardConfirm}>捨棄</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
