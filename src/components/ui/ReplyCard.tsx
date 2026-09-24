import { t } from '@/i18n';

export interface ReplyCardProps {
  /** Display name of the quoted sender */
  senderName: string;
  /** Text preview of the quoted content */
  textPreview: string;
  /** Called when user clicks the card to scroll to the original message */
  onScrollToMsg?: () => void;
  /** When true, original was deleted — shows fallback text */
  deleted?: boolean;
}

/**
 * Unified reply quote card — Telegram-style.
 *
 * Used across chat bubbles, forum posts, and memory entries to display
 * a quoted message reference with click-to-scroll behaviour.
 */
export function ReplyCard({ senderName, textPreview, onScrollToMsg, deleted }: ReplyCardProps) {
  if (deleted) {
    return (
      <div className="reply-quote reply-quote--deleted">
        <span className="reply-quote-bar" />
        <div className="reply-quote-body">
          <span className="reply-quote-text reply-quote-text--deleted">
            原訊息已刪除
          </span>
        </div>
      </div>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onScrollToMsg?.();
  };

  return (
    <div
      className="reply-quote"
      onClick={handleClick}
      title={t('chat.scrollToMsg')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onScrollToMsg?.(); } }}
    >
      <span className="reply-quote-bar" />
      <div className="reply-quote-body">
        <span className="reply-quote-name">{senderName}</span>
        <span className="reply-quote-text">{textPreview}</span>
      </div>
    </div>
  );
}
