import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function FullScreenPanel({ isOpen, onClose, title, subtitle, children, footer }: Props) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fullscreen-panel-overlay">
      <div className="fullscreen-panel">
        {/* Header */}
        <div className="fullscreen-panel-header">
          <button type="button" className="fullscreen-panel-back" onClick={onClose} aria-label="返回">
            <svg viewBox="0 0 24 24" width={20} height={20} stroke="currentColor" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="fullscreen-panel-title-area">
            <div className="fullscreen-panel-title">{title}</div>
            {subtitle && <div className="fullscreen-panel-subtitle">{subtitle}</div>}
          </div>
        </div>

        {/* Body */}
        <div className="fullscreen-panel-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="fullscreen-panel-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
