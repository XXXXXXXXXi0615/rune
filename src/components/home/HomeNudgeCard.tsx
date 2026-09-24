import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestStore } from '@/store/useQuestStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { useTidewatchNudgeStore } from '@/store/useTidewatchNudgeStore';
import { pickNudgeCandidate } from '@/features/tidewatch/nudgePolicy';
import './HomeNudgeCard.css';

/**
 * HomeNudgeCard — single conditional reminder surface on Home.
 *
 * Data relation: TIDEQUEST (useQuestStore) → TIDEWATCH reminder policy
 * (selection + snooze semantics) → HomeNudgeCard (render only, no quest copy).
 *
 * - Card shows at most ONE quest (most urgent non-terminal quest due today).
 * - No quests to nudge ⇒ component renders nothing (no permanent empty state).
 * - Completing/advancing the quest derives the next candidate automatically.
 */

const PRIORITY_LABEL: Record<string, string> = { high: '高優先', low: '低優先', medium: '一般' };

export function HomeNudgeCard() {
  const navigate = useNavigate();
  const quests = useQuestStore((state) => state.quests);
  const startQuest = useQuestStore((state) => state.startQuest);
  const startFocus = useFocusSessionStore((state) => state.startSession);
  const showFocusWindow = useFocusIslandStore((state) => state.showWindow);
  const openFocusWindow = useFocusWindowStore((state) => state.openWindow);
  const snoozedUntil = useTidewatchNudgeStore((state) => state.snoozedUntil);
  const snooze = useTidewatchNudgeStore((state) => state.snooze);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const candidate = useMemo(
    () => pickNudgeCandidate(quests, snoozedUntil, now),
    [quests, snoozedUntil, now],
  );

  if (!candidate) return null;

  const { quest, reason, urgency } = candidate;

  const handleStart = () => {
    startQuest(quest.id);
    startFocus({
      durationMinutes: quest.estimatedMinutes || 25,
      restMinutes: 5,
      rounds: 1,
      task: quest.title,
      category: 'focus',
      roomType: 'computer',
      linkedQuestId: quest.id,
    });
    showFocusWindow();
    openFocusWindow();
  };

  return (
    <section
      className={`home-nudge-card is-${urgency}`}
      data-testid="home-nudge-card"
      data-quest-id={quest.id}
      aria-label="TIDEWATCH 觀測站提醒"
    >
      <header className="home-nudge-card__head">
        <span className="home-nudge-card__brand">TIDEWATCH · 觀測</span>
        <span className={`home-nudge-card__priority is-${quest.priority}`}>{PRIORITY_LABEL[quest.priority] ?? '一般'}</span>
      </header>
      <h2 className="home-nudge-card__title">{quest.title || '未命名任務'}</h2>
      <p className="home-nudge-card__reason">{reason}</p>
      <footer className="home-nudge-card__actions">
        <button type="button" className="home-nudge-card__btn home-nudge-card__btn--primary" onClick={handleStart}>開始</button>
        <button type="button" className="home-nudge-card__btn" onClick={() => snooze(quest.id, 30)}>稍後</button>
        <button type="button" className="home-nudge-card__btn" onClick={() => navigate('/quests')}>查看</button>
      </footer>
    </section>
  );
}
