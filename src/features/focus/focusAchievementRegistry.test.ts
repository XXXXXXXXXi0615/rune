import { describe, expect, it } from 'vitest';
import { FOCUS_ACHIEVEMENT_REGISTRY, getFocusAchievementSummary, type FocusAchievementContext } from './focusAchievementRegistry';
import { useFocusCareerStore } from '@/store/useFocusCareerStore';

const context = (overrides: Partial<FocusAchievementContext> = {}): FocusAchievementContext => ({ totalFocusSeconds: 0, focusSessionCount: 0, longestFocusSeconds: 0, bestDayFocusSeconds: 0, longestFocusStreakDays: 0, dawnOrLateSessionCount: 0, mainQuestFocusSessionCount: 0, ...overrides });

describe('Focus Achievement Registry', () => {
  it('has ten unique stable IDs and preserves Phase 1 IDs', () => {
    const ids = FOCUS_ACHIEVEMENT_REGISTRY.map((item) => item.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    expect(ids).toEqual(expect.arrayContaining(['focus-001', 'focus-005', 'focus-010']));
  });

  it('evaluates all ten definitions with normalized progress', () => {
    const completed = context({ totalFocusSeconds: 100_000, focusSessionCount: 100, longestFocusSeconds: 10_000, bestDayFocusSeconds: 10_000, longestFocusStreakDays: 30, dawnOrLateSessionCount: 2, mainQuestFocusSessionCount: 2 });
    for (const definition of FOCUS_ACHIEVEMENT_REGISTRY) {
      const result = definition.evaluate(context());
      expect(result.current).toBeGreaterThanOrEqual(0);
      expect(result.target).toBeGreaterThan(0);
      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(1);
      expect(definition.evaluate(completed)).toMatchObject({ unlocked: true, progress: 1 });
    }
  });

  it('uses exact second thresholds and clamps progress', () => {
    const first = FOCUS_ACHIEVEMENT_REGISTRY[0];
    expect(first.evaluate(context({ totalFocusSeconds: 3599 })).unlocked).toBe(false);
    expect(first.evaluate(context({ totalFocusSeconds: 3600 })).unlocked).toBe(true);
    expect(first.evaluate(context({ totalFocusSeconds: 999999 })).progress).toBe(1);
    expect(first.evaluate(context({ totalFocusSeconds: -50 })).progress).toBe(0);
  });

  it('provides safe copy for hidden locked achievements', () => {
    const hidden = { ...FOCUS_ACHIEVEMENT_REGISTRY[0], hidden: true };
    expect(getFocusAchievementSummary(hidden, hidden.evaluate(context()))).toEqual({ title: '隱藏潮痕', description: '完成條件後才會揭曉。', conditionLabel: '條件尚未揭曉' });
  });

  it('backfills once, preserves viewedAt, and never duplicates queue entries', () => {
    useFocusCareerStore.setState({
      stats: { totalFocusSeconds: 0, todayFocusSeconds: 0, focusSessionCount: 0, longestFocusSeconds: 0, bestDayFocusSeconds: 0, longestFocusStreakDays: 0, completedFocusSessionCount: 0, dawnOrLateSessionCount: 0, mainQuestFocusSessionCount: 0, updatedAt: new Date(0).toISOString() },
      achievements: [{ id: 'focus-001', unlockedAt: '2026-01-01T00:00:00.000Z', viewedAt: '2026-01-02T00:00:00.000Z' }], unlockQueue: [], migrationVersion: 1, dailyFocusSeconds: {}, completedFocusDateKeys: [],
    });
    const session = { id: 'legacy', date: '2026-01-03', startTime: new Date('2026-01-03T05:00:00').getTime(), endTime: new Date('2026-01-03T15:00:00').getTime(), actualFocusMinutes: 600, plannedFocusMinutes: 600, plannedRounds: 1, roundsCompleted: 1, interruptions: 0, status: 'completed' as const, linkedQuestId: 'quest-1' };
    useFocusCareerStore.getState().migrateLegacySessions([session], new Date('2026-01-03T16:00:00').getTime());
    const once = useFocusCareerStore.getState();
    expect(once.achievements.find((item) => item.id === 'focus-001')?.viewedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(new Set(once.unlockQueue).size).toBe(once.unlockQueue.length);
    expect(once.achievements.filter((item) => item.source === 'migration').length).toBeGreaterThan(0);
    const count = once.achievements.length;
    useFocusCareerStore.getState().migrateLegacySessions([session]);
    expect(useFocusCareerStore.getState().achievements).toHaveLength(count);
  });
});
