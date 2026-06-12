import { BackButton } from '@/components/layout/BackButton';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { ChatPresenceIndicator } from '@/components/chat/ChatPresenceIndicator';
import { t } from '@/i18n';
import type { AvatarImageMeta, ChatPresenceStatus } from '@/types';

interface ChatHeaderProps {
  name: string;
  status: ChatPresenceStatus;
  statusDetail?: string;
  avatarConfig?: AvatarImageMeta;
  fallbackInitial: string;
  avatarColor: string;
  backTo?: string;
  onBackground?: () => void;
  onMore?: () => void;
}

export function ChatHeader({
  name,
  status,
  statusDetail,
  avatarConfig,
  fallbackInitial,
  avatarColor,
  backTo = '/chat',
  onBackground,
  onMore,
}: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <BackButton to={backTo} />
      <span className={`luna-avatar-ring luna-avatar-ring--${status}`}>
        <AvatarImage
          avatarConfig={avatarConfig}
          fallbackInitial={fallbackInitial}
          initial={fallbackInitial}
          color={avatarColor}
          size={36}
          className="chat-header-avatar"
          label={name}
        />
      </span>
      <div className="chat-header-info">
        <div className="chat-header-name">{name}</div>
        {statusDetail && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.3 }}>{statusDetail}</div>
        )}
        <ChatPresenceIndicator status={status} />
      </div>
      <div className="chat-header-actions">
        <button className="btn-icon" aria-label={t('chat.search')} disabled title={t('chat.search')}>
          <svg className="icon chat-header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <button className="btn-icon" onClick={onBackground} aria-label={t('chat.background')} title={t('chat.background')}>
          <svg className="icon chat-header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </button>
        <button className="btn-icon" onClick={onMore} aria-label={t('chat.more')}>
          <svg className="icon chat-header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
