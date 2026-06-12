import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, TextMessage, ImageMessage, FileMessage, StickerMessage } from '@/types';
import { getAsset } from '@/store/assets';
import { useToastStore } from '@/store/useToastStore';
import { t } from '@/i18n';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatMessageMeta(message: Message) {
  const status = message.status === 'sent'
    ? '✓'
    : message.status === 'delivered' || message.status === 'read'
      ? '✓✓'
      : '';
  return [formatTime(message.time), status].filter(Boolean).join(' ');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -------------------------------------------------------
// useAsset — load blob from IndexedDB, manage object URL
// -------------------------------------------------------
function useAsset(assetId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAsset(assetId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) { setLoading(false); setError(true); return; }
        const objectUrl = URL.createObjectURL(blob);
        urlRef.current = objectUrl;
        setUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setLoading(false); setError(true); } });
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [assetId]);

  return { url, loading, error };
}

// -------------------------------------------------------
// Text
// -------------------------------------------------------
function TextBubble({ message }: { message: TextMessage }) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const thinking = message.thinking;

  return (
    <div className="message-bubble">
      {/* ── Thinking block (Claude-style) ── */}
      {thinking && (
        <div className="think-card" onClick={() => setThinkingOpen((v) => !v)}>
          {/* Collapsed header */}
          <div className="think-header">
            <span className={`think-dot ${thinking.status}`} />
            <span className="think-label">
              {thinking.status === 'done' ? '已想完' : '思考中'}
            </span>
            {thinking.finishedAt && thinking.startedAt && (
              <span className="think-duration">
                {((thinking.finishedAt - thinking.startedAt) / 1000).toFixed(1)}s
              </span>
            )}
            <svg className={`think-chevron ${thinkingOpen ? 'open' : ''}`} viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Expanded body */}
          {thinkingOpen && (
            <div className="think-body">
              {/* Character thought */}
              <div className="think-thought">
                {thinking.characterThought}
              </div>
              {/* Runtime steps timeline */}
              {thinking.runtimeSteps.length > 0 && (
                <div className="think-timeline">
                  {thinking.runtimeSteps.map((step, i) => (
                    <div key={i} className="think-step">
                      <span className="think-step-dot" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {message.content}
      {message.memoryContextUsed && (
        <div className="memory-badge">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
            <path d="M21 10.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h4.5l2-3 2 3H19a2 2 0 012 2z" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="14" x2="12" y2="14.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t('chat.memoryBadge')}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Image
// -------------------------------------------------------
function ImageBubble({ message }: { message: ImageMessage }) {
  const { url, loading, error } = useAsset(message.assetId);
  return (
    <div className="message-bubble image-bubble">
      {loading && <div className="image-skeleton" />}
      {error && (
        <div className="asset-missing">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
          </svg>
          <span>{t('chat.assetMissing')}</span>
        </div>
      )}
      {url && <img src={url} alt={message.caption || 'Image'} loading="lazy" />}
      {message.caption && <div className="message-image-caption">{message.caption}</div>}
    </div>
  );
}

// -------------------------------------------------------
// File
// -------------------------------------------------------
function FileBubble({ message }: { message: FileMessage }) {
  const [downloading, setDownloading] = useState(false);
  const showToast = useToastStore((s) => s.showToast);
  const isImageType = message.fileType.startsWith('image/');
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await getAsset(message.assetId);
      if (!blob) { showToast(t('chat.assetNotFound')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = message.fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch { showToast(t('shared.downloadFail')); }
    finally { setDownloading(false); }
  }, [message.assetId, message.fileName, showToast]);

  return (
    <button className="message-bubble file-bubble" onClick={handleDownload} disabled={downloading}
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
      <div className="file-bubble-icon">
        {isImageType ? (
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
        ) : (
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        )}
      </div>
      <div className="file-bubble-info">
        <div className="file-bubble-name">{message.fileName}</div>
        <div className="file-bubble-size">{downloading ? '...' : formatSize(message.fileSize)}</div>
      </div>
    </button>
  );
}

// -------------------------------------------------------
// Sticker
// -------------------------------------------------------
function StickerBubble({ message }: { message: StickerMessage }) {
  const [error, setError] = useState(false);
  return (
    <div className="message-bubble sticker-bubble">
      {error ? (
        <div className="sticker-fallback">{t('sticker.loadFail')}</div>
      ) : (
        <img
          src={message.stickerUrl}
          alt={message.stickerName || 'sticker'}
          className="sticker-msg-img"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------
// MessageBubble
// -------------------------------------------------------
type Position = 'first' | 'middle' | 'last' | 'only';

interface MessageBubbleProps {
  message: Message;
  position: Position;
  showTime: boolean;
  showAvatar: boolean;
  onAction?: (msgId: string) => void;
}

export function MessageBubble({ message, position, showTime, onAction }: MessageBubbleProps) {
  const isMe = message.sender === 'me';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onAction?.(message.id);
  };

  // Revoked state — show placeholder text
  if (message.revoked) {
    return (
      <div
        className={`message-row ${isMe ? 'me' : 'friend'} pos-${position}`}
        onContextMenu={handleContextMenu}
      >
        <div className="message-bubble message-bubble--revoked">
          <span className="revoked-label">{t('msg.revokedNotice')}</span>
        </div>
        {showTime && (
          <div className="message-meta">{formatMessageMeta(message)}</div>
        )}
      </div>
    );
  }

  const body = (() => {
    switch (message.type) {
      case 'text': return <TextBubble message={message} />;
      case 'image': return <ImageBubble message={message} />;
      case 'file': return <FileBubble message={message} />;
      case 'sticker': return <StickerBubble message={message} />;
    }
  })();

  return (
    <div
      className={`message-row ${isMe ? 'me' : 'friend'} pos-${position}`}
      onContextMenu={handleContextMenu}
    >
      {body}
      {showTime && (
        <div className="message-meta">{formatMessageMeta(message)}</div>
      )}
    </div>
  );
}
