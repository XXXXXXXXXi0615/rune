import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { normalizeQuest, useQuestStore } from '@/store/useQuestStore';
import type { TodoItem } from '@/types';

function todo(id: string, completed = false): TodoItem {
  return { id, ticketNumber: 1, title: `Todo ${id}`, date: '2026-07-16', completed, priority: 'medium', category: 'work', repeat: 'none', createdAt: Date.now(), updatedAt: Date.now() };
}

describe('TIDEQUEST store', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuestStore.setState({ quests: [], questMigrationVersion: 0, mainQuestByDate: {} });
    useAppStore.setState({ moonDewLedger: [] });
  });

  it('normalizes unsafe persisted fields', () => {
    const quest = normalizeQuest({ title: '', focusedMinutes: Number.NaN, linkedFocusSessionIds: ['a', 'a'], priority: 'medium' });
    expect(quest.title).toBe('未命名任務');
    expect(quest.focusedMinutes).toBe(0);
    expect(quest.linkedFocusSessionIds).toEqual(['a']);
    expect(quest.subtasks).toEqual([]);
  });

  it('migrates legacy todos once and preserves completed state', () => {
    const source = [todo('one'), todo('two', true), todo('three'), todo('four', true), todo('five')];
    const first = useQuestStore.getState().migrateLegacyTodos(source);
    const second = useQuestStore.getState().migrateLegacyTodos(source);
    expect(first).toMatchObject({ sourceCount: 5, migratedCount: 5, failedCount: 0 });
    expect(second.migratedCount).toBe(0);
    expect(useQuestStore.getState().quests).toHaveLength(5);
    expect(useQuestStore.getState().quests.filter((quest) => quest.status === 'completed')).toHaveLength(2);
    expect(source).toHaveLength(5);
  });

  it('links each focus session only once', () => {
    const id = useQuestStore.getState().createQuest({ title: 'Focus quest' });
    expect(useQuestStore.getState().linkFocusSession(id, 'session-1', 25)).toBe(true);
    expect(useQuestStore.getState().linkFocusSession(id, 'session-1', 25)).toBe(false);
    expect(useQuestStore.getState().quests[0].focusedMinutes).toBe(25);
  });

  it('settles completion once and reverses without allowing reward farming', () => {
    const id = useQuestStore.getState().createQuest({ title: 'Reward quest', rewardTier: 'normal' });
    useQuestStore.getState().startQuest(id);
    expect(useQuestStore.getState().completeQuest(id)).toBe(true);
    expect(useAppStore.getState().moonDewLedger.filter((entry) => entry.idempotencyKey === `quest:${id}:completion`)).toHaveLength(1);
    expect(useQuestStore.getState().undoCompletion(id)).toBe(true);
    expect(useAppStore.getState().moonDewLedger.some((entry) => entry.source === 'reversal')).toBe(true);
    expect(useQuestStore.getState().completeQuest(id)).toBe(true);
    expect(useAppStore.getState().moonDewLedger.filter((entry) => entry.idempotencyKey === `quest:${id}:completion`)).toHaveLength(1);
  });

});
