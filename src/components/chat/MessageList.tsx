import { useEffect, useRef } from 'react';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { useAppStore } from '@/store/useAppStore';
import { t, getLanguage } from '@/i18n';
import { ThinkingSpinner } from '@/components/chat/ThinkingSpinner';
import type { Message } from '@/types';

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
      if (msg.sender !== prev.sender || gap > GROUP_GAP_MS) {
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

import { AvatarImage } from '@/components/ui/AvatarImage';

type AIState = 'idle' | 'thinking' | 'streaming' | 'error';

interface MessageListProps {
  messages: Message[];
  aiState?: AIState;
  streamingText?: string;
  thinkingStep?: number;
  onMessageAction?: (msgId: string) => void;
}

export function MessageList({ messages, aiState, streamingText, thinkingStep = 0, onMessageAction }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const partner = useAppStore((s) => s.partner);
  const profile = useAppStore((s) => s.profile);
  const userName = useAppStore((s) => s.userName || 'shuri');

  const isThinking = aiState === 'thinking';
  const isStreaming = aiState === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiState, streamingText]);

  const hasContent = messages.length > 0 || isThinking || isStreaming;

  if (!hasContent) {
    return (
      <div className="message-list" aria-label="Chat messages">
        <div ref={bottomRef} />
      </div>
    );
  }

  const groups = groupMessages(messages);
  const userInitial = (profile.avatarInitial || userName || 'S').charAt(0).toUpperCase();
  const userColor = profile.avatarColor || 'user';
  const lunaInitial = partner?.avatarInitial || 'L';
  const lunaColor = partner?.avatarColor || 'char';

  return (
    <div className="message-list">
      {groups.map((dateGroup) => (
        <div key={dateGroup.date}>
          <div className="message-date-sep">
            <span>{formatDateLabel(dateGroup.date)}</span>
          </div>
          {dateGroup.chunks.map((chunk, ci) => {
            const isMe = chunk.sender === 'me';
            return (
              <div key={`${chunk.time}-${ci}`} className={`message-chunk ${isMe ? 'me' : 'friend'}`}>
                <div className="chunk-avatar-slot">
                  {(chunk.messages[0].position === 'first' || chunk.messages[0].position === 'only') && (
                    isMe
                      ? <AvatarImage avatarConfig={profile.avatarImage} fallbackInitial={userInitial} initial={userInitial} color={userColor} size={30} label={userName} />
                      : <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={partner?.name || 'LUNARIS'} />
                  )}
                </div>
                <div className="chunk-body">
                  {/* Sender label — Luna only (user label hidden for cleaner chat feel) */}
                  {!isMe && (chunk.messages[0].position === 'first' || chunk.messages[0].position === 'only') && (
                    <div className="chunk-sender-label">
                      {partner?.name || 'LUNARIS'}
                    </div>
                  )}
                  {chunk.messages.map(({ msg, position }) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      position={position}
                      showTime={position === 'last' || position === 'only'}
                      showAvatar={false}
                      onAction={onMessageAction}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Luna thinking indicator */}
      {isThinking && (
        <div className="message-chunk friend">
          <div className="chunk-avatar-slot">
            <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={partner?.name || 'LUNARIS'} />
          </div>
          <div className="chunk-body">
            <div className="chunk-sender-label">{partner?.name || 'LUNARIS'}</div>
            <div className="message-row friend">
              <div className="thinking-panel" role="status" aria-live="polite">
                <div className="thinking-panel-main">
                  <ThinkingSpinner size={21} variant="dots" />
                  <span>{t('chat.lunaThinking')}</span>
                </div>
                <div className="thinking-panel-steps" aria-hidden="true">
                  <span className={thinkingStep >= 0 ? 'thinking-step-active' : ''}>{t('chat.thinkingStepRecent')}</span>
                  <span className={thinkingStep >= 1 ? 'thinking-step-active' : ''}>{t('chat.thinkingStepMemory')}</span>
                  <span className={thinkingStep >= 2 ? 'thinking-step-active' : ''}>{t('chat.thinkingStepReply')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Luna streaming indicator */}
      {isStreaming && streamingText && (
        <div className="message-chunk friend">
          <div className="chunk-avatar-slot">
            <AvatarImage avatarConfig={partner.avatarImage} fallbackInitial={lunaInitial} initial={lunaInitial} color={lunaColor} size={30} label={partner?.name || 'LUNARIS'} />
          </div>
          <div className="chunk-body">
            <div className="chunk-sender-label">{partner?.name || 'LUNARIS'}</div>
            <div className="message-row friend">
              <div className="message-bubble streaming-bubble">
                {streamingText}
                <span className="stream-cursor" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
