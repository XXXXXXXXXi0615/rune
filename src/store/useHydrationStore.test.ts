import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useHydrationStore,
  getDailyEntries,
  getDailyTotal,
  getLatestEntryOfDay,
  migrateHydrationState,
  migrateLegacyAppWaterState,
  HYDRATION_DEFAULT_GOAL_ML,
  HYDRATION_MAX_ENTRY_ML,
  HYDRATION_MIN_GOAL_ML,
  HYDRATION_MAX_GOAL_ML,
  HYDRATION_DEFAULT_QUICK_AMOUNTS,
  type HydrationEntry,
} from '@/store/useHydrationStore';

function localToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeEntry(overrides: Partial<HydrationEntry> & { amountMl: number }): HydrationEntry {
  return {
    id: `t-${Math.random().toString(36).slice(2, 7)}`,
    dateKey: localToday(),
    recordedAt: Date.now(),
    source: 'quick_add',
    ...overrides,
  };
}

describe('HydrationStore — addEntry validation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      _data: {} as Record<string, string>,
      getItem(key: string) { return (this as any)._data[key] ?? null; },
      setItem(key: string, value: string) { (this as any)._data[key] = value; },
      removeItem(key: string) { delete (this as any)._data[key]; },
    });
    useHydrationStore.setState({ entries: [], settings: { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: [...HYDRATION_DEFAULT_QUICK_AMOUNTS] }, legacyAppWaterMigrationVersion: 0 });
  });

  it('adds a valid quick_add entry', () => {
    const ok = useHydrationStore.getState().addEntry(250, 'quick_add');
    expect(ok).toBe(true);
    const entries = useHydrationStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ amountMl: 250, dateKey: localToday(), source: 'quick_add' });
  });

  it('adds a valid custom entry with source custom', () => {
    useHydrationStore.getState().addEntry(750, 'custom');
    const entry = useHydrationStore.getState().entries[0];
    expect(entry.source).toBe('custom');
    expect(entry.amountMl).toBe(750);
  });

  it.each([0, -100, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid amount %s', (value) => {
    const ok = useHydrationStore.getState().addEntry(value, 'quick_add');
    expect(ok).toBe(false);
    expect(useHydrationStore.getState().entries).toHaveLength(0);
  });

  it('rejects empty string / non-numeric input (Number("") === 0 path)', () => {
    expect(useHydrationStore.getState().addEntry(Number(''), 'custom')).toBe(false);
    expect(useHydrationStore.getState().addEntry(Number('abc'), 'custom')).toBe(false);
    expect(useHydrationStore.getState().entries).toHaveLength(0);
  });

  it('rejects amounts above the single-entry cap', () => {
    const over = HYDRATION_MAX_ENTRY_ML + 1;
    expect(useHydrationStore.getState().addEntry(over, 'custom')).toBe(false);
    expect(useHydrationStore.getState().entries).toHaveLength(0);
  });

  it('accepts exactly the single-entry cap', () => {
    expect(useHydrationStore.getState().addEntry(HYDRATION_MAX_ENTRY_ML, 'custom')).toBe(true);
  });

  it('rounds fractional amounts', () => {
    useHydrationStore.getState().addEntry(250.6, 'quick_add');
    expect(useHydrationStore.getState().entries[0].amountMl).toBe(251);
  });
});

describe('HydrationStore — daily selectors & dateKey isolation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      _data: {} as Record<string, string>,
      getItem(key: string) { return (this as any)._data[key] ?? null; },
      setItem(key: string, value: string) { (this as any)._data[key] = value; },
      removeItem(key: string) { delete (this as any)._data[key]; },
    });
    useHydrationStore.setState({ entries: [], settings: { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: [...HYDRATION_DEFAULT_QUICK_AMOUNTS] }, legacyAppWaterMigrationVersion: 0 });
  });

  it('getDailyEntries filters by dateKey and sorts ascending by recordedAt', () => {
    const today = localToday();
    const yesterday = localToday(-1);
    const entries = [
      makeEntry({ dateKey: yesterday, amountMl: 800, recordedAt: 100 }),
      makeEntry({ dateKey: today, amountMl: 250, recordedAt: 300 }),
      makeEntry({ dateKey: today, amountMl: 500, recordedAt: 200 }),
    ];
    const todayEntries = getDailyEntries(entries, today);
    expect(todayEntries.map((e) => e.amountMl)).toEqual([500, 250]);
    expect(getDailyEntries(entries, yesterday)).toHaveLength(1);
    expect(getDailyEntries(entries, '2099-01-01')).toHaveLength(0);
  });

  it('getDailyTotal only sums entries of the given day (timezone/dateKey isolation)', () => {
    const today = localToday();
    const yesterday = localToday(-1);
    const entries = [
      makeEntry({ dateKey: yesterday, amountMl: 800 }),
      makeEntry({ dateKey: today, amountMl: 100 }),
      makeEntry({ dateKey: today, amountMl: 250 }),
    ];
    expect(getDailyTotal(entries, today)).toBe(350);
    expect(getDailyTotal(entries, yesterday)).toBe(800);
    expect(getDailyTotal(entries, '2099-01-01')).toBe(0);
  });

  it('getLatestEntryOfDay returns the last entry of the day or null', () => {
    const today = localToday();
    const entries = [
      makeEntry({ dateKey: today, amountMl: 100, recordedAt: 100 }),
      makeEntry({ dateKey: today, amountMl: 250, recordedAt: 200 }),
    ];
    expect(getLatestEntryOfDay(entries, today)?.amountMl).toBe(250);
    expect(getLatestEntryOfDay(entries, localToday(1))).toBeNull();
  });
});

describe('HydrationStore — remove / undo semantics', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      _data: {} as Record<string, string>,
      getItem(key: string) { return (this as any)._data[key] ?? null; },
      setItem(key: string, value: string) { (this as any)._data[key] = value; },
      removeItem(key: string) { delete (this as any)._data[key]; },
    });
    useHydrationStore.setState({ entries: [], settings: { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: [...HYDRATION_DEFAULT_QUICK_AMOUNTS] }, legacyAppWaterMigrationVersion: 0 });
  });

  it('removeEntry removes only the matching id', () => {
    useHydrationStore.getState().addEntry(100, 'quick_add');
    useHydrationStore.getState().addEntry(250, 'quick_add');
    const [first, second] = useHydrationStore.getState().entries;
    useHydrationStore.getState().removeEntry(first.id);
    const entries = useHydrationStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(second.id);
  });

  it('undoLastEntry removes only today’s latest entry (cross-day safe)', () => {
    const today = localToday();
    const yesterday = localToday(-1);
    useHydrationStore.setState({
      entries: [
        makeEntry({ id: 'y1', dateKey: yesterday, amountMl: 800, recordedAt: 100 }),
        makeEntry({ id: 't1', dateKey: today, amountMl: 100, recordedAt: 200 }),
        makeEntry({ id: 't2', dateKey: today, amountMl: 250, recordedAt: 300 }),
      ],
    });
    useHydrationStore.getState().undoLastEntry();
    const entries = useHydrationStore.getState().entries;
    expect(entries.map((e) => e.id)).toEqual(['y1', 't1']);
  });

  it('undoLastEntry is a no-op when today has no entries', () => {
    useHydrationStore.setState({ entries: [makeEntry({ dateKey: localToday(-1), amountMl: 800 })] });
    useHydrationStore.getState().undoLastEntry();
    expect(useHydrationStore.getState().entries).toHaveLength(1);
  });

  it('history survives undo when entries exist only on previous days', () => {
    const yesterday = localToday(-1);
    useHydrationStore.setState({ entries: [makeEntry({ id: 'y1', dateKey: yesterday, amountMl: 800 })] });
    useHydrationStore.getState().undoLastEntry();
    expect(useHydrationStore.getState().entries).toHaveLength(1);
    expect(useHydrationStore.getState().entries[0].id).toBe('y1');
  });
});

describe('HydrationStore — settings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      _data: {} as Record<string, string>,
      getItem(key: string) { return (this as any)._data[key] ?? null; },
      setItem(key: string, value: string) { (this as any)._data[key] = value; },
      removeItem(key: string) { delete (this as any)._data[key]; },
    });
    useHydrationStore.setState({ entries: [], settings: { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: [...HYDRATION_DEFAULT_QUICK_AMOUNTS] }, legacyAppWaterMigrationVersion: 0 });
  });

  it('setDailyGoal clamps to [MIN, MAX] and rounds', () => {
    useHydrationStore.getState().setDailyGoal(100);
    expect(useHydrationStore.getState().settings.dailyGoalMl).toBe(HYDRATION_MIN_GOAL_ML);
    useHydrationStore.getState().setDailyGoal(99999);
    expect(useHydrationStore.getState().settings.dailyGoalMl).toBe(HYDRATION_MAX_GOAL_ML);
    useHydrationStore.getState().setDailyGoal(2500.4);
    expect(useHydrationStore.getState().settings.dailyGoalMl).toBe(2500);
  });

  it('setDailyGoal ignores non-finite input', () => {
    useHydrationStore.getState().setDailyGoal(Number.NaN);
    expect(useHydrationStore.getState().settings.dailyGoalMl).toBe(HYDRATION_DEFAULT_GOAL_ML);
  });

  it('setQuickAmounts filters invalid and caps at 6', () => {
    useHydrationStore.getState().setQuickAmounts([100, 0, -50, 5000, Number.NaN, 250, 300, 400, 500, 600, 700]);
    expect(useHydrationStore.getState().settings.quickAmounts).toEqual([100, 250, 300, 400, 500, 600]);
  });

  it('resetSettings restores defaults', () => {
    useHydrationStore.getState().setDailyGoal(3000);
    useHydrationStore.getState().setQuickAmounts([50, 60]);
    useHydrationStore.getState().resetSettings();
    expect(useHydrationStore.getState().settings).toEqual({
      dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML,
      quickAmounts: HYDRATION_DEFAULT_QUICK_AMOUNTS,
    });
  });
});

describe('HydrationStore — v1 → v2 migration', () => {
  it('migrates the zustand envelope { state, version: 1 } without data loss', () => {
    const persisted = {
      state: {
        logs: [
          { id: 'l1', amountMl: 500, createdAt: 1234, date: '2026-07-01' },
          { id: 'l2', amountMl: 250, createdAt: 5678, date: '2026-07-02' },
          { id: 'l3', amountMl: 99999, createdAt: 9999, date: '2026-07-03' },
          { id: 'l4', amountMl: -10, createdAt: 1000, date: '2026-07-04' },
          { id: 'l5', amountMl: 100, createdAt: 1000, date: 'not-a-date' },
        ],
        dailyTargetMl: 3000,
      },
      version: 1,
    };
    const migrated = migrateHydrationState(persisted, 1);
    expect(migrated.entries).toHaveLength(3);
    expect(migrated.entries[0]).toMatchObject({ id: 'l1', dateKey: '2026-07-01', amountMl: 500, source: 'migration' });
    expect(migrated.entries[1]).toMatchObject({ id: 'l2', dateKey: '2026-07-02', amountMl: 250 });
    expect(migrated.entries[2]).toMatchObject({ id: 'l3', amountMl: HYDRATION_MAX_ENTRY_ML });
    expect(migrated.settings.dailyGoalMl).toBe(3000);
    expect(migrated.settings.quickAmounts).toEqual(HYDRATION_DEFAULT_QUICK_AMOUNTS);
  });

  it('migrates flat legacy payloads as fallback', () => {
    const persisted = { logs: [{ amountMl: 300, date: '2026-07-01' }], dailyTargetMl: 1500, version: 1 };
    const migrated = migrateHydrationState(persisted, 1);
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0].amountMl).toBe(300);
    expect(migrated.settings.dailyGoalMl).toBe(1500);
  });

  it('clamps migrated goal below the minimum to the default', () => {
    const migrated = migrateHydrationState({ state: { logs: [], dailyTargetMl: 50 }, version: 1 }, 1);
    expect(migrated.settings.dailyGoalMl).toBe(HYDRATION_DEFAULT_GOAL_ML);
  });

  it('clamps migrated goal above the maximum', () => {
    const migrated = migrateHydrationState({ state: { logs: [], dailyTargetMl: 8000 }, version: 1 }, 1);
    expect(migrated.settings.dailyGoalMl).toBe(HYDRATION_MAX_GOAL_ML);
  });

  it('returns empty state for missing legacy data', () => {
    const migrated = migrateHydrationState(undefined, 1);
    expect(migrated.entries).toEqual([]);
    expect(migrated.settings.dailyGoalMl).toBe(HYDRATION_DEFAULT_GOAL_ML);
  });

  it('upgrades v2 by adding the legacy migration marker without changing canonical data', () => {
    const state = {
      entries: [makeEntry({ amountMl: 250 })],
      settings: { dailyGoalMl: 2000, quickAmounts: [100, 250, 500] },
    };
    const envelope = { state, version: 2 };
    const migrated = migrateHydrationState(envelope, 2);
    expect(migrated).toEqual({
      ...state,
      legacyAppWaterMigrationVersion: 0,
    });
  });

  it('passes v3 canonical state through unchanged', () => {
    const state = {
      entries: [makeEntry({ amountMl: 250 })],
      settings: { dailyGoalMl: 2000, quickAmounts: [100, 250, 500] },
      legacyAppWaterMigrationVersion: 1,
    };
    expect(migrateHydrationState(state, 3)).toBe(state);
  });

  it('preserves legacy history across days (no deletion)', () => {
    const persisted = {
      state: {
        logs: [
          { amountMl: 800, createdAt: 100, date: '2026-07-01' },
          { amountMl: 250, createdAt: 200, date: '2026-07-02' },
        ],
        dailyTargetMl: 2000,
      },
      version: 1,
    };
    const migrated = migrateHydrationState(persisted, 1);
    expect(migrated.entries.map((e) => e.dateKey)).toEqual(['2026-07-01', '2026-07-02']);
  });
});

describe('HydrationStore — legacy AppData.water closure', () => {
  const legacyWater = {
    goalMl: 2600,
    cupMl: 300,
    todayMl: 750,
    updatedDate: '2026-08-22',
    reminderOn: true,
    reminderInterval: 45,
    dailyLogs: { '2026-08-21': 900, '2026-08-22': 750 },
  };
  const empty = () => ({
    entries: [] as HydrationEntry[],
    settings: { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: [...HYDRATION_DEFAULT_QUICK_AMOUNTS] },
    legacyAppWaterMigrationVersion: 0,
  });

  it('preserves legacy-only daily totals and preferences', () => {
    const migrated = migrateLegacyAppWaterState(empty(), legacyWater);
    expect(migrated.entries.map(entry => [entry.dateKey, entry.amountMl])).toEqual([
      ['2026-08-21', 900], ['2026-08-22', 750],
    ]);
    expect(migrated.settings).toEqual({ dailyGoalMl: 2600, quickAmounts: [300, 100, 250, 500] });
    expect(migrated.legacyAppWaterMigrationVersion).toBe(1);
  });

  it('is idempotent', () => {
    const once = migrateLegacyAppWaterState(empty(), legacyWater);
    expect(migrateLegacyAppWaterState(once, legacyWater)).toEqual(once);
  });

  it('does not overwrite canonical dates or canonical settings', () => {
    const canonical = {
      entries: [makeEntry({ id: 'canonical', dateKey: '2026-08-22', amountMl: 500 })],
      settings: { dailyGoalMl: 3200, quickAmounts: [400] },
      legacyAppWaterMigrationVersion: 0,
    };
    const migrated = migrateLegacyAppWaterState(canonical, legacyWater);
    expect(migrated.entries.find(entry => entry.dateKey === '2026-08-22')).toMatchObject({ id: 'canonical', amountMl: 500 });
    expect(migrated.entries.filter(entry => entry.dateKey === '2026-08-22')).toHaveLength(1);
    expect(migrated.settings).toEqual(canonical.settings);
  });

  it('uses updatedDate only when a daily aggregate is absent', () => {
    const migrated = migrateLegacyAppWaterState(empty(), { ...legacyWater, dailyLogs: {} });
    expect(migrated.entries).toHaveLength(1);
    expect(migrated.entries[0]).toMatchObject({ dateKey: '2026-08-22', amountMl: 750, source: 'migration' });
  });
});
