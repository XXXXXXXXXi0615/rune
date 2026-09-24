import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toLocalDateString } from '@/utils/date';
import type { FocusSessionEntry } from '@/types';
import { FOCUS_ACHIEVEMENT_REGISTRY, type FocusAchievementContext, type FocusAchievementId } from '@/features/focus/focusAchievementRegistry';
import { MINIMUM_VALID_FOCUS_SECONDS } from '@/features/focus/focusRuntimeConstants';

export type FocusIslandMode = 'off' | 'focus-only' | 'milestone-only' | 'always';
export type { FocusAchievementId } from '@/features/focus/focusAchievementRegistry';
export type FocusCareerOutcome = 'completed' | 'early_exit' | 'abandoned';

export interface FocusCareerStats {
  totalFocusSeconds: number;
  todayFocusSeconds: number;
  focusSessionCount: number;
  longestFocusSeconds: number;
  bestDayFocusSeconds: number;
  longestFocusStreakDays: number;
  completedFocusSessionCount: number;
  dawnOrLateSessionCount: number;
  mainQuestFocusSessionCount: number;
  updatedAt: string;
}

export interface FocusAchievementUnlock {
  id: FocusAchievementId;
  unlockedAt: string;
  viewedAt?: string;
  source?: 'session' | 'migration';
}

export interface FocusCareerSettlement {
  sessionId: string;
  outcome: FocusCareerOutcome;
  sessionFocusSeconds: number;
  todayFocusSeconds: number;
  totalFocusSeconds: number;
  focusSessionCount: number;
  achievementIds: FocusAchievementId[];
  settledAt: string;
}

/** Crash-recovery accumulator only. Running/paused authority remains useFocusSessionStore. */
export interface FocusRecoveryCheckpoint {
  sessionId: string;
  activeSince: number | null;
  accumulatedSeconds: number;
  lastPersistedAt: number;
  startedAt: number;
  linkedQuestId?: string;
}

interface FocusCareerState {
  stats: FocusCareerStats;
  todayDateKey: string;
  achievements: FocusAchievementUnlock[];
  unlockQueue: FocusAchievementId[];
  focusIslandMode: FocusIslandMode;
  recoveryCheckpoint: FocusRecoveryCheckpoint | null;
  settledSessionIds: string[];
  pendingSettlement: FocusCareerSettlement | null;
  migrationVersion: number;
  dailyFocusSeconds: Record<string, number>;
  completedFocusDateKeys: string[];
  rolloverToday: (now?: number) => void;
  startTracking: (sessionId: string, now?: number, linkedQuestId?: string) => void;
  pauseTracking: (sessionId: string, now?: number) => void;
  resumeTracking: (sessionId: string, now?: number) => void;
  checkpoint: (sessionId: string, now?: number, force?: boolean) => void;
  settleSession: (sessionId: string, outcome: FocusCareerOutcome, now?: number) => FocusCareerSettlement | null;
  migrateLegacySessions: (sessions: FocusSessionEntry[], now?: number) => void;
  markAchievementsViewed: (ids?: FocusAchievementId[], now?: number) => void;
  dismissSettlement: (sessionId: string, now?: number) => void;
  setFocusIslandMode: (mode: FocusIslandMode) => void;
  /** Phase 1.1B: Reconcile legacy stats from focusSessionLog using valid voyage threshold. Idempotent. */
  reconcileFromLogs: (logs: FocusSessionEntry[], now?: number) => void;
}

export const FOCUS_ACHIEVEMENTS = FOCUS_ACHIEVEMENT_REGISTRY;

const MAX_SETTLED_SESSION_IDS = 120;
const iso = (now: number) => new Date(now).toISOString();
const safeSeconds = (value: unknown) => Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;

const emptyStats = (): FocusCareerStats => ({
  totalFocusSeconds: 0,
  todayFocusSeconds: 0,
  focusSessionCount: 0,
  longestFocusSeconds: 0,
  bestDayFocusSeconds: 0,
  longestFocusStreakDays: 0,
  completedFocusSessionCount: 0,
  dawnOrLateSessionCount: 0,
  mainQuestFocusSessionCount: 0,
  updatedAt: new Date(0).toISOString(),
});

/** Splits a timestamp interval using local calendar midnights; safe across DST offset changes. */
export function splitFocusSegmentByLocalDate(startMs: number, endMs: number): Record<string, number> {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return {};
  const result: Record<string, number> = {};
  let cursor = startMs;
  while (cursor < endMs) {
    const cursorDate = new Date(cursor);
    const nextMidnight = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate() + 1).getTime();
    const boundary = Math.min(endMs, Math.max(cursor + 1, nextMidnight));
    const seconds = Math.max(0, Math.floor((boundary - cursor) / 1000));
    const key = toLocalDateString(cursorDate);
    result[key] = (result[key] || 0) + seconds;
    cursor = boundary;
  }
  return result;
}

function normalizeQueue(queue: FocusAchievementId[], achievements: FocusAchievementUnlock[]): FocusAchievementId[] {
  const unlockTime = new Map(achievements.map((item) => [item.id, Date.parse(item.unlockedAt) || 0]));
  return [...new Set(queue)].filter((id) => unlockTime.has(id)).sort((a, b) => (unlockTime.get(a) || 0) - (unlockTime.get(b) || 0));
}

export function toFocusAchievementContext(stats: FocusCareerStats): FocusAchievementContext {
  return { ...stats, focusSessionCount: stats.completedFocusSessionCount };
}

function unlockedFor(stats: FocusCareerStats, current: FocusAchievementUnlock[], now: number, source: 'session' | 'migration' = 'session') {
  const ids = new Set(current.map((item) => item.id));
  const context = toFocusAchievementContext(stats);
  const added = FOCUS_ACHIEVEMENT_REGISTRY
    .filter((item) => item.evaluate(context).unlocked && !ids.has(item.id))
    .map((item) => ({ id: item.id, unlockedAt: iso(now), source }));
  return { achievements: [...current, ...added], added: added.map((item) => item.id) };
}

function applySegment(state: FocusCareerState, checkpoint: FocusRecoveryCheckpoint, now: number) {
  const delta = Math.max(0, Math.floor((now - (checkpoint.activeSince ?? now)) / 1000));
  const todayDateKey = toLocalDateString(new Date(now));
  if (delta <= 0) {
    return {
      stats: state.todayDateKey === todayDateKey ? state.stats : { ...state.stats, todayFocusSeconds: 0, updatedAt: iso(now) },
      todayDateKey,
      checkpoint, dailyFocusSeconds: state.dailyFocusSeconds,
    };
  }
  const segmentEnd = (checkpoint.activeSince ?? now) + delta * 1000;
  const byDate = splitFocusSegmentByLocalDate(checkpoint.activeSince ?? now, segmentEnd);
  const dailyFocusSeconds = { ...state.dailyFocusSeconds };
  for (const [key, seconds] of Object.entries(byDate)) dailyFocusSeconds[key] = safeSeconds(dailyFocusSeconds[key]) + seconds;
  return {
    todayDateKey,
    stats: {
      ...state.stats,
      totalFocusSeconds: safeSeconds(state.stats.totalFocusSeconds) + delta,
      todayFocusSeconds: (state.todayDateKey === todayDateKey ? safeSeconds(state.stats.todayFocusSeconds) : 0) + (byDate[todayDateKey] || 0),
      updatedAt: iso(now),
      bestDayFocusSeconds: Math.max(safeSeconds(state.stats.bestDayFocusSeconds), ...Object.values(dailyFocusSeconds)),
    }, dailyFocusSeconds,
    checkpoint: {
      ...checkpoint,
      activeSince: segmentEnd,
      accumulatedSeconds: safeSeconds(checkpoint.accumulatedSeconds) + delta,
      lastPersistedAt: now,
    },
  };
}

export const useFocusCareerStore = create<FocusCareerState>()(persist((set, get) => ({
  stats: emptyStats(),
  todayDateKey: toLocalDateString(),
  achievements: [],
  unlockQueue: [],
  focusIslandMode: 'focus-only',
  recoveryCheckpoint: null,
  settledSessionIds: [],
  pendingSettlement: null,
  migrationVersion: 0,
  dailyFocusSeconds: {},
  completedFocusDateKeys: [],

  rolloverToday: (now = Date.now()) => set((state) => {
    const key = toLocalDateString(new Date(now));
    return state.todayDateKey === key ? state : { todayDateKey: key, stats: { ...state.stats, todayFocusSeconds: 0, updatedAt: iso(now) } };
  }),

  startTracking: (sessionId, now = Date.now(), linkedQuestId) => {
    get().rolloverToday(now);
    const state = get();
    if (!sessionId || state.settledSessionIds.includes(sessionId)) return;
    if (state.recoveryCheckpoint?.sessionId === sessionId) return;
    set({ recoveryCheckpoint: { sessionId, activeSince: now, accumulatedSeconds: 0, lastPersistedAt: now, startedAt: now, linkedQuestId } });
  },

  checkpoint: (sessionId, now = Date.now(), force = false) => {
    const state = get();
    const recovery = state.recoveryCheckpoint;
    if (!recovery || recovery.sessionId !== sessionId || recovery.activeSince == null || state.settledSessionIds.includes(sessionId)) {
      get().rolloverToday(now);
      return;
    }
    if (!force && now - recovery.lastPersistedAt < 20_000) return;
    const applied = applySegment(state, recovery, now);
    set({ stats: applied.stats, todayDateKey: applied.todayDateKey, recoveryCheckpoint: applied.checkpoint, dailyFocusSeconds: applied.dailyFocusSeconds });
  },

  pauseTracking: (sessionId, now = Date.now()) => {
    get().checkpoint(sessionId, now, true);
    const recovery = get().recoveryCheckpoint;
    if (recovery?.sessionId === sessionId) set({ recoveryCheckpoint: { ...recovery, activeSince: null, lastPersistedAt: now } });
  },

  resumeTracking: (sessionId, now = Date.now()) => {
    get().rolloverToday(now);
    const state = get();
    const recovery = state.recoveryCheckpoint;
    if (!recovery || recovery.sessionId !== sessionId || state.settledSessionIds.includes(sessionId)) return;
    if (recovery.activeSince == null) set({ recoveryCheckpoint: { ...recovery, activeSince: now, lastPersistedAt: now } });
  },

  settleSession: (sessionId, outcome, now = Date.now()) => {
    const before = get();
    if (!sessionId || before.settledSessionIds.includes(sessionId)) return null;
    if (before.recoveryCheckpoint?.sessionId === sessionId) get().checkpoint(sessionId, now, true);
    const state = get();
    const recovery = state.recoveryCheckpoint?.sessionId === sessionId ? state.recoveryCheckpoint : null;
    const sessionFocusSeconds = safeSeconds(recovery?.accumulatedSeconds);

    /* Phase 1.1A: Defense-in-depth — sub-threshold sessions cannot be valid voyages. */
    if (sessionFocusSeconds < MINIMUM_VALID_FOCUS_SECONDS) {
      // Still mark as settled to prevent re-processing, but skip all stats updates.
      set({
        settledSessionIds: [...state.settledSessionIds.filter((id) => id !== sessionId), sessionId].slice(-MAX_SETTLED_SESSION_IDS),
        recoveryCheckpoint: null,
        pendingSettlement: null,
      });
      return null;
    }

    const completed = outcome === 'completed';
    const startHour = new Date(recovery?.startedAt ?? now).getHours();
    const completedDateKey = toLocalDateString(new Date(now));
    const dateKeys = completed ? [...new Set([...state.completedFocusDateKeys, completedDateKey])].sort().slice(-400) : state.completedFocusDateKeys;
    let streak = 0;
    for (let index = dateKeys.length - 1; index >= 0; index -= 1) {
      if (index === dateKeys.length - 1 || Math.round((new Date(`${dateKeys[index + 1]}T12:00:00`).getTime() - new Date(`${dateKeys[index]}T12:00:00`).getTime()) / 86400000) === 1) streak += 1;
      else break;
    }
    const nextStats: FocusCareerStats = {
      ...state.stats,
      focusSessionCount: safeSeconds(state.stats.focusSessionCount) + 1,
      longestFocusSeconds: Math.max(safeSeconds(state.stats.longestFocusSeconds), sessionFocusSeconds),
      completedFocusSessionCount: safeSeconds(state.stats.completedFocusSessionCount) + (completed ? 1 : 0),
      longestFocusStreakDays: Math.max(safeSeconds(state.stats.longestFocusStreakDays), streak),
      dawnOrLateSessionCount: safeSeconds(state.stats.dawnOrLateSessionCount) + (completed && (startHour >= 23 || startHour < 7) ? 1 : 0),
      mainQuestFocusSessionCount: safeSeconds(state.stats.mainQuestFocusSessionCount) + (completed && Boolean(recovery?.linkedQuestId) ? 1 : 0),
      updatedAt: iso(now),
    };
    const unlocks = completed
      ? unlockedFor(nextStats, state.achievements, now)
      : { achievements: state.achievements, added: [] as FocusAchievementId[] };
    const queue = normalizeQueue([...state.unlockQueue, ...unlocks.added], unlocks.achievements);
    const settlement: FocusCareerSettlement | null = outcome === 'completed' ? {
      sessionId,
      outcome,
      sessionFocusSeconds,
      todayFocusSeconds: nextStats.todayFocusSeconds,
      totalFocusSeconds: nextStats.totalFocusSeconds,
      focusSessionCount: nextStats.focusSessionCount,
      achievementIds: queue,
      settledAt: iso(now),
    } : null;
    set({
      stats: nextStats,
      achievements: unlocks.achievements,
      unlockQueue: queue,
      recoveryCheckpoint: null,
      settledSessionIds: [...state.settledSessionIds.filter((id) => id !== sessionId), sessionId].slice(-MAX_SETTLED_SESSION_IDS),
      pendingSettlement: settlement,
      completedFocusDateKeys: dateKeys,
    });
    return settlement;
  },

  migrateLegacySessions: (sessions, now = Date.now()) => {
    const state = get();
    if (state.migrationVersion >= 2) return;
    const valid = sessions.filter((entry) => Number.isFinite(entry.actualFocusMinutes) && entry.actualFocusMinutes > 0);
    const total = valid.reduce((sum, entry) => sum + Math.round(entry.actualFocusMinutes * 60), 0);
    const todayDateKey = toLocalDateString(new Date(now));
    const today = valid.filter((entry) => entry.date === todayDateKey).reduce((sum, entry) => sum + Math.round(entry.actualFocusMinutes * 60), 0);
    const longest = valid.reduce((max, entry) => Math.max(max, Math.round(entry.actualFocusMinutes * 60)), 0);
    const mergedTotal = Math.max(safeSeconds(state.stats.totalFocusSeconds), total);
    const dailyFocusSeconds = valid.reduce<Record<string, number>>((map, entry) => { map[entry.date] = safeSeconds(map[entry.date]) + Math.round(entry.actualFocusMinutes * 60); return map; }, { ...state.dailyFocusSeconds });
    const completed = valid.filter((entry) => entry.status === 'completed');
    const dateKeys = [...new Set(completed.map((entry) => entry.date))].sort().slice(-400);
    let longestStreak = 0; let run = 0;
    dateKeys.forEach((key, index) => { run = index > 0 && Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${dateKeys[index - 1]}T12:00:00`).getTime()) / 86400000) === 1 ? run + 1 : 1; longestStreak = Math.max(longestStreak, run); });
    const nextStats: FocusCareerStats = {
      ...state.stats, totalFocusSeconds: mergedTotal,
      todayFocusSeconds: Math.max(state.todayDateKey === todayDateKey ? safeSeconds(state.stats.todayFocusSeconds) : 0, today),
      focusSessionCount: Math.max(safeSeconds(state.stats.focusSessionCount), valid.length),
      longestFocusSeconds: Math.max(safeSeconds(state.stats.longestFocusSeconds), longest),
      bestDayFocusSeconds: Math.max(safeSeconds(state.stats.bestDayFocusSeconds), ...Object.values(dailyFocusSeconds), 0),
      completedFocusSessionCount: Math.max(safeSeconds(state.stats.completedFocusSessionCount), completed.length),
      longestFocusStreakDays: Math.max(safeSeconds(state.stats.longestFocusStreakDays), longestStreak),
      dawnOrLateSessionCount: Math.max(safeSeconds(state.stats.dawnOrLateSessionCount), completed.filter((entry) => { const h = new Date(entry.startTime).getHours(); return h >= 23 || h < 7; }).length),
      mainQuestFocusSessionCount: Math.max(safeSeconds(state.stats.mainQuestFocusSessionCount), completed.filter((entry) => Boolean(entry.linkedQuestId)).length), updatedAt: iso(now),
    };
    const unlocks = unlockedFor(nextStats, state.achievements, now, 'migration');
    const queue = normalizeQueue([...state.unlockQueue, ...unlocks.added], unlocks.achievements);
    set({
      migrationVersion: 2,
      todayDateKey,
      stats: nextStats, dailyFocusSeconds, completedFocusDateKeys: dateKeys,
      achievements: unlocks.achievements,
      unlockQueue: queue,
    });
  },

  markAchievementsViewed: (ids, now = Date.now()) => {
    const state = get();
    const targets = new Set(ids ?? state.unlockQueue);
    set({
      achievements: state.achievements.map((item) => targets.has(item.id) && !item.viewedAt ? { ...item, viewedAt: iso(now) } : item),
      unlockQueue: state.unlockQueue.filter((id) => !targets.has(id)),
    });
  },

  dismissSettlement: (sessionId, now = Date.now()) => {
    const state = get();
    if (state.pendingSettlement?.sessionId !== sessionId) return;
    get().markAchievementsViewed(state.pendingSettlement.achievementIds, now);
    set({ pendingSettlement: null });
  },

  setFocusIslandMode: (focusIslandMode) => set({ focusIslandMode }),

  reconcileFromLogs: (logs, now = Date.now()) => {
    const state = get();
    if (state.migrationVersion >= 3) return;

    // Phase 1.1B Final: audit snapshot before authoritative rebuild
    try {
      localStorage.setItem('focus_career_pre_migration_v3_snapshot', JSON.stringify({
        stats: state.stats,
        completedFocusDateKeys: state.completedFocusDateKeys,
        migratedAt: iso(now),
      }));
    } catch { /* non-critical */ }

    // —— Valid completed voyages (the single source of truth) ——
    const valid = logs.filter((entry) =>
      Number.isFinite(entry.actualFocusMinutes) && entry.actualFocusMinutes > 0
      && entry.actualFocusMinutes * 60 >= MINIMUM_VALID_FOCUS_SECONDS
      && entry.status === 'completed',
    );

    // —— Class A: Fully derivable from logs ——
    const authoritativeCompleted = valid.length;
    const authoritativeTotal = valid.reduce((sum, e) => sum + Math.round(e.actualFocusMinutes * 60), 0);
    const authoritativeLongest = valid.reduce((max, e) => Math.max(max, Math.round(e.actualFocusMinutes * 60)), 0);
    const todayDateKey = toLocalDateString(new Date(now));
    const authoritativeToday = valid.filter((e) => e.date === todayDateKey).reduce((sum, e) => sum + Math.round(e.actualFocusMinutes * 60), 0);
    const perDay: Record<string, number> = {};
    valid.forEach((e) => { perDay[e.date] = safeSeconds(perDay[e.date]) + Math.round(e.actualFocusMinutes * 60); });
    const authoritativeBestDay = Object.values(perDay).reduce((m, v) => Math.max(m, v), 0);
    const dateKeys = [...new Set(valid.map((e) => e.date))].sort().slice(-400);
    let streak = 0; let run = 0;
    dateKeys.forEach((key, index) => {
      run = index > 0 && Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${dateKeys[index - 1]}T12:00:00`).getTime()) / 86400000) === 1 ? run + 1 : 1;
      streak = Math.max(streak, run);
    });

    // —— Class B: Partially derivable — use Math.max as conservative floor ——
    // focusSessionCount: includes abandoned/early_exit too; logs may not capture all of them
    const allLogCount = logs.filter((e) => Number.isFinite(e.actualFocusMinutes) && e.actualFocusMinutes > 0 && e.actualFocusMinutes * 60 >= MINIMUM_VALID_FOCUS_SECONDS).length;
    const safeSessionCount = Math.max(safeSeconds(state.stats.focusSessionCount), allLogCount);
    // dawnOrLate: needs startTime which isn't always available
    const safeDawnLate = safeSeconds(state.stats.dawnOrLateSessionCount);
    // mainQuestFocusSessionCount: needs linkedQuestId which isn't in FocusSessionEntry
    const safeMainQuest = safeSeconds(state.stats.mainQuestFocusSessionCount);

    const nextStats: FocusCareerStats = {
      totalFocusSeconds: authoritativeTotal,           // A
      todayFocusSeconds: authoritativeToday,            // A
      focusSessionCount: safeSessionCount,              // B (conservative)
      longestFocusSeconds: authoritativeLongest,        // A
      bestDayFocusSeconds: authoritativeBestDay,        // A
      longestFocusStreakDays: streak,                   // A
      completedFocusSessionCount: authoritativeCompleted, // A
      dawnOrLateSessionCount: safeDawnLate,             // B
      mainQuestFocusSessionCount: safeMainQuest,        // B
      updatedAt: iso(now),
    };
    set({ stats: nextStats, completedFocusDateKeys: dateKeys, migrationVersion: 3 });
  },
}), {
  name: 'lunartide-focus-career-v1',
  version: 2,
  partialize: (state) => ({
    stats: state.stats,
    todayDateKey: state.todayDateKey,
    achievements: state.achievements,
    unlockQueue: state.unlockQueue,
    focusIslandMode: state.focusIslandMode,
    recoveryCheckpoint: state.recoveryCheckpoint,
    settledSessionIds: state.settledSessionIds,
    pendingSettlement: state.pendingSettlement,
    migrationVersion: state.migrationVersion,
    dailyFocusSeconds: state.dailyFocusSeconds,
    completedFocusDateKeys: state.completedFocusDateKeys,
  }),
  merge: (persisted, current) => {
    const raw = (persisted || {}) as Partial<FocusCareerState> & { statsDateKey?: string; activeTracking?: FocusRecoveryCheckpoint | null };
    const now = Date.now();
    const todayDateKey = toLocalDateString(new Date(now));
    const storedDateKey = raw.todayDateKey || raw.statsDateKey || todayDateKey;
    const achievements = Array.isArray(raw.achievements) ? raw.achievements : [];
    return {
      ...current,
      ...raw,
      todayDateKey,
      stats: {
        ...emptyStats(),
        ...(raw.stats || {}),
        todayFocusSeconds: storedDateKey === todayDateKey ? safeSeconds(raw.stats?.todayFocusSeconds) : 0,
      },
      achievements,
      unlockQueue: normalizeQueue(Array.isArray(raw.unlockQueue) ? raw.unlockQueue : [], achievements),
      recoveryCheckpoint: (raw.recoveryCheckpoint || raw.activeTracking) ? { ...(raw.recoveryCheckpoint || raw.activeTracking)!, startedAt: (raw.recoveryCheckpoint || raw.activeTracking)!.startedAt ?? (raw.recoveryCheckpoint || raw.activeTracking)!.lastPersistedAt } : null,
      settledSessionIds: Array.isArray(raw.settledSessionIds) ? [...new Set(raw.settledSessionIds)].slice(-MAX_SETTLED_SESSION_IDS) : [],
      pendingSettlement: raw.pendingSettlement || null,
      dailyFocusSeconds: raw.dailyFocusSeconds || {},
      completedFocusDateKeys: Array.isArray(raw.completedFocusDateKeys) ? raw.completedFocusDateKeys.slice(-400) : [],
    };
  },
}));

export function getNextFocusMilestone(totalSeconds: number) {
  const total = safeSeconds(totalSeconds);
  const context = { totalFocusSeconds: total, focusSessionCount: 0, longestFocusSeconds: 0, bestDayFocusSeconds: 0, longestFocusStreakDays: 0, dawnOrLateSessionCount: 0, mainQuestFocusSessionCount: 0 };
  const item = FOCUS_ACHIEVEMENT_REGISTRY.filter((entry) => entry.category === 'duration').find((entry) => !entry.evaluate(context).unlocked);
  return item ? { ...item, seconds: item.evaluate(context).target } : null;
}

export function getFocusMilestoneProgress(totalSeconds: number, targetSeconds: number): number {
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return 100;
  return Math.max(0, Math.min(100, (safeSeconds(totalSeconds) / Math.floor(targetSeconds)) * 100));
}
