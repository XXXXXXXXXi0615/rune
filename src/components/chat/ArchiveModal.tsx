import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '@/types';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function previewLabel(msg: Message): string {
  if (msg.type === 'text') {
    const clean = msg.content.replace(/<[^>]*>/g, '').trim();
    return clean.length > 36 ? `${clean.slice(0, 36)}…` : clean;
  }
  if (msg.type === 'image') return msg.caption || '📷 圖片';
  if (msg.type === 'file') return msg.fileName || '📄 檔案';
  if (msg.type === 'sticker') return msg.stickerName || '✨ 貼圖';
  return '';
}

interface ArchiveModalProps {
  open: boolean;
  onClose: () => void;
  archivedItems: Message[];
  onUnarchive: (id: string) => void;
  onScrollTo: (id: string) => void;
}

export function ArchiveModal({
  open,
  onClose,
  archivedItems,
  onUnarchive,
  onScrollTo,
}: ArchiveModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleJump = (id: string) => {
    onUnarchive(id);
    onClose();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onScrollTo(id);
      });
    });
  };

  return createPortal(
    <div className="archive-modal-overlay" onClick={onClose} aria-hidden="true">
      <div
        ref={modalRef}
        className="archive-modal"
        role="dialog"
        aria-modal="true"
        aria-label="封存訊息"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="archive-modal-header">
          <div className="archive-modal-heading">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
              <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
            </svg>
            <h2>封存訊息</h2>
            <span className="archive-modal-badge">{archivedItems.length}</span>
          </div>
          <button type="button" className="archive-modal-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="archive-modal-body">
          {archivedItems.length === 0 ? (
            <div className="archive-modal-empty">
              <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={0.36}>
                <path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" />
                <path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7z" />
              </svg>
              <p>沒有封存訊息。這裡暫時很乾淨。</p>
            </div>
          ) : (
            <div className="archive-modal-list">
              {archivedItems.map((msg) => (
                <div key={msg.id} className={`archive-item${msg.pinned ? ' archive-item--pinned' : ''}`}>
                  <div className="archive-item-meta">
                    <span className="archive-item-sender">
                      {msg.pinned && (
                        <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="archive-item-pin-icon" aria-label="已釘選">
                          <path d="M16 3L9.5 9.5l-3.5 1 1 3L3 19l2 2 5.5-4 3 1 1-3.5L21 8V3z" />
                          <line x1="9" y1="9.5" x2="12" y2="12.5" />
                        </svg>
                      )}
                      {msg.sender === 'me' ? '我' : 'LUNARIS'}
                    </span>
                    <span className="archive-item-time">{formatTime(msg.time)}</span>
                  </div>
                  <div className="archive-item-preview" role="button" tabIndex={0} onClick={() => handleJump(msg.id)} onKeyDown={(e) => { if (e.key === 'Enter') handleJump(msg.id); }}>
                    {previewLabel(msg)}
                  </div>
                  <div className="archive-item-actions">
                    <button type="button" className="archive-item-btn archive-item-btn--restore" onClick={() => onUnarchive(msg.id)} aria-label="恢復訊息">
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.5 16a9 9 0 101-10l-4 4" />
                      </svg>
                      <span>恢復</span>
                    </button>
                    <button type="button" className="archive-item-btn archive-item-btn--jump" onClick={() => handleJump(msg.id)} aria-label="跳轉訊息">
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polyline points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>跳轉</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
