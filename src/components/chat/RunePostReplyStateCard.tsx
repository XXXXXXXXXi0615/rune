import { useEffect, useState } from 'react';
import { companionMoodLabel, type RunePostReplySnapshot } from '@/features/chat/runePostReplyState';
import './RunePostReplyStateCard.css';

const VISIBLE_MS = 6_000;
const EXIT_MS = 220;

export function RunePostReplyStateCard({ snapshot, onDismiss }: { snapshot: RunePostReplySnapshot; onDismiss: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    setIsLeaving(false);
    const visibleTimer = window.setTimeout(() => setIsLeaving(true), VISIBLE_MS);
    const dismissTimer = window.setTimeout(onDismiss, VISIBLE_MS + EXIT_MS);
    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [snapshot.messageId, snapshot.shownAt, onDismiss]);

  const moodLabel = companionMoodLabel(snapshot.mood);
  return (
    <button type="button" className={`rune-post-reply-card${isLeaving ? ' is-leaving' : ''}`}
      aria-label={`收起 Rune 的狀態：${moodLabel}`} data-testid="rune-post-reply-state-card"
      data-message-id={snapshot.messageId} onClick={onDismiss}>
      <span className="rune-post-reply-mark" aria-hidden="true">R</span>
      <span className="rune-post-reply-copy">
        <span className="rune-post-reply-title">Rune · {moodLabel}</span>
        {snapshot.statusText && <span className="rune-post-reply-status">「{snapshot.statusText}」</span>}
      </span>
      <span className="rune-post-reply-aside" aria-hidden="true">小聲話</span>
    </button>
  );
}
