import { toLocalDateString } from '@/utils/date';
import type { CheckInRecord } from '@/features/tideclock/types';
import type { HydrationEntry } from '@/store/useHydrationStore';
import type { Quest } from '@/store/useQuestStore';
import type { VocabularyEntry, VocabularyPracticeRecord } from '@/features/moonlex/types';

export interface TodayState {
  dateKey: string;
  checkin: { available: boolean; status: 'pending' | 'completed' | 'late' | 'missed' };
  hydration: { available: boolean; currentMl: number; goalMl: number; progress: number; completed: boolean };
  mainQuest: { available: boolean; status: 'none' | 'planned' | 'active' | 'completed'; title?: string };
  moonlex: { available: boolean; completedCount: number; targetCount: number; completed: boolean };
  tidebound: { available: boolean; focusedMinutes: number; active: boolean };
  period: { available: boolean; label?: string };
}

export interface TodayStateInput {
  now: Date;
  checkinRecords: CheckInRecord[];
  hydrationEntries: HydrationEntry[];
  hydrationGoalMl: number;
  quests: Quest[];
  mainQuestByDate: Record<string, string>;
  moonlexPracticePool: VocabularyEntry[];
  moonlexPracticeRecords: VocabularyPracticeRecord[];
  focusedSecondsByDate: Record<string, number>;
  focusActive: boolean;
  availability?: Partial<Record<keyof Omit<TodayState, 'dateKey'>, boolean>>;
  periodLabel?: string;
}

export function deriveTodayState(input: TodayStateInput): TodayState {
  const dateKey = toLocalDateString(input.now);
  const available = (key: keyof Omit<TodayState, 'dateKey'>, fallback = true) => input.availability?.[key] ?? fallback;
  const checkinRecord = input.checkinRecords.find((record) => record.date === dateKey);
  const checkinStatus: TodayState['checkin']['status'] = !checkinRecord
    ? 'pending'
    : checkinRecord.status === 'makeup_required' ? 'missed'
      : checkinRecord.isLate || checkinRecord.status === 'late' ? 'late' : 'completed';

  const currentMl = input.hydrationEntries
    .filter((entry) => entry.dateKey === dateKey)
    .reduce((sum, entry) => sum + entry.amountMl, 0);
  const goalMl = Math.max(1, Math.round(input.hydrationGoalMl));
  const progress = Math.min(100, Math.max(0, Math.round((currentMl / goalMl) * 100)));

  const mainQuest = input.quests.find((quest) => quest.id === input.mainQuestByDate[dateKey]);
  const mainStatus: TodayState['mainQuest']['status'] = !mainQuest ? 'none'
    : mainQuest.status === 'completed' ? 'completed'
      : mainQuest.status === 'in_progress' ? 'active' : 'planned';

  const dayStart = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const dayEnd = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + 1).getTime();
  const moonlexIds = new Set(input.moonlexPracticePool.slice(0, 5).map((entry) => entry.id));
  const practicedIds = new Set(input.moonlexPracticeRecords
    .filter((record) => record.reviewedAt >= dayStart && record.reviewedAt < dayEnd && moonlexIds.has(record.vocabularyId))
    .map((record) => record.vocabularyId));
  const targetCount = moonlexIds.size;
  const completedCount = practicedIds.size;
  const focusedMinutes = Math.max(0, Math.floor((input.focusedSecondsByDate[dateKey] || 0) / 60));

  return {
    dateKey,
    checkin: { available: available('checkin'), status: checkinStatus },
    hydration: { available: available('hydration'), currentMl, goalMl, progress, completed: currentMl >= goalMl },
    mainQuest: { available: available('mainQuest'), status: mainStatus, title: mainQuest?.title },
    moonlex: { available: available('moonlex', targetCount > 0) && targetCount > 0, completedCount, targetCount, completed: targetCount > 0 && completedCount >= targetCount },
    tidebound: { available: available('tidebound'), focusedMinutes, active: input.focusActive },
    period: { available: available('period', Boolean(input.periodLabel)) && Boolean(input.periodLabel), label: input.periodLabel },
  };
}
