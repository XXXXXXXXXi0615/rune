import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChatPresenceIcon } from '@/components/chat/ChatPresenceIcon';
import { t } from '@/i18n';
import type { ChatPresenceStatus } from '@/types';

const STATUS_OPTIONS: ChatPresenceStatus[] = ['online', 'invisible', 'busy', 'syncing', 'offline', 'local', 'quiet'];

interface ChatStatusSheetProps {
  currentStatus: ChatPresenceStatus;
  onSelect: (status: ChatPresenceStatus) => void;
  onClose: () => void;
}

export function ChatStatusSheet({ currentStatus, onSelect, onClose }: ChatStatusSheetProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="confirm-sheet-overlay active" onClick={onClose}>
      <section className="confirm-sheet chat-status-sheet" role="dialog" aria-modal="true" aria-labelledby="chat-status-title" onClick={(event) => event.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <header className="chat-status-sheet-header">
          <div>
            <span>{t('chat.statusMenuEyebrow')}</span>
            <h2 id="chat-status-title">{t('chat.changeStatus')}</h2>
          </div>
          <button type="button" className="chat-status-close" onClick={onClose} aria-label={t('sheet.cancel')}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="chat-status-options">
          {STATUS_OPTIONS.map((status) => (
            <button
              type="button"
              key={status}
              className={`chat-status-option chat-status-option--${status} ${currentStatus === status ? 'active' : ''}`}
              onClick={() => onSelect(status)}
              aria-pressed={currentStatus === status}
            >
              <span className="chat-status-option-icon"><ChatPresenceIcon status={status} /></span>
              <span className="chat-status-option-copy">
                <strong>{t(`chat.presence.${status}`)}</strong>
              </span>
              {currentStatus === status && (
                <svg className="icon chat-status-check" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
