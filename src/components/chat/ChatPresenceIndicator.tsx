import type { ChatPresenceStatus } from '@/types';
import { t } from '@/i18n';
import { ChatPresenceIcon } from '@/components/chat/ChatPresenceIcon';

interface ChatPresenceIndicatorProps {
  status: ChatPresenceStatus;
  detail?: string;
  compact?: boolean;
  aiState?: 'idle' | 'thinking' | 'streaming' | 'error';
  phrase?: string;
  dotColor?: string;
}

function resolveLabel(status: ChatPresenceStatus, aiState?: 'idle' | 'thinking' | 'streaming' | 'error'): string {
  if (status === 'online' && aiState === 'streaming') return '回應中';
  if (status === 'online' && aiState === 'idle') return '準備就緒';
  if (status === 'syncing' && aiState === 'thinking') return '思考中';
  if (status === 'syncing') return '準備中';
  return t(`chat.presence.${status}`);
}

export function ChatPresenceIndicator({ status, detail: _detail, compact = false, aiState, phrase, dotColor }: ChatPresenceIndicatorProps) {
  const label = phrase || resolveLabel(status, aiState);
  const dotStyle = dotColor ? { background: dotColor, boxShadow: `0 0 6px ${dotColor}66` } : undefined;

  return (
    <div className={`chat-presence chat-presence--${status} ${compact ? 'chat-presence--compact' : ''}`} aria-label={label}>
      <span className="chat-presence-dot" style={dotStyle} aria-hidden="true" />
      <span className="chat-presence-icon"><ChatPresenceIcon status={status} /></span>
      <span className="chat-presence-label">{label}</span>
    </div>
  );
}
