import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toLocalDateString } from '@/utils/date';
import type { WaterData } from '@/types';

/**
 * Phase 1.5A — Daily Hydration data layer.
 *
 * - Entries are grouped by local-timezone `dateKey` (YYYY-MM-DD).
 * - Totals are ALWAYS derived from entries (never persisted).
 * - Single-entry cap HYDRATION_MAX_ENTRY_ML; goal clamps to [MIN, MAX].
 * - Idempotent persisted migrations: legacy `logs` and AppData.water daily
 *   aggregates become entries with source `'migration'`.
 */

export interface HydrationEntry {
  id: string;
  dateKey: string;
  amountMl: number;
  recordedAt: number;
  source: 'quick_add' | 'custom' | 'migration';
}

export interface HydrationSettings {
  dailyGoalMl: number;
  quickAmounts: number[];
}

export const HYDRATION_DEFAULT_GOAL_ML = 2000;
export const HYDRATION_MIN_GOAL_ML = 250;
export const HYDRATION_MAX_GOAL_ML = 6000;
export const HYDRATION_MAX_ENTRY_ML = 3000;
export const HYDRATION_DEFAULT_QUICK_AMOUNTS = [100, 250, 500];

interface HydrationState {
  entries: HydrationEntry[];
  settings: HydrationSettings;
  legacyAppWaterMigrationVersion: number;
  addEntry: (amountMl: number, source?: 'quick_add' | 'custom') => boolean;
  addEntryForDate: (amountMl: number, dateKey: string, source?: 'quick_add' | 'custom') => boolean;
  removeEntry: (entryId: string) => void;
  undoLastEntry: () => void;
  setDailyGoal: (goalMl: number) => void;
  setQuickAmounts: (amounts: number[]) => void;
  resetSettings: () => void;
  migrateLegacyAppWater: (legacy: WaterData | null | undefined) => void;
}

const roundMl = (value: number) => Math.round(Number(value) || 0);

/** Entries for one local day, ascending by recordedAt. */
export function getDailyEntries(entries: HydrationEntry[], dateKey: string): HydrationEntry[] {
  return entries
    .filter((entry) => entry.dateKey === dateKey)
    .sort((a, b) => a.recordedAt - b.recordedAt);
}

/** Derived total for one local day — never stored. */
export function getDailyTotal(entries: HydrationEntry[], dateKey: string): number {
  return getDailyEntries(entries, dateKey).reduce((sum, entry) => sum + entry.amountMl, 0);
}

/** Latest entry for one local day, or null when the day has no entries. */
export function getLatestEntryOfDay(entries: HydrationEntry[], dateKey: string): HydrationEntry | null {
  const dayEntries = getDailyEntries(entries, dateKey);
  return dayEntries.length > 0 ? dayEntries[dayEntries.length - 1] : null;
}

/**
 * Unwrap the zustand persist envelope ({ state, version }) so legacy
 * v1 payloads nested under `state` can be migrated without data loss.
 */
function unwrapPersisted(persisted: unknown): Record<string, unknown> {
  if (persisted && typeof persisted === 'object') {
    const asRecord = persisted as Record<string, unknown>;
    if (asRecord.state && typeof asRecord.state === 'object' && !Array.isArray(asRecord.state)) {
      return asRecord.state as Record<string, unknown>;
    }
    return asRecord;
  }
  return {};
}

interface LegacyHydrationLog {
  id?: string;
  amountMl: number;
  createdAt?: number;
  date?: string;
}

interface LegacyHydrationState {
  logs?: LegacyHydrationLog[];
  dailyTargetMl?: number;
}

function createEntry(amountMl: number, dateKey: string, source: 'quick_add' | 'custom'): HydrationEntry {
  const now = Date.now();
  return { id: `water_${now}_${Math.random().toString(36).slice(2, 7)}`, dateKey, amountMl, recordedAt: now, source };
}

export const useHydrationStore = create<HydrationState>()(persist((set, get) => ({
  entries: [],
  settings: {
    dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML,
    quickAmounts: HYDRATION_DEFAULT_QUICK_AMOUNTS,
  },
  legacyAppWaterMigrationVersion: 0,
  addEntry: (amountMl, source = 'quick_add') => {
    const safeAmount = roundMl(amountMl);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0 || safeAmount > HYDRATION_MAX_ENTRY_ML) return false;
    const entry = createEntry(safeAmount, toLocalDateString(), source === 'custom' ? 'custom' : 'quick_add');
    set((state) => ({ entries: [...state.entries, entry] }));
    return true;
  },
  addEntryForDate: (amountMl, dateKey, source = 'quick_add') => {
    const safeAmount = roundMl(amountMl);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(safeAmount) || safeAmount <= 0 || safeAmount > HYDRATION_MAX_ENTRY_ML) return false;
    const entry = createEntry(safeAmount, dateKey, source === 'custom' ? 'custom' : 'quick_add');
    set((state) => ({ entries: [...state.entries, entry] }));
    return true;
  },
  removeEntry: (entryId) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== entryId) })),
  undoLastEntry: () => {
    const { entries } = get();
    const dateKey = toLocalDateString();
    const latest = getLatestEntryOfDay(entries, dateKey);
    if (!latest) return;
    set({ entries: entries.filter((entry) => entry.id !== latest.id) });
  },
  setDailyGoal: (goalMl) => {
    const rawGoal = Number(goalMl);
    if (!Number.isFinite(rawGoal)) return;
    set((state) => ({
      settings: {
        ...state.settings,
        dailyGoalMl: Math.max(HYDRATION_MIN_GOAL_ML, Math.min(HYDRATION_MAX_GOAL_ML, roundMl(rawGoal))),
      },
    }));
  },
  setQuickAmounts: (amounts) =>
    set((state) => ({
      settings: {
        ...state.settings,
        quickAmounts: amounts
          .map(roundMl)
          .filter((n) => Number.isFinite(n) && n > 0 && n <= HYDRATION_MAX_ENTRY_ML)
          .slice(0, 6),
      },
    })),
  resetSettings: () =>
    set((state) => ({
      settings: {
        dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML,
        quickAmounts: HYDRATION_DEFAULT_QUICK_AMOUNTS,
      },
    })),
  migrateLegacyAppWater: (legacy) => set((state) => migrateLegacyAppWaterState(state, legacy)),
}), {
  name: 'lunartide-hydration-v1',
  version: 3,
  migrate: (persisted, version) => migrateHydrationState(persisted, version),
}));

export type HydrationPersistedState = Pick<HydrationState, 'entries' | 'settings' | 'legacyAppWaterMigrationVersion'>;

/**
 * Persisted-state migration through v3. V2 canonical entries/settings are
 * preserved while the AppData compatibility marker is added. Legacy v1
 * `logs` (with `date`) become entries with source `'migration'`, and
 * `dailyTargetMl` is clamped to [MIN, MAX].
 * Handles both the zustand envelope ({ state, version }) and flat legacy
 * payloads.
 */
export function migrateHydrationState(persisted: unknown, version: number): HydrationPersistedState {
  if (version >= 3) return persisted as HydrationPersistedState;
  if (version === 2) {
    const current = unwrapPersisted(persisted) as Partial<HydrationPersistedState>;
    return {
      entries: Array.isArray(current.entries) ? current.entries : [],
      settings: current.settings ?? { dailyGoalMl: HYDRATION_DEFAULT_GOAL_ML, quickAmounts: HYDRATION_DEFAULT_QUICK_AMOUNTS },
      legacyAppWaterMigrationVersion: 0,
    };
  }
  const old = unwrapPersisted(persisted) as LegacyHydrationState;
  const legacyLogs = Array.isArray(old.logs) ? old.logs : [];
  const entries: HydrationEntry[] = legacyLogs
    .filter(
      (log) =>
        log &&
        typeof log.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(log.date) &&
        Number.isFinite(Number(log.amountMl)) &&
        Number(log.amountMl) > 0,
    )
    .map((log) => ({
      id: log.id ?? `migrated_${Number(log.createdAt) || 0}_${Math.random().toString(36).slice(2, 7)}`,
      dateKey: log.date as string,
      amountMl: Math.min(HYDRATION_MAX_ENTRY_ML, Math.round(Number(log.amountMl))),
      recordedAt: Number.isFinite(Number(log.createdAt)) ? Number(log.createdAt) : Date.now(),
      source: 'migration' as const,
    }));
  const goal = Number(old.dailyTargetMl);
  return {
    entries,
    settings: {
      dailyGoalMl:
        Number.isFinite(goal) && goal >= HYDRATION_MIN_GOAL_ML
          ? Math.min(HYDRATION_MAX_GOAL_ML, Math.round(goal))
          : HYDRATION_DEFAULT_GOAL_ML,
      quickAmounts: HYDRATION_DEFAULT_QUICK_AMOUNTS,
    },
    legacyAppWaterMigrationVersion: 0,
  };
}

/**
 * One-way compatibility import from AppData.water aggregate totals.
 * Existing canonical dates always win; the legacy aggregate remains in AppData
 * as recovery evidence because individual legacy event times never existed.
 */
export function migrateLegacyAppWaterState(
  current: Pick<HydrationPersistedState, 'entries' | 'settings' | 'legacyAppWaterMigrationVersion'>,
  legacy: WaterData | null | undefined,
): HydrationPersistedState {
  if (!legacy || current.legacyAppWaterMigrationVersion >= 1) return current;
  const totals = new Map<string, number>();
  for (const [dateKey, rawAmount] of Object.entries(legacy.dailyLogs ?? {})) {
    const amount = roundMl(rawAmount);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && amount > 0) totals.set(dateKey, amount);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(legacy.updatedDate) && roundMl(legacy.todayMl) > 0 && !totals.has(legacy.updatedDate)) {
    totals.set(legacy.updatedDate, roundMl(legacy.todayMl));
  }
  const occupiedDates = new Set(current.entries.map((entry) => entry.dateKey));
  const imported = [...totals.entries()]
    .filter(([dateKey]) => !occupiedDates.has(dateKey))
    .map(([dateKey, amountMl]) => ({
      id: `legacy_app_water_${dateKey}`,
      dateKey,
      amountMl,
      recordedAt: new Date(`${dateKey}T00:00:00`).getTime(),
      source: 'migration' as const,
    }));
  const pristineCanonical = current.entries.length === 0
    && current.settings.dailyGoalMl === HYDRATION_DEFAULT_GOAL_ML
    && current.settings.quickAmounts.join(',') === HYDRATION_DEFAULT_QUICK_AMOUNTS.join(',');
  const legacyGoal = roundMl(legacy.goalMl);
  const legacyCup = roundMl(legacy.cupMl);
  const settings = pristineCanonical ? {
    dailyGoalMl: legacyGoal > 0
      ? Math.max(HYDRATION_MIN_GOAL_ML, Math.min(HYDRATION_MAX_GOAL_ML, legacyGoal))
      : current.settings.dailyGoalMl,
    quickAmounts: legacyCup > 0 && legacyCup <= HYDRATION_MAX_ENTRY_ML
      ? [legacyCup, ...HYDRATION_DEFAULT_QUICK_AMOUNTS.filter((amount) => amount !== legacyCup)].slice(0, 6)
      : current.settings.quickAmounts,
  } : current.settings;
  return { entries: [...current.entries, ...imported], settings, legacyAppWaterMigrationVersion: 1 };
}
