import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useAppStore, selectPartnerDisplayName } from '@/store/useAppStore';
import { t, getLanguage } from '@/i18n';
import { type PipelineTraceStep } from '@/components/chat/LunaThinkingTrace';
import { LunartideThinkingOrb } from '@/features/agentActivity/LunartideThinkingOrb';
import { useAgentActivityStore } from '@/features/agentActivity/agentActivityState';
import { ThinkingGlyph } from '@/components/ui/ThinkingGlyph';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ParticipantAvatar } from '@/components/chat/GroupChatPanels';
import { MessageAvatar } from '@/components/chat/MessageAvatar';
import { NarratorAvatar } from '@/components/chat/ConversationAvatars';
import type { ChatIdentity, ChatParticipant, Conversation, Message } from '@/types';
import type { EffectiveGroupParticipant } from '@/features/groupChat/participants';
import { resolveMessageSenderIdentity } from '@/features/groupChat/senderIdentity';
import { resolveMessagePerspectivePresentation, resolvePerspectiveMentionPresentation, resolvePerspectiveReplyLabel } from '@/features/groupChat/perspective';
import type { ContextTracePayload } from '@/ai/contextPreview';
import { RunePostReplyStateCard } from '@/components/chat/RunePostReplyStateCard';
import type { RunePostReplySnapshot } from '@/features/chat/runePostReplyState';

const GROUP_GAP_MS = 5 * 60 * 1000;

interface MsgChunk {
  sender: string;
  messages: { msg: Message; position: 'first' | 'middle' | 'last' | 'only' }[];
  time: string;
}

interface DateGroup {
  date: string;
  chunks: MsgChunk[];
}

function formatDateLabel(iso: string): string {
  const lang = getLanguage();
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (date.getTime() === today.getTime()) return t('chat.today');
  if (date.getTime() === yesterday.getTime()) return t('chat.yesterday');

  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  return d.toLocaleDateString(locale, {
    month: 'long', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function groupMessages(messages: Message[]): DateGroup[] {
  const dateMap = new Map<string, Message[]>();
  for (const msg of messages) {
    const dk = msg.time.slice(0, 10);
    const arr = dateMap.get(dk);
    if (arr) arr.push(msg); else dateMap.set(dk, [msg]);
  }
  const result: DateGroup[] = [];
  for (const [date, msgs] of dateMap) {
    const chunks: MsgChunk[] = [];
    let current: Message[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (current.length === 0) { current.push(msg); continue; }
      const prev = current[current.length - 1];
      const gap = new Date(msg.time).getTime() - new Date(prev.time).getTime();
      if (msg.sender !== prev.sender || msg.senderParticipantId !== prev.senderParticipantId || gap > GROUP_GAP_MS) {
        chunks.push(buildChunk(current));
        current = [msg];
      } else { current.push(msg); }
    }
    if (current.length > 0) chunks.push(buildChunk(current));
    result.push({ date, chunks });
  }
  return result;
}

function buildChunk(msgs: Message[]): MsgChunk {
  return {
    sender: msgs[0].sender,
    time: msgs[0].time,
    messages: msgs.map((msg, i) => ({
      msg,
      position: msgs.length === 1 ? 'only' : i === 0 ? 'first' : i === msgs.length - 1 ? 'last' : 'middle',
    })),
  };
}

/** Time-based greeting for the empty state. */
function emptyGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return getLanguage() === 'en' ? 'Good morning' : '早安';
  if (hour >= 12 && hour < 18) return getLanguage() === 'en' ? 'Good afternoon' : '午安';
  return getLanguage() === 'en' ? 'Good evening' : '晚安';
}

type AIState = 'idle' | 'thinking' | 'streaming' | 'error';

interface MessageListProps {
  messages: Message[];
  aiState?: AIState;
  streamingText?: string;
  thinkingStep?: number;
  isTyping?: boolean;
  pipelineTrace?: PipelineTraceStep[];
  onMessageAction?: (msgId: string) => void;
  onReply?: (msg: Message) => void;
  onScrollToMsg?: (msgId: string) => void;
  onMessageVisible?: (msgId: string) => void;
  contextTraces?: Record<string, ContextTracePayload>;
  emptyTitle?: string;
  emptyHint?: string;
  emptyActions?: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  participants?: ChatParticipant[];
  isGroup?: boolean;
  /** Canonical group source for sender identity resolution (message-scoped). */
  groupConversation?: Conversation;
  groupIdentities?: readonly ChatIdentity[];
  typingParticipantIds?: string[];
  perspectiveParticipant?: EffectiveGroupParticipant;
  postReplySnapshot?: RunePostReplySnapshot | null;
  onDismissPostReplySnapshot?: () => void;
}

export function MessageList({ messages, aiState, streamingText, thinkingStep = 0, isTyping = false, pipelineTrace, onMessageAction, onReply, onScrollToMsg, onMessageVisible, contextTraces, emptyTitle, emptyHint, emptyActions, scrollRef, participants = [], isGroup = false, groupConversation, groupIdentities = [], typingParticipantIds = [], perspectiveParticipant, postReplySnapshot, onDismissPostReplySnapshot }: MessageListProps) {
  const agentActivity = useAgentActivityStore((state) => state.activity);
  const bottomRef = useRef<HTMLDivElement>(null);
  const partner = useAppStore((s) => s.partner);
  const profile = useAppStore((s) => s.profile);
  const userName = useAppStore((s) => s.userName || '我');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(messages.length);
  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const isThinking = aiState === 'thinking';
  const isStreaming = aiState === 'streaming';

  const lunaInitial = partner?.avatarInitial || 'L';
  const lunaColor = partner?.avatarColor || 'char';

  // Track scroll position + whether user is near bottom (pre-scroll state)
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const handle = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const near = dist < 120;
      nearBottomRef.current = near;
      setShowScrollBtn(!near);
    };
    el.addEventListener('scroll', handle, { passive: true });
    handle();
    return () => el.removeEventListener('scroll', handle);
  }, [scrollRef]);

  // Smart auto-scroll: only when user was near bottom before the change.
  // New message → smooth; streaming growth → instant follow.
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || !bottomRef.current) return;
    if (!nearBottomRef.current) return;
    const isNewMessage = messages.length !== prevLenRef.current;
    prevLenRef.current = messages.length;
    if (isNewMessage) {
      bottomRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    } else if (streamingText) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, streamingText, isTyping]);

  const hasContent = messages.length > 0 || isThinking || isStreaming || isTyping;


  if (!hasContent) {
    const hour = new Date().getHours();
    return (
      <div className="message-list chat-empty-state" aria-label="Chat messages" ref={scrollRef}>
        <div className="chat-empty-greeting">
          <div className="chat-empty-avatar">
            <span className="luna-avatar-ring luna-avatar-ring--online">
              <AvatarImage
                avatarConfig={partner.avatarImage}
                fallbackInitial={lunaInitial}
                initial={lunaInitial}
                color={lunaColor}
                size={72}
                label={selectPartnerDisplayName(partner)}
              />
            </span>
          </div>
          <div className="chat-empty-greeting-text">
            <p className="chat-empty-greeting-hi">{emptyGreeting(hour)}，{selectPartnerDisplayName(partner)}。</p>
            <p className="chat-empty-greeting-title">{emptyTitle || t('chat.emptyTitle')}</p>
            <p className="chat-empty-greeting-hint">{emptyHint || t('chat.emptyHint')}</p>
          </div>
        </div>
        {emptyActions}
        <div ref={bottomRef} />
      </div>
    );
  }

  const groups = groupMessages(messages);
  const userInitial = (profile.avatarInitial || userName || 'S').charAt(0).toUpperCase();
  const userColor = profile.avatarColor || 'user';

  return (
    <div className="message-list" ref={scrollRef}>
      {groups.map((dateGroup) => (
        <div key={dateGroup.date}>
          <div className="message-date-sep">
            <span>{formatDateLabel(dateGroup.date)}</span>
          </div>
          {dateGroup.chunks.map((chunk, ci) => {
            const firstMessage = chunk.messages[0].msg;
            const isNarratorChunk = firstMessage.senderParticipantId === 'narrator';
            const perspectivePresentation = isGroup
              ? resolveMessagePerspectivePresentation(firstMessage, perspectiveParticipant?.identityId)
              : undefined;
            const isMe = perspectivePresentation ? perspectivePresentation.isPerspectiveSelf : chunk.sender === 'me';
            const participant = participants.find((item) => item.id === chunk.messages[0]?.msg.senderParticipantId);
            // Group senders resolve from their own canonical senderId — never from a
            // conversation-wide "current identity" name.
            const senderIdentity = isGroup
              ? resolveMessageSenderIdentity(firstMessage, groupConversation, groupIdentities)
              : undefined;
            const senderLabel = senderIdentity
              ? senderIdentity.displayName
              : participant?.groupNickname || participant?.name || (isMe ? userName : selectPartnerDisplayName(partner));
            const senderHandle = senderIdentity?.needsDisambiguation ? senderIdentity.handle : undefined;

            if (isNarratorChunk) {
              return (
                <div key={`${chunk.time}-${ci}`} className="message-chunk narrator">
                  <div className="chunk-narrator-header">
                    <NarratorAvatar size={20} />
                    <span className="chunk-narrator-label">旁白</span>
                  </div>
                  <div className="chunk-body">
                    {chunk.messages.map(({ msg, position }) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        position={position}
                        showTime={position === 'last' || position === 'only'}
                        showAvatar={false}
                        allMessages={messages}
                        onReply={onReply}
                        onScrollToMsg={onScrollToMsg}
                        onMessageVisible={onMessageVisible}
                        onAction={onMessageAction}
                        contextTrace={contextTraces?.[msg.id]}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div key={`${chunk.time}-${ci}`} className={`message-chunk ${isMe ? 'me' : 'friend'}`}>
                <div className="chunk-avatar-slot">
                  {(chunk.messages[0].position === 'first' || chunk.messages[0].position === 'only') && (
                    isGroup
                      ? <MessageAvatar message={chunk.messages[0].msg} participant={participant} size={30} label={isGroup ? senderLabel : undefined} />
                      : participant
                      ? <ParticipantAvatar participant={participant} size={30} />
                      : isMe
                      ? <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={userInitial} initial={userInitial} color={userColor} size={30} label={userName} />
                      : <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={selectPartnerDisplayName(partner)} />
                  )}
                </div>
                <div className="chunk-body">
                  {/* Sender label — Luna only (user label hidden for cleaner chat feel) */}
                  {(isGroup || !isMe) && (chunk.messages[0].position === 'first' || chunk.messages[0].position === 'only') && (
                    <div className="chunk-sender-label">
                      {senderLabel}
                      {senderHandle && <span className="chunk-sender-handle">@{senderHandle}</span>}
                    </div>
                  )}
                  {chunk.messages.map(({ msg, position }) => (
                    <div key={msg.id} className="message-with-post-reply-state">
                    <MessageBubble
                      message={msg}
                      position={position}
                      showTime={position === 'last' || position === 'only'}
                      showAvatar={false}
                      allMessages={messages}
                      onReply={onReply}
                      onScrollToMsg={onScrollToMsg}
                      onMessageVisible={onMessageVisible}
                      onAction={onMessageAction}
                      contextTrace={contextTraces?.[msg.id]}
                      perspectivePresentation={isGroup ? {
                        isPerspectiveSelf: resolveMessagePerspectivePresentation(msg, perspectiveParticipant?.identityId).isPerspectiveSelf,
                        mentionLabel: msg.type === 'text' ? resolvePerspectiveMentionPresentation(msg.content, perspectiveParticipant).label : undefined,
                        replySenderName: msg.replyTo ? resolvePerspectiveReplyLabel(messages.find((item) => item.id === msg.replyTo?.id), perspectiveParticipant?.identityId, msg.replyTo.senderName) : undefined,
                      } : undefined}
                    />
                    {postReplySnapshot?.messageId === msg.id && onDismissPostReplySnapshot && (
                      <RunePostReplyStateCard snapshot={postReplySnapshot} onDismiss={onDismissPostReplySnapshot} />
                    )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Luna pipeline trace — replaces old thinking-panel */}
      {isThinking && (
        <div className="message-chunk friend">
          <div className="chunk-avatar-slot">
            <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={selectPartnerDisplayName(partner)} />
          </div>
          <div className="chunk-body">
            <div className="chunk-sender-label">{selectPartnerDisplayName(partner)}</div>
            <div className="message-row friend">
              <div className="agent-activity-row" data-testid="chat-agent-activity-row">
                <LunartideThinkingOrb activity={agentActivity === 'idle' ? 'working' : agentActivity} size="avatar" />
              </div>
            </div>
          </div>
        </div>
      )}

      {typingParticipantIds.map((participantId) => {
        const participant = participants.find((item) => item.id === participantId);
        if (!participant) return null;
        return <div key={participantId} className="message-chunk friend mc-typing-chunk">
          <div className="chunk-avatar-slot"><ParticipantAvatar participant={participant} size={30} /></div>
          <div className="chunk-body"><div className="chunk-sender-label">{participant.groupNickname || participant.name}</div><div className="message-bubble thinking-bubble"><ThinkingGlyph variant="dots" size={14} label={`${participant.name}正在輸入`} /></div></div>
        </div>;
      })}

      {/* Luna streaming indicator */}
      {isStreaming && streamingText && (
        <div className="message-chunk friend">
          <div className="chunk-avatar-slot">
            <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={selectPartnerDisplayName(partner)} />
          </div>
          <div className="chunk-body">
            <div className="chunk-sender-label">{selectPartnerDisplayName(partner)}</div>
            <div className="message-row friend">
              <div className="message-bubble streaming-bubble">
                {streamingText}
                <span className="stream-cursor" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Luna typing indicator (continuous message queuing) */}
      {isTyping && (
        <div className="message-chunk friend">
          <div className="chunk-avatar-slot">
            <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={selectPartnerDisplayName(partner)} />
          </div>
          <div className="chunk-body">
            <div className="chunk-sender-label">{selectPartnerDisplayName(partner)}</div>
            <div className="message-row friend">
              <div className="message-bubble typing-bubble ai-thinking-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)' }}>{t('chat.lunaTyping')}</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
      {showScrollBtn && (
        <button
          type="button"
          className="scroll-bottom-btn"
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="跳到最新消息"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
