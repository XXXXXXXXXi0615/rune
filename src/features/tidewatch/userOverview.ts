import { toLocalDateString } from '@/utils/date';
import type { Quest, QuestStatus } from '@/store/useQuestStore';

export interface TidewatchQuestProjection { questId: string; title: string; status: QuestStatus; estimatedMinutes?: number; rewardMoonDew: number; dueAt?: string; claimed: boolean; completed: boolean; failed: boolean }
const REWARD_BY_TIER = { light: 2, normal: 5, large: 10 } as const;

export function selectTidewatchQuest(quests: Quest[], mainQuestByDate: Record<string, string>, now = new Date()): TidewatchQuestProjection | null {
  const today = toLocalDateString(now);
  const main = quests.find((quest) => quest.id === mainQuestByDate[today] && quest.status !== 'archived');
  const dueToday = quests.filter((quest) => quest.dueAt && toLocalDateString(new Date(quest.dueAt)) === today && quest.status !== 'archived').sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))[0];
  const quest = main ?? dueToday ?? null;
  if (!quest) return null;
  const failed = quest.status === 'abandoned' || Boolean(quest.dueAt && Date.parse(quest.dueAt) < now.getTime() && quest.status !== 'completed');
  return { questId: quest.id, title: quest.title, status: quest.status, estimatedMinutes: quest.estimatedMinutes, rewardMoonDew: REWARD_BY_TIER[quest.rewardTier] + (main?.id === quest.id ? 3 : 0), dueAt: quest.dueAt, claimed: ['claimed', 'in_progress', 'completed'].includes(quest.status), completed: quest.status === 'completed', failed };
}
