import { describe, expect, it } from 'vitest';
import { createChatActionCandidate } from './appEntityReference';
import { selectQuestSummariesForDate } from './calendarCrossAppAdapters';
import { normalizeQuest } from '@/store/useQuestStore';

describe('cross-app integration seam', () => {
  it('derives Calendar quest links without copying quest payload', () => {
    const quest = normalizeQuest({ id: 'q1', title: '整理桌面', dueAt: '2026-09-01T09:00:00.000Z' }, 'q1');
    const result = selectQuestSummariesForDate([quest], '2026-09-01');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reference: { sourceApp: 'quests', entityType: 'quest', entityId: 'q1', date: '2026-09-01' },
      route: '/quests?quest=q1',
    });
    expect(result[0].reference).not.toHaveProperty('payload');
  });

  it('requires confirmation for every Chat action candidate', () => {
    expect(createChatActionCandidate({ sourceMessageId: 'm1', target: 'calendar', label: '建立日程' }))
      .toMatchObject({ requiresConfirmation: true });
  });
});
