import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Message, TextMessage, ImageMessage, FileMessage, StickerMessage } from '@/types';
import { ChatVoiceBubble } from '@/components/chat/ChatVoiceBubble';
import { getAsset } from '@/store/assets';
import { useToastStore } from '@/store/useToastStore';
import { useAppStore } from '@/store/useAppStore';
import { useChatThemeStore } from '@/store/useChatThemeStore';
import { resolveMessageBubblePresentation, bubblePresentationStyleVars, shouldShowCssTail } from '@/features/chat/bubbleSkin/resolveMessageBubblePresentation';
import type { MessageBubblePresentation } from '@/features/chat/bubbleSkin/types';
import { useBubbleSkinUrl } from '@/features/chat/bubbleSkin/bubbleSkinAssets';
import { useBubbleSkinPreviewTheme } from '@/features/chat/bubbleSkin/BubbleSkinPreviewContext';
import { ReplyCard } from '@/components/ui/ReplyCard';
import { t } from '@/i18n';
import type { ContextTracePayload } from '@/ai/contextPreview';
import { lookupClawdSticker } from '@/data/defaultClawdStickers';
import { getClawdAsset } from '@/data/clawdAssetManifest';
import { InteractiveMessageRenderer } from '@/features/interactive/InteractiveToolRegistry';
import { LinkPreviewCard } from './LinkPreviewCard';

const svgProps = { width: 13, height: 13, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };


function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Compute the read receipt label for an outgoing message.
 * Single source of truth: participant read cursors (participantReadCursors on Conversation).
 * Local read receipt only — not synced with remote users.
 */
function useReadReceiptLabel(message: Message): string | null {
  const activeConversationId = useAppStore((s) => s.activeConversationId);

  return useAppStore((s) => {
    const delivery = message.deliveryStatus;
    if (delivery === 'sending') return '傳送中';
    if (delivery === 'failed') return '傳送失敗';

    // Only outgoing messages get read receipts
    const isMyIdentity = Boolean(
      message.controlSource === 'user' &&
      message.senderParticipantId &&
      message.senderParticipantId !== 'narrator',
    );
    const isOutgoing = message.sender === 'me' || isMyIdentity;
    if (!isOutgoing) return null;

    const conv = s.conversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.messages.length === 0) {
      // Old messages without read state: sent/delivered → '未讀'
      return delivery === 'sent' || delivery === 'delivered' || !delivery ? '未讀' : null;
    }

    if (conv.kind === 'group') {
      const participants = conv.participants || [];
      const msgIdx = conv.messages.findIndex((m) => m.id === message.id);
      if (msgIdx < 0) return delivery === 'sent' || delivery === 'delivered' || !delivery ? '未讀' : null;
      let total = 0;
      let read = 0;
      for (const p of participants) {
        if (p.id === message.senderParticipantId) continue;
        if (p.id === 'narrator') continue;
        total++;
        const cursor = conv.participantReadCursors?.[p.id]
          || (p.lastReadMessageId ? { lastReadMessageId: p.lastReadMessageId } : null);
        if (cursor && cursor.lastReadMessageId) {
          const cursorIdx = conv.messages.findIndex((m) => m.id === cursor.lastReadMessageId);
          if (cursorIdx >= 0 && msgIdx <= cursorIdx) read++;
        }
      }
      if (total === 0) return '未讀';
      if (read === 0) return '未讀';
      if (read >= total) return '全部已讀';
      return `已讀 ${read}/${total}`;
    }

    // Direct chat
    const cursor = conv.participantReadCursors?.['luna'];
    if (!cursor || !cursor.lastReadMessageId) {
      return delivery === 'sent' || delivery === 'delivered' || !delivery ? '未讀' : null;
    }

    const msgIdx = conv.messages.findIndex((m) => m.id === message.id);
    const cursorIdx = conv.messages.findIndex((m) => m.id === cursor.lastReadMessageId);
    if (msgIdx >= 0 && cursorIdx >= 0 && msgIdx <= cursorIdx) return '已讀';
    return '未讀';
  });
}


function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAutoIcon(label: string): string {
  const lower = label.toLowerCase();
  if (lower === '睡眠' || lower === 'sleep') return '💤';
  if (lower === '飲食' || lower === 'diet') return '🍽️';
  if (lower === '專注' || lower === 'focus') return '🎯';
  if (lower === '記憶' || lower === 'memory') return '🧠';
  if (lower === 'timeline') return '📋';
  return '📎';
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
function TextBubble({
  message,
  replyQuote,
  onScrollToMsg,
  contextTrace,
  presentation,
}: {
  message: TextMessage;
  replyQuote?: React.ReactNode;
  onScrollToMsg?: (msgId: string) => void;
  contextTrace?: ContextTracePayload;
  presentation: import('@/features/chat/bubbleSkin/types').MessageBubblePresentation;
}) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const thinking = message.thinking;
  const imageSkin = presentation.skinMode === 'image' ? presentation.image : null;
  const skinSource = imageSkin && !imageSkin.cssFallback ? imageSkin.source : undefined;
  const skinUrl = useBubbleSkinUrl(skinSource ?? undefined);
  const isImageSkin = !!imageSkin && !imageSkin.cssFallback && !!skinUrl;
  const skinVars = useMemo(() => {
    if (!isImageSkin) return undefined;
    const base = bubblePresentationStyleVars(presentation);
    if (skinUrl) (base as Record<string, string>)['--bubble-skin-image'] = `url("${skinUrl}")`;
    return base;
  }, [isImageSkin, presentation, skinUrl]);
  const showCssTail = shouldShowCssTail(presentation);

  /* ── Voice play ── */
  const showToast = useToastStore((s) => s.showToast);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const currentViewerIdentityId = useAppStore((s) => {
    const conversation = s.conversations.find((item) => item.id === s.activeConversationId);
    if (conversation?.kind === 'group') {
      return conversation.currentSpeakerParticipantId
        || conversation.groupParticipants?.find((participant) => participant.identityId === conversation.participants?.find((legacy) => legacy.isSelf)?.id)?.identityId
        || conversation.participants?.find((participant) => participant.isSelf)?.id;
    }
    return 'me';
  });
  const voiceEnabled = useAppStore((s) => s.partner.characterVoice?.enabled ?? false);
  const isAssistant = message.sender === 'assistant';

  const handleVoicePlay = () => {
    /*
     * TTS 將在後續版本接入。
     * 真正 TTS 請走後端 API proxy：POST /api/tts
     * 不要把 provider API key 放前端。
     */
    showToast('角色語音還在準備中');
  };

  // Count total trace items
  const traceTotal = contextTrace
    ? contextTrace.references.length + contextTrace.memoryCount + contextTrace.autoLabels.length
    : 0;

  // Build trace pill labels
  const tracePills: { icon: string; label: string; key: string }[] = [];
  if (contextTrace) {
    for (const ref of contextTrace.references) {
      tracePills.push({ icon: ref.icon, label: ref.label, key: `ref-${ref.label}` });
    }
    if (contextTrace.memoryCount > 0) {
      tracePills.push({ icon: '🧠', label: `記憶 (${contextTrace.memoryCount})`, key: 'memory' });
    }
    for (const label of contextTrace.autoLabels) {
      tracePills.push({ icon: getAutoIcon(label), label, key: `auto-${label}` });
    }
  }

  return (
    <div
      className="message-bubble"
      data-bubble-skin={isImageSkin ? 'image' : 'css'}
      data-bubble-skin-orientation={presentation.orientation}
      data-bubble-skin-mirrored={isImageSkin && presentation.image!.mirrored ? '1' : undefined}
      data-bubble-skin-hide-tail={showCssTail ? undefined : 'true'}
      style={skinVars}
    >
      {/* ── Reply quote ── */}
      {replyQuote}
      {/* ── Thinking block (Claude-style) ── */}
      {thinking && (
        <div className="think-card" onClick={() => setThinkingOpen((v) => !v)}>
          {/* Collapsed header — no timing shown */}
          <div className="think-header">
            <span className={`think-dot ${thinking.status}`} />
            <span className="think-label">
              {thinking.status === 'done' ? '已想完' : '思考中'}
            </span>
            <svg className={`think-chevron ${thinkingOpen ? 'open' : ''}`} viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Expanded body */}
          {thinkingOpen && (
            <div className="think-body">
              {thinking.finishedAt && thinking.startedAt && (
                <span className="think-duration">
                  耗時 {((thinking.finishedAt - thinking.startedAt) / 1000).toFixed(1)}s
                </span>
              )}
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
      {message.content && <div className="text-bubble-content">{message.content}</div>}
      {message.linkPreview && <LinkPreviewCard preview={message.linkPreview} />}
      {message.interactive && (
        <InteractiveMessageRenderer
          attachment={message.interactive}
          currentViewerIdentityId={currentViewerIdentityId}
          messageSenderIdentityId={message.senderSnapshot?.identityId || message.senderParticipantId || (message.sender === 'me' ? 'me' : undefined)}
          onChange={(interactive) => updateMessage(message.id, { interactive })}
        />
      )}
      {isAssistant && voiceEnabled && (
        <button type="button" className="text-bubble-play" onClick={handleVoicePlay} aria-label="播放語音" title="播放語音">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}
      {message.stickerUrl && (
        <img
          src={message.stickerUrl}
          alt={message.stickerName || 'sticker'}
          className="text-bubble-sticker"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      {message.memoryContextUsed && (
        <div className="memory-badge">
          <svg className="icon" viewBox="0 0 24 24" style={{ width: 10, height: 10 }}>
            <path d="M21 10.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-9a2 2 0 012-2h4.5l2-3 2 3H19a2 2 0 012 2z" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="14" x2="12" y2="14.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t('chat.memoryBadge')}
        </div>
      )}
      {/* ── Context Trace Indicator ── */}
      {contextTrace && traceTotal > 0 && (
        <div className="context-trace">
          <div className="context-trace-toggle" onClick={() => setTraceOpen((v) => !v)}>
            <svg className="context-trace-toggle-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="context-trace-label">
              引用 {traceTotal} 項上下文
            </span>
            <svg className={`context-trace-chevron ${traceOpen ? 'open' : ''}`} viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {traceOpen && (
            <div className="context-trace-detail">
              {tracePills.map((pill) => (
                <span key={pill.key} className="context-trace-pill">
                  <span className="context-trace-pill-icon">{pill.icon}</span>
                  {pill.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------
// Image
// -------------------------------------------------------
function ImageBubble({ message, replyQuote, presentation }: { message: ImageMessage; replyQuote?: React.ReactNode; presentation: MessageBubblePresentation }) {
  const { url, loading, error } = useAsset(message.assetId);
  return (
    <div className="message-bubble image-bubble" data-bubble-skin={presentation.skinMode} data-bubble-skin-orientation={presentation.orientation}>
      {replyQuote}
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
function FileBubble({ message, replyQuote, presentation }: { message: FileMessage; replyQuote?: React.ReactNode; presentation: MessageBubblePresentation }) {
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
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      data-bubble-skin={presentation.skinMode} data-bubble-skin-orientation={presentation.orientation}>
      {replyQuote}
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
function StickerBubble({ message, replyQuote, presentation }: { message: StickerMessage; replyQuote?: React.ReactNode; presentation: MessageBubblePresentation }) {
  const [error, setError] = useState(false);

  // Resolve sticker source
  const isBuiltin = message.source === 'builtin' && message.stickerId;
  const builtinSticker = isBuiltin ? (lookupClawdSticker(message.stickerId!) ?? getClawdAsset(message.stickerId!)) : undefined;
  const resolvedSrc = builtinSticker?.src ?? message.stickerUrl;
  const altText = (builtinSticker as any)?.name ?? (builtinSticker as any)?.label ?? message.stickerName ?? 'sticker';
  const isMissing = !resolvedSrc;

  return (
    <div className="message-bubble sticker-bubble" data-bubble-skin={presentation.skinMode} data-bubble-skin-orientation={presentation.orientation}>
      {replyQuote}
      {error || isMissing ? (
        <div className="sticker-fallback">
          {isMissing ? '貼圖已失效' : t('sticker.loadFail')}
        </div>
      ) : (
        <img
          src={resolvedSrc}
          alt={altText}
          className="sticker-msg-img"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

type Position = 'first' | 'middle' | 'last' | 'only';

interface MessageBubbleProps {
  message: Message;
  position: Position;
  showTime: boolean;
  showAvatar: boolean;
  allMessages: Message[];
  onAction?: (msgId: string) => void;
  onReply?: (msg: Message) => void;
  onScrollToMsg?: (msgId: string) => void;
  onMessageVisible?: (msgId: string) => void;
  contextTrace?: ContextTracePayload;
  perspectivePresentation?: {
    isPerspectiveSelf: boolean;
    mentionLabel?: string;
    replySenderName?: string;
  };
}

export function MessageBubble({ message, position, showTime, allMessages, onAction, onReply, onScrollToMsg, onMessageVisible, contextTrace, perspectivePresentation }: MessageBubbleProps) {
  const retryMessageDelivery = useAppStore((state) => state.retryMessageDelivery);
  const readReceiptLabel = useReadReceiptLabel(message);
  const isMe = perspectivePresentation?.isPerspectiveSelf ?? message.sender === 'me';
  const isNarrator = message.senderParticipantId === 'narrator';
  const isGroupConversation = useAppStore((state) => {
    const conversation = state.conversations.find((item) => item.id === state.activeConversationId);
    return conversation?.kind === 'group';
  });
  const persistedChatTheme = useChatThemeStore((state) => state.currentTheme);
  const previewChatTheme = useBubbleSkinPreviewTheme();
  const chatTheme = previewChatTheme ?? persistedChatTheme;
  const bubblePresentation = useMemo(
    () => resolveMessageBubblePresentation({ theme: chatTheme, isSelf: isMe, isGroup: isGroupConversation, messageType: message.type, position }),
    [chatTheme, isMe, isGroupConversation, message.type, position],
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pressPointRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const triggerHaptic = useCallback((duration = 12) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(duration);
    } catch { /* ignore */ }
  }, []);

  const runTapAnimation = useCallback(() => {
    const el = bubbleRef.current;
    if (!el || message.revoked) return;
    el.classList.remove('message-row--tap');
    void el.offsetWidth;
    el.classList.add('message-row--tap');
    triggerHaptic(8);
    window.setTimeout(() => {
      el.classList.remove('message-row--tap');
    }, 160);
  }, [message.revoked, triggerHaptic]);

  const openActionSheet = useCallback(() => {
    if (message.revoked) return;
    longPressTriggeredRef.current = true;
    triggerHaptic(18);
    onAction?.(message.id);
  }, [message.id, message.revoked, onAction, triggerHaptic]);

  useEffect(() => {
    if (!onMessageVisible || message.status === 'read' || message.sender === 'me') return;
    const el = bubbleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        /* Read detection guards (spec: only mark read when page is visible + window focused) */
        if (document.visibilityState !== 'visible') return;
        if (!document.hasFocus()) return;
        onMessageVisible(message.id);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [message.id, message.status, message.sender, onMessageVisible]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onAction?.(message.id);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (message.revoked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressPointRef.current = { x: e.clientX, y: e.clientY };
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      openActionSheet();
    }, 520);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressPointRef.current;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  };

  const handlePointerUp = () => {
    const wasLongPress = longPressTriggeredRef.current;
    clearLongPress();
    pressPointRef.current = null;
    if (!wasLongPress) {
      runTapAnimation();
    }
    window.setTimeout(() => {
      longPressTriggeredRef.current = false;
    }, 0);
  };

  const handlePointerCancel = () => {
    clearLongPress();
    pressPointRef.current = null;
    longPressTriggeredRef.current = false;
  };

  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  const handleClickCapture = (e: React.MouseEvent) => {
    if (!longPressTriggeredRef.current) return;
    e.preventDefault();
    e.stopPropagation();
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
          <div className="message-meta"><span>{formatTime(message.time)}</span></div>
        )}
      </div>
    );
  }

  const body = (() => {
    // Unified reply quote — rendered inside every bubble type
    const replyQuote = message.replyTo ? (
      <ReplyCard
        senderName={perspectivePresentation?.replySenderName || message.replyTo.senderName}
        textPreview={message.replyTo.textPreview}
        deleted={!allMessages.some((m) => m.id === message.replyTo!.id && !m.deletedAt && !m.deletedForSelfAt && !m.deletedForAllAt)}
        onScrollToMsg={() => onScrollToMsg?.(message.replyTo!.id)}
      />
    ) : null;

    switch (message.type) {
      case 'text': return <TextBubble message={message} replyQuote={replyQuote} onScrollToMsg={onScrollToMsg} contextTrace={contextTrace} presentation={bubblePresentation} />;
      case 'image': return <ImageBubble message={message} replyQuote={replyQuote} presentation={bubblePresentation} />;
      case 'file': return <FileBubble message={message} replyQuote={replyQuote} presentation={bubblePresentation} />;
      case 'sticker': return <StickerBubble message={message} replyQuote={replyQuote} presentation={bubblePresentation} />;
      case 'voice': return <ChatVoiceBubble message={message} replyQuote={replyQuote} />;
    }
  })();

  // Narrator messages — center-aligned, no bubble, distinct visual treatment
  if (isNarrator && !message.revoked) {
    return (
      <div
        ref={bubbleRef}
        id={`msg-${message.id}`}
        tabIndex={0}
        className={`message-row narrator pos-${position}`}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerCancel}
        onClickCapture={handleClickCapture}
      >
        <div className="message-narrator-body">
          {message.type === 'text' && <span className="message-narrator-text">{message.content}</span>}
          {message.type === 'image' && <ImageBubble message={message} replyQuote={null} presentation={bubblePresentation} />}
        </div>
        {showTime && (
          <div className="message-meta"><span>{formatTime(message.time)}</span></div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={bubbleRef}
      id={`msg-${message.id}`}
      tabIndex={0}
      className={`message-row ${isMe ? 'me' : 'friend'} pos-${position}`}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onClickCapture={handleClickCapture}
    >
      {body}
      {perspectivePresentation?.mentionLabel && <span className="message-perspective-mention">{perspectivePresentation.mentionLabel}</span>}
      {message.pinned && (
        <span className="msg-pin-badge" aria-label="已釘選">
          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3L9.5 9.5l-3.5 1 1 3L3 19l2 2 5.5-4 3 1 1-3.5L21 8V3z" />
            <line x1="9" y1="9.5" x2="12" y2="12.5" />
          </svg>
        </span>
      )}
      {showTime && (
        <div className="message-meta">
          <span>{formatTime(message.time)}</span>
          {readReceiptLabel !== null && (
            <span className={`message-meta__status${message.deliveryStatus === 'sending' ? ' is-sending' : ''}`}>
              {readReceiptLabel}
            </span>
          )}
        </div>
      )}
      {message.deliveryStatus === 'failed' && (
        <button type="button" className="message-retry-button" onClick={() => retryMessageDelivery(message.id)}>重試</button>
      )}
    </div>
  );
}
