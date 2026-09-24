import { AvatarImage } from '@/components/ui/AvatarImage';
import { ChatPresenceIndicator } from '@/components/chat/ChatPresenceIndicator';
import { t } from '@/i18n';
import type { AvatarImageMeta, ChatPresenceStatus } from '@/types';

interface ChatHeaderProps {
  name: string;
  status: ChatPresenceStatus;
  statusDetail?: string;
  aiState?: 'idle' | 'thinking' | 'streaming' | 'error';
  modelTag?: string | null;
  avatarConfig?: AvatarImageMeta;
  fallbackInitial: string;
  avatarColor: string;
  onBack?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
  onMore?: () => void;
  memoryLabel?: string;
  onMemory?: () => void;
  headerPhrase?: string;
  dotColor?: string;
}

export function ChatHeader({
  name,
  status,
  statusDetail,
  aiState,
  modelTag,
  avatarConfig,
  fallbackInitial,
  avatarColor,
  onBack,
  onSidebarToggle,
  sidebarCollapsed,
  onMore,
  memoryLabel,
  onMemory,
  headerPhrase,
  dotColor,
}: ChatHeaderProps) {
  return (
    <div className="chat-header">
      {/* Left: back + Avatar + Name */}
      <div className="chat-header-left">
        {onBack && (
          <button className="btn-icon chat-header-back-btn" onClick={onBack} aria-label="返回首頁">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <span className={`luna-avatar-ring luna-avatar-ring--${status}`}>
          <AvatarImage
            avatarConfig={avatarConfig}
            fallbackInitial={fallbackInitial}
            initial={fallbackInitial}
            color={avatarColor}
            size={30}
            className="chat-header-avatar"
            label={name}
          />
        </span>
        <div className="chat-header-info">
          <div className="chat-header-name">
            {name}
            {memoryLabel && onMemory && (
              <button className="conv-memory-tag" onClick={onMemory} aria-label={`本對話記憶：${memoryLabel}`}>
                {memoryLabel}
              </button>
            )}
            {modelTag && (
              <span className="chat-header-model-tag">{modelTag}</span>
            )}
          </div>
          <ChatPresenceIndicator status={status} aiState={aiState} phrase={headerPhrase} dotColor={dotColor} compact />
        </div>
      </div>

      {/* Right: More menu */}
      <div className="chat-header-actions">
        {onMore && (
        <button className="btn-icon" onClick={onMore} aria-label={t('chat.more')}>
          <svg className="icon chat-header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
        )}
      </div>
    </div>
  );
}
