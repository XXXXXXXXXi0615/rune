import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore, selectPartnerDisplayName, selectPartnerAvatar } from '@/store/useAppStore';
import { AvatarAssetImage, IdentityAvatar } from '@/components/chat/ConversationAvatars';
import { QUICK_REPLIES, type QuickReplyKey, type CallMode } from '@/types/call';
import './IncomingCallOverlay.css';

interface IncomingCallOverlayProps {
  callReason?: string;
  callMode?: CallMode;
  onAccept: () => void;
  onDecline: () => void;
  onDeclineWithReply: (text: string) => void;
}

export function IncomingCallOverlay({
  callReason,
  callMode = 'voice',
  onAccept,
  onDecline,
  onDeclineWithReply,
}: IncomingCallOverlayProps) {
  const partner = useAppStore((s) => s.partner);
  const partnerName = selectPartnerDisplayName(partner);
  const partnerAvatar = selectPartnerAvatar(partner);
  const [showQuickReply, setShowQuickReply] = useState(false);
  const [customText, setCustomText] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus trap: focus accept button on mount
  useEffect(() => {
    acceptRef.current?.focus();
  }, []);

  // Focus trap: when quick reply opens, focus first chip
  useEffect(() => {
    if (showQuickReply) {
      const firstChip = cardRef.current?.querySelector<HTMLButtonElement>('.cc-incoming-chips button');
      firstChip?.focus();
    }
  }, [showQuickReply]);

  // Focus trap implementation
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQuickReply) {
          setShowQuickReply(false);
          acceptRef.current?.focus();
        } else {
          onDecline();
        }
        return;
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusable = card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    card.addEventListener('keydown', handleKeyDown);
    return () => card.removeEventListener('keydown', handleKeyDown);
  }, [onDecline, showQuickReply]);

  const handleQuickReply = useCallback(
    (key: QuickReplyKey) => {
      const reply = QUICK_REPLIES.find((r) => r.key === key);
      if (reply) {
        onDeclineWithReply(reply.text);
      }
    },
    [onDeclineWithReply],
  );

  const handleCustomReply = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = customText.trim();
      if (!text) return;
      onDeclineWithReply(text);
    },
    [customText, onDeclineWithReply],
  );

  const handleDecline = useCallback(() => {
    if (showQuickReply) {
      // Already showing quick reply, decline directly
      onDecline();
    } else {
      setShowQuickReply(true);
    }
  }, [showQuickReply, onDecline]);

  return createPortal(
    <div className="cc-incoming-overlay" ref={overlayRef} data-testid="incoming-call-overlay">
      <div className="cc-incoming-backdrop" />
      <div
        className="cc-incoming-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${partnerName} 來電`}
      >
          <div className="cc-incoming-kind" aria-hidden="true">
            <svg className="cc-incoming-kind-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {callMode === 'video' ? (
                <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M16 10l5-4v12l-5-4" /></>
              ) : (
                <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.4 0 .8-.2 1l-3 2.2z" />
              )}
            </svg>
            {callMode === 'video' ? '視訊來電' : '語音來電'}
          </div>

        <div className="cc-incoming-avatar-wrap">
          <div className="cc-incoming-ripple" aria-hidden="true" />
          <div className="cc-incoming-ripple cc-incoming-ripple--r2" aria-hidden="true" />
          <div className="cc-incoming-ripple cc-incoming-ripple--r3" aria-hidden="true" />
          <div className="cc-incoming-avatar">
            {partnerAvatar ? (
              <AvatarAssetImage
                assetId={partnerAvatar.key}
                alt={partnerName}
              />
            ) : (
              <IdentityAvatar identityId="lunaris" size={44} label={partnerName} />
            )}
          </div>
        </div>

        <div className="cc-incoming-name">{partnerName}</div>

        {callReason && (
          <div className="cc-incoming-reason">{callReason}</div>
        )}

        <div className="cc-incoming-dock">
          <button
            type="button"
            className="cc-incoming-btn cc-incoming-btn--decline"
            onClick={handleDecline}
            aria-label="拒接電話"
          >
            <span className="cc-incoming-btn-ico">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <g transform="rotate(135 12 12)">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.4 0 .8-.2 1l-3 2.2z" />
                </g>
              </svg>
            </span>
            <span className="cc-incoming-btn-label">挂断</span>
          </button>

          <button
            type="button"
            className="cc-incoming-btn cc-incoming-btn--accept"
            onClick={onAccept}
            ref={acceptRef}
            aria-label="接聽電話"
          >
            <span className="cc-incoming-btn-ico">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.4 0 .8-.2 1l-3 2.2z" />
              </svg>
            </span>
            <span className="cc-incoming-btn-label">接听</span>
          </button>
        </div>

        <div className={`cc-incoming-quick${showQuickReply ? ' is-open' : ''}`}>
          <div className="cc-incoming-chips">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr.key}
                type="button"
                className="cc-incoming-chip"
                onClick={() => handleQuickReply(qr.key)}
              >
                {qr.text}
              </button>
            ))}
          </div>
          <form className="cc-incoming-custom" onSubmit={handleCustomReply}>
            <input
              ref={inputRef}
              type="text"
              maxLength={60}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="或者打几个字…"
              aria-label="自訂回覆文字"
            />
            <button type="submit" className="cc-incoming-send" disabled={!customText.trim()}>
              发送
            </button>
          </form>
          <button
            type="button"
            className="cc-incoming-skip"
            onClick={onDecline}
          >
            直接挂断
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
