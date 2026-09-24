import { useEffect, useRef, type ReactNode } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';

export function InteractionWindowHeader({ children }: { children: ReactNode }) {
  return <div className="pr-attach-head interaction-window-header">{children}</div>;
}

export function InteractionWindowScrollBody({ children }: { children: ReactNode }) {
  return <div className="pr-attach-body-scroll interaction-window-scroll-body">{children}</div>;
}

export function InteractionWindowFooter({ children }: { children: ReactNode }) {
  return <div className="pr-attach-footer interaction-window-footer">{children}</div>;
}

export function ChatInteractionWindow({ children, header, footer, onRequestClose, onEscape, ariaLabel }: {
  children: ReactNode;
  header: ReactNode;
  footer?: ReactNode;
  onRequestClose: () => void;
  onEscape: () => void;
  ariaLabel: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusLabelRef = useRef<string | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  useEffect(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    returnFocusRef.current = activeElement && activeElement !== document.body
      ? activeElement
      : document.querySelector<HTMLElement>('[aria-expanded="true"]');
    returnFocusLabelRef.current = returnFocusRef.current?.getAttribute('aria-label') ?? null;
    const dialog = dialogRef.current;
    dialog?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onEscapeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
      requestAnimationFrame(() => requestAnimationFrame(() => {
          const label = returnFocusLabelRef.current;
          const currentTarget = label
            ? [...document.querySelectorAll<HTMLElement>('[aria-label]')].find((element) => element.getAttribute('aria-label') === label)
            : null;
          (currentTarget ?? returnFocusRef.current)?.focus();
        }));
    };
  }, []);
  return <MobileShellOverlay variant="sheet" onClose={onRequestClose} className="pr-attach-overlay"><div ref={dialogRef} tabIndex={-1} className="pr-attach-dialog chat-interaction-window" role="dialog" aria-modal="true" aria-label={ariaLabel} data-pet-safe-region="critical" onClick={event=>event.stopPropagation()}><div className="pr-attach-handle"/><button type="button" className="pr-attach-close" onClick={onRequestClose} aria-label="關閉"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>{header}{children}{footer}</div></MobileShellOverlay>;
}
