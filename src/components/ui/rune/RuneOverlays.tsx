import classNames from 'classnames';
import { type HTMLAttributes, type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './RunePrimitives.css';

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => (ref.current?.querySelector<HTMLElement>(focusable) ?? ref.current)?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !ref.current) return;
      const nodes = [...ref.current.querySelectorAll<HTMLElement>(focusable)];
      if (!nodes.length) return;
      const direction = event.shiftKey ? -1 : 1;
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      const next = (index + direction + nodes.length) % nodes.length;
      if ((direction < 0 && index <= 0) || (direction > 0 && index === nodes.length - 1)) { event.preventDefault(); nodes[next].focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, [open]);
  return ref;
}

export function RunePopoverSurface({ open, onClose, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { open: boolean; onClose: () => void }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return <div ref={ref as React.RefObject<HTMLDivElement>} className={classNames('rune-floating-surface rune-popover', className)} tabIndex={-1} {...props}>{children}</div>;
}

export function RuneSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(<div className="rune-sheet-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={ref} className="rune-floating-surface rune-sheet" role="dialog" aria-modal="true" aria-labelledby="rune-sheet-title" tabIndex={-1}>
      <span className="rune-sheet__handle" aria-hidden="true" /><h2 id="rune-sheet-title">{title}</h2>{children}
    </section>
  </div>, document.body);
}

export function RuneContextMenu({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div className={classNames('rune-floating-surface rune-context-menu', className)} role="menu" aria-label={label}>{children}</div>;
}
