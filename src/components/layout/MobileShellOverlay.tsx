import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface MobileShellOverlayProps {
  children: ReactNode;
  onClose: () => void;
  variant?: 'fullscreen' | 'sheet' | 'dialog';
  dismissOnBackdrop?: boolean;
  className?: string;
}

const OPEN_EVENT = 'lunartide:mobile-overlay-opened';

/** Single shell-relative overlay contract. It never mutates persisted Dock state. */
export function MobileShellOverlay({
  children,
  onClose,
  variant = 'fullscreen',
  dismissOnBackdrop = true,
  className = '',
}: MobileShellOverlayProps) {
  const reactId = useId();
  const id = `mobile-overlay-${reactId.replaceAll(':', '')}`;
  const app = typeof document === 'undefined' ? null : document.getElementById('app');
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!app) return;
    const workspace = app.querySelector<HTMLElement>('.app-workspace');
    const handleCompetingOverlay = (event: Event) => {
      if ((event as CustomEvent<{ id: string }>).detail.id !== id) onCloseRef.current();
    };
    window.addEventListener(OPEN_EVENT, handleCompetingOverlay);
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }));
    app.dataset.mobileOverlayActive = id;
    app.classList.add('app--mobile-overlay-open');
    workspace?.setAttribute('inert', '');
    workspace?.setAttribute('aria-hidden', 'true');
    return () => {
      window.removeEventListener(OPEN_EVENT, handleCompetingOverlay);
      if (app.dataset.mobileOverlayActive !== id) return;
      delete app.dataset.mobileOverlayActive;
      app.classList.remove('app--mobile-overlay-open');
      workspace?.removeAttribute('inert');
      workspace?.removeAttribute('aria-hidden');
    };
  }, [app, id]);

  if (!app) return null;
  return createPortal(
    <div
      className={`mobile-shell-overlay mobile-shell-overlay--${variant}${className ? ` ${className}` : ''}`}
      data-mobile-overlay-layer={variant}
      onPointerDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    app,
  );
}
