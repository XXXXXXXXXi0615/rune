import type { Quest } from '@/store/useQuestStore';

/**
 * TIDEWATCH nudge policy (Phase 0 ownership closure).
 *
 * Pure selection rules: TIDEQUEST quests + snooze window → at most one
 * "most worthy" candidate. Phase 1A replaces/extends this policy without
 * touching TIDEQUEST data.
 */

export interface NudgeCandidate {
  quest: Quest;
  /** 'overdue' | 'due-today' | 'due-soon' */
  urgency: 'overdue' | 'due-today' | 'due-soon';
  reason: string;
}

export function pickNudgeCandidate(
  quests: Quest[],
  snoozedUntil: Record<string, number>,
  now: Date = new Date(),
): NudgeCandidate | null {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);

  const candidates = quests
    .filter((quest) => {
      if (!quest.dueAt) return false;
      if (quest.status === 'completed' || quest.status === 'archived' || quest.status === 'abandoned') return false;
      const due = new Date(quest.dueAt);
      if (Number.isNaN(due.getTime())) return false;
      if (due.getTime() > dayEnd.getTime()) return false;
      const snoozeUntil = snoozedUntil[quest.id];
      if (typeof snoozeUntil === 'number' && snoozeUntil > now.getTime()) return false;
      return true;
    })
    .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));

  if (candidates.length === 0) return null;

  const quest = candidates[0];
  const due = new Date(quest.dueAt!);
  const nowMs = now.getTime();

  if (due.getTime() < nowMs) {
    const mins = Math.ceil((nowMs - due.getTime()) / 60000);
    const reason = mins < 60
      ? `已逾期 ${Math.max(1, mins)} 分鐘`
      : mins < 1440
        ? `已逾期 ${Math.ceil(mins / 60)} 小時`
        : `已逾期 ${Math.ceil(mins / 1440)} 天`;
    return { quest, urgency: 'overdue', reason };
  }

  const sameDay = due.toDateString() === now.toDateString();
  const timeLabel = due.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return { quest, urgency: 'due-today', reason: `今天 ${timeLabel} 截止` };
  }
  return { quest, urgency: 'due-soon', reason: `明天 ${timeLabel} 截止` };
}
