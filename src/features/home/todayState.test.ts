import { describe, expect, it } from 'vitest';
import { normalizeQuest } from '@/store/useQuestStore';
import type { CheckInRecord } from '@/features/tideclock/types';
import type { VocabularyEntry, VocabularyPracticeRecord } from '@/features/moonlex/types';
import { deriveTodayState, type TodayStateInput } from './todayState';

const NOW = new Date(2026, 7, 13, 12, 0, 0);
const DATE_KEY = '2026-08-13';

function vocabulary(id: string): VocabularyEntry {
  return { id, language: 'en', term: id, meanings: [id], tags: [], difficulty: 3, mastery: 'new', favorite: false, createdAt: 1, updatedAt: 1 };
}

function practice(vocabularyId: string, at = new Date(2026, 7, 13, 9, 0).getTime()): VocabularyPracticeRecord {
  return { id: `practice-${vocabularyId}`, vocabularyId, reviewedAt: at, result: 'good', mode: 'flip' };
}

function checkin(): CheckInRecord {
  const stamp = '2026-08-13T08:00:00.000Z';
  return { id: 'checkin', date: DATE_KEY, kind: 'clock_in', status: 'completed', clockInAt: stamp, clockOutAt: null, isLate: false, graceMinutesUsed: 0, report: null, makeupReason: null, moonDewAwarded: 0, ticketNumber: 'TEST', createdAt: stamp, updatedAt: stamp };
}

function input(overrides: Partial<TodayStateInput> = {}): TodayStateInput {
  return {
    now: NOW,
    checkinRecords: [],
    hydrationEntries: [],
    hydrationGoalMl: 2000,
    quests: [],
    mainQuestByDate: {},
    moonlexPracticePool: [1, 2, 3, 4, 5].map((value) => vocabulary(`word-${value}`)),
    moonlexPracticeRecords: [],
    focusedSecondsByDate: {},
    focusActive: false,
    ...overrides,
  };
}

describe('deriveTodayState', () => {
  it('A: derives the empty-day baseline without persisting a snapshot', () => {
    const state = deriveTodayState(input());
    expect(state).toMatchObject({
      dateKey: DATE_KEY,
      checkin: { status: 'pending' },
      hydration: { currentMl: 0, goalMl: 2000, progress: 0, completed: false },
      mainQuest: { status: 'none' },
      moonlex: { completedCount: 0, targetCount: 5, completed: false },
      tidebound: { focusedMinutes: 0, active: false },
    });
  });

  it('B: combines completed, active, practiced, and focused canonical facts', () => {
    const quest = normalizeQuest({ id: 'main', title: '完成 Phase 2A', status: 'in_progress' }, 'main');
    const state = deriveTodayState(input({
      checkinRecords: [checkin()],
      hydrationEntries: [{ id: 'water', dateKey: DATE_KEY, amountMl: 1500, recordedAt: NOW.getTime(), source: 'quick_add' }],
      quests: [quest],
      mainQuestByDate: { [DATE_KEY]: quest.id },
      moonlexPracticeRecords: [practice('word-1'), practice('word-2'), practice('word-3')],
      focusedSecondsByDate: { [DATE_KEY]: 1500 },
      focusActive: true,
    }));
    expect(state.checkin.status).toBe('completed');
    expect(state.hydration).toMatchObject({ currentMl: 1500, progress: 75 });
    expect(state.mainQuest).toMatchObject({ status: 'active', title: '完成 Phase 2A' });
    expect(state.moonlex).toMatchObject({ completedCount: 3, targetCount: 5 });
    expect(state.tidebound).toEqual({ available: true, focusedMinutes: 25, active: true });
  });

  it('C: preserves explicit optional-module availability semantics', () => {
    const state = deriveTodayState(input({ availability: { moonlex: false, period: false }, periodLabel: '濾泡期 · 第 7 天' }));
    expect(state.moonlex.available).toBe(false);
    expect(state.period.available).toBe(false);
  });

  it('D: derives hydration against the canonical custom goal', () => {
    const state = deriveTodayState(input({
      hydrationGoalMl: 2500,
      hydrationEntries: [{ id: 'water', dateKey: DATE_KEY, amountMl: 1000, recordedAt: NOW.getTime(), source: 'custom' }],
    }));
    expect(state.hydration).toMatchObject({ currentMl: 1000, goalMl: 2500, progress: 40 });
  });

  it('E: switches every daily derivation at local midnight', () => {
    const yesterdayPractice = practice('word-1', new Date(2026, 7, 13, 23, 59).getTime());
    const shared = input({
      now: new Date(2026, 7, 13, 23, 59),
      hydrationEntries: [{ id: 'water', dateKey: DATE_KEY, amountMl: 500, recordedAt: NOW.getTime(), source: 'quick_add' }],
      moonlexPracticeRecords: [yesterdayPractice],
      focusedSecondsByDate: { [DATE_KEY]: 600 },
    });
    expect(deriveTodayState(shared)).toMatchObject({ dateKey: DATE_KEY, hydration: { currentMl: 500 }, moonlex: { completedCount: 1 }, tidebound: { focusedMinutes: 10 } });
    expect(deriveTodayState({ ...shared, now: new Date(2026, 7, 14, 0, 1) })).toMatchObject({ dateKey: '2026-08-14', hydration: { currentMl: 0 }, moonlex: { completedCount: 0 }, tidebound: { focusedMinutes: 0 } });
  });
});
