import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { useQuestStore } from '@/store/useQuestStore';

describe('Calendar Todo completion seam', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuestStore.setState({ quests: [], questMigrationVersion: 0, mainQuestByDate: {} });
    useAppStore.setState({ moonDewLedger: [] });
  });

  it('toggles completion through the canonical owner, including older completed quests', () => {
    const id = useQuestStore.getState().createQuest({ title: 'Calendar toggle', rewardTier: 'normal' });
    expect(useQuestStore.getState().toggleQuestCompletion(id)).toBe(true);
    expect(useQuestStore.getState().quests[0].status).toBe('completed');

    useQuestStore.setState((state) => ({
      quests: state.quests.map((quest) => quest.id === id ? { ...quest, completedAt: '2025-01-01T00:00:00.000Z' } : quest),
    }));
    expect(useQuestStore.getState().toggleQuestCompletion(id)).toBe(true);
    expect(useQuestStore.getState().quests[0].status).toBe('available');
    expect(useQuestStore.getState().quests[0].completedAt).toBeUndefined();
    expect(useQuestStore.getState().toggleQuestCompletion('missing')).toBe(false);
  });
});
