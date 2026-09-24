import { beforeEach, describe, expect, it } from 'vitest';
import { getFocusMilestoneProgress, getNextFocusMilestone, splitFocusSegmentByLocalDate, useFocusCareerStore } from '@/store/useFocusCareerStore';
import { toLocalDateString } from '@/utils/date';

const emptyStats = () => ({ totalFocusSeconds: 0, todayFocusSeconds: 0, focusSessionCount: 0, longestFocusSeconds: 0, bestDayFocusSeconds: 0, longestFocusStreakDays: 0, completedFocusSessionCount: 0, dawnOrLateSessionCount: 0, mainQuestFocusSessionCount: 0, updatedAt: new Date(0).toISOString() });
const reset = (now = Date.now()) => useFocusCareerStore.setState({
  stats: emptyStats(),
  todayDateKey: toLocalDateString(new Date(now)),
  achievements: [],
  unlockQueue: [],
  focusIslandMode: 'focus-only',
  recoveryCheckpoint: null,
  settledSessionIds: [],
  pendingSettlement: null,
  migrationVersion: 1,
});

describe('Focus Career lifecycle', () => {
  beforeEach(() => { localStorage.clear(); reset(); });

  it('keeps TIDEBOUND as the only running source', () => {
    const state = useFocusCareerStore.getState() as unknown as Record<string, unknown>;
    expect(state).not.toHaveProperty('status');
    expect(state).not.toHaveProperty('running');
    expect(state).not.toHaveProperty('remainingSeconds');
    expect(state).toHaveProperty('recoveryCheckpoint');
  });

  it('excludes paused time using timestamp segments', () => {
    const career = useFocusCareerStore.getState();
    career.startTracking('session-1', 1_000);
    career.pauseTracking('session-1', 31_000);
    career.resumeTracking('session-1', 91_000);
    career.settleSession('session-1', 'completed', 121_000);
    const state = useFocusCareerStore.getState();
    expect(state.stats.totalFocusSeconds).toBe(60);
    expect(state.pendingSettlement?.sessionFocusSeconds).toBe(60);
  });

  it('settles a completed session exactly once', () => {
    const career = useFocusCareerStore.getState();
    career.startTracking('stable-id', 1_000);
    const first = career.settleSession('stable-id', 'completed', 61_000);
    const second = useFocusCareerStore.getState().settleSession('stable-id', 'completed', 121_000);
    expect(first?.sessionFocusSeconds).toBe(60);
    expect(second).toBeNull();
    expect(useFocusCareerStore.getState().stats).toMatchObject({ totalFocusSeconds: 60, focusSessionCount: 1 });
  });

  it('bounds settled session idempotency records', () => {
    for (let index = 0; index < 140; index += 1) {
      const id = `session-${index}`;
      useFocusCareerStore.getState().startTracking(id, index * 2_000);
      useFocusCareerStore.getState().settleSession(id, 'abandoned', index * 2_000 + 1_000);
    }
    const ids = useFocusCareerStore.getState().settledSessionIds;
    expect(ids).toHaveLength(120);
    expect(ids.at(-1)).toBe('session-139');
  });

  it('uses checkpoint only for recovery, not formal session settlement', () => {
    const career = useFocusCareerStore.getState();
    career.startTracking('checkpoint-only', 1_000);
    career.checkpoint('checkpoint-only', 21_000, true);
    const state = useFocusCareerStore.getState();
    expect(state.stats.totalFocusSeconds).toBe(20);
    expect(state.stats.focusSessionCount).toBe(0);
    expect(state.pendingSettlement).toBeNull();
    expect(state.settledSessionIds).not.toContain('checkpoint-only');
  });

  it('splits 23:55–00:10 into 300 and 600 local seconds', () => {
    const start = new Date(2026, 0, 1, 23, 55, 0).getTime();
    const end = new Date(2026, 0, 2, 0, 10, 0).getTime();
    const split = splitFocusSegmentByLocalDate(start, end);
    expect(split[toLocalDateString(new Date(start))]).toBe(300);
    expect(split[toLocalDateString(new Date(end))]).toBe(600);
    reset(start);
    useFocusCareerStore.getState().startTracking('midnight', start);
    useFocusCareerStore.getState().settleSession('midnight', 'completed', end);
    expect(useFocusCareerStore.getState().stats).toMatchObject({ totalFocusSeconds: 900, todayFocusSeconds: 600 });
  });

  it('resets todayDateKey on hydrate-style rollover while preserving lifetime total', () => {
    const yesterday = new Date(2026, 0, 1, 23, 0).getTime();
    const today = new Date(2026, 0, 2, 9, 0).getTime();
    reset(yesterday);
    useFocusCareerStore.setState({ stats: { ...emptyStats(), totalFocusSeconds: 500, todayFocusSeconds: 500 } });
    useFocusCareerStore.getState().rolloverToday(today);
    expect(useFocusCareerStore.getState().stats).toMatchObject({ totalFocusSeconds: 500, todayFocusSeconds: 0 });
    expect(useFocusCareerStore.getState().todayDateKey).toBe(toLocalDateString(new Date(today)));
  });

  it('reconciles reload recovery without re-adding checkpointed time', () => {
    const career = useFocusCareerStore.getState();
    career.startTracking('reload-id', 1_000);
    career.checkpoint('reload-id', 21_000, true);
    const recovered = structuredClone(useFocusCareerStore.getState().recoveryCheckpoint);
    const stats = structuredClone(useFocusCareerStore.getState().stats);
    reset(21_000);
    useFocusCareerStore.setState({ recoveryCheckpoint: recovered, stats });
    useFocusCareerStore.getState().checkpoint('reload-id', 21_000, true);
    useFocusCareerStore.getState().settleSession('reload-id', 'completed', 31_000);
    expect(useFocusCareerStore.getState().stats.totalFocusSeconds).toBe(30);
  });

  it('deduplicates and sorts the existing unlockQueue by unlockedAt', () => {
    useFocusCareerStore.setState({
      achievements: [
        { id: 'focus-005', unlockedAt: '2026-01-02T00:00:00.000Z' },
        { id: 'focus-001', unlockedAt: '2026-01-01T00:00:00.000Z' },
      ],
      unlockQueue: ['focus-005', 'focus-001', 'focus-005'],
    });
    useFocusCareerStore.getState().startTracking('queue-session', 1_000);
    useFocusCareerStore.getState().settleSession('queue-session', 'completed', 61_000);
    expect(useFocusCareerStore.getState().unlockQueue).toEqual(['focus-001', 'focus-005']);
    expect(useFocusCareerStore.getState().pendingSettlement?.achievementIds).toEqual(['focus-001', 'focus-005']);
  });

  it('marks queued achievements viewed only when settlement is dismissed', () => {
    useFocusCareerStore.setState({ stats: { ...emptyStats(), totalFocusSeconds: 3_599 } });
    useFocusCareerStore.getState().startTracking('unlock-session', 1_000);
    useFocusCareerStore.getState().settleSession('unlock-session', 'completed', 61_000);
    expect(useFocusCareerStore.getState().achievements[0]?.viewedAt).toBeUndefined();
    useFocusCareerStore.getState().dismissSettlement('unlock-session', 63_000);
    expect(useFocusCareerStore.getState().unlockQueue).toEqual([]);
    expect(useFocusCareerStore.getState().achievements[0]?.viewedAt).toBeTruthy();
  });

  it('creates pending settlement only for formal completion', () => {
    useFocusCareerStore.getState().startTracking('paused', 1_000);
    useFocusCareerStore.getState().pauseTracking('paused', 31_000);
    expect(useFocusCareerStore.getState().pendingSettlement).toBeNull();
    useFocusCareerStore.getState().settleSession('paused', 'early_exit', 32_000);
    expect(useFocusCareerStore.getState().pendingSettlement).toBeNull();
    expect(useFocusCareerStore.getState().stats).toMatchObject({ totalFocusSeconds: 30, focusSessionCount: 1 });
    useFocusCareerStore.getState().startTracking('complete', 40_000);
    useFocusCareerStore.getState().settleSession('complete', 'completed', 100_000);
    expect(useFocusCareerStore.getState().pendingSettlement?.sessionId).toBe('complete');
  });

  it('compares milestones using integer seconds and clamps progress', () => {
    expect(getNextFocusMilestone(3_599)?.id).toBe('focus-001');
    expect(getNextFocusMilestone(3_600)?.id).toBe('focus-005');
    expect(getNextFocusMilestone(36_000)?.id).toBe('focus-020');
    expect(getFocusMilestoneProgress(-5, 3_600)).toBe(0);
    expect(getFocusMilestoneProgress(3_601, 3_600)).toBe(100);
  });
});
