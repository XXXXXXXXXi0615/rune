import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
}

export function SettingsModal({ isOpen, onClose, title, subtitle, children, maxWidth = 360 }: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="lang-modal-overlay" onClick={onClose}>
      <div className="lang-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth }}>
        <h2 className="lang-modal-title">{title}</h2>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: -8, marginBottom: 4 }}>{subtitle}</div>}
        {children}
        <button type="button" className="liquid-btn lang-modal-cancel" onClick={onClose}>
          {t('sheet.cancel')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
