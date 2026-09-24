import type { Quest } from '@/store/useQuestStore';
import { lifeLedgerRepository } from '@/features/lifeLedger/repository';
import type { AppEntityReference } from './appEntityReference';
export { LIFE_LEDGER_CHANGED_EVENT } from './appEntityReference';

export interface CalendarLinkedSummary {
  reference: AppEntityReference;
  title: string;
  subtitle: string;
  route: string;
}

export function selectQuestSummariesForDate(quests: readonly Quest[], date: string): CalendarLinkedSummary[] {
  return quests
    .filter((quest) => quest.status !== 'archived' && quest.dueAt?.slice(0, 10) === date)
    .map((quest) => ({
      reference: { sourceApp: 'quests', entityType: 'quest', entityId: quest.id, date },
      title: quest.title,
      subtitle: quest.status === 'completed' ? '任務 · 已完成' : '任務',
      route: `/quests?quest=${encodeURIComponent(quest.id)}`,
    }));
}

export async function loadLifeLedgerSummariesForDate(date: string): Promise<CalendarLinkedSummary[]> {
  const entries = await lifeLedgerRepository.getEntriesByDateRange(`${date}T00:00:00.000`, `${date}T23:59:59.999`);
  return entries.filter((entry) => !entry.deletedAt).map((entry) => ({
    reference: { sourceApp: 'life-ledger', entityType: entry.type, entityId: entry.id, date },
    title: entry.title,
    subtitle: '生活帳本',
    route: `/life-ledger?entry=${encodeURIComponent(entry.id)}`,
  }));
}
