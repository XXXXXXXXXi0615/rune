import type { ChatPresenceStatus } from '@/types';
import { t } from '@/i18n';
import { ChatPresenceIcon } from '@/components/chat/ChatPresenceIcon';

interface ChatPresenceIndicatorProps {
  status: ChatPresenceStatus;
  detail?: string;
  compact?: boolean;
}

export function ChatPresenceIndicator({ status, detail: _detail, compact = false }: ChatPresenceIndicatorProps) {
  const label = t(`chat.presence.${status}`);

  return (
    <div className={`chat-presence chat-presence--${status} ${compact ? 'chat-presence--compact' : ''}`} aria-label={label}>
      <span className="chat-presence-dot" aria-hidden="true" />
      <span className="chat-presence-icon"><ChatPresenceIcon status={status} /></span>
      <span className="chat-presence-label">{label}</span>
    </div>
  );
}
