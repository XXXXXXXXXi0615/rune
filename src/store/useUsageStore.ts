import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  UsageSession,
  DailyUsageRecord,
  UsageLockSettings,
  UsageModuleId,
  TemporaryExtensionGrantResult,
  UsageEvent,
} from '@/types/usage';
import { DEFAULT_LOCK_SETTINGS, resolveUsageModule } from '@/types/usage';
import { toLocalDateString } from '@/utils/date';
import { makeId, splitSessionAcrossMidnight } from '@/utils/usageSplit';

interface UsagePrivateState {
  currentSession: UsageSession | null;
  isTracking: boolean;
  sessions: UsageSession[];
  dailyRecords: DailyUsageRecord[];
  lockSettings: UsageLockSettings;
  temporaryExtensionMinutes: number;
  extensionExpiresAt: number;
  extensionGrantedDateKey?: string;
  passwordBypassExpiresAt: number;
  usageEvents: UsageEvent[];
  eventHistoryStartedAt: number;
  lockEpisodeActive: boolean;
}

interface UsageActions {
  startSession: (moduleId: UsageModuleId) => string;
  pauseSession: () => void;
  resumeSession: () => string;
  closeSession: () => void;
  switchModule: (moduleId: UsageModuleId) => void;
  stopTracking: () => void;
  startTracking: () => void;
  setLockSettings: (patch: Partial<UsageLockSettings>) => void;
  grantTemporaryExtension: () => Promise<TemporaryExtensionGrantResult>;
  grantPasswordBypass: () => void;
  clearExtension: () => void;
  getTodayTotalMs: () => number;
  getTodayRecord: () => DailyUsageRecord | undefined;
  isLocked: () => boolean;
  recordLockTriggered: () => Promise<boolean>;
}

type UsageStore = UsagePrivateState & UsageActions;
type PersistedUsageState = Omit<UsagePrivateState, 'currentSession' | 'isTracking'>;

function addDuration(
  records: DailyUsageRecord[],
  dateKey: string,
  moduleId: UsageModuleId,
  ms: number,
): DailyUsageRecord[] {
  const copy = [...records];
  const idx = copy.findIndex((r) => r.dateKey === dateKey);
  if (idx === -1) {
    copy.push({
      dateKey,
      moduleDurationsMs: { [moduleId]: ms },
      totalDurationMs: ms,
    });
  } else {
    const rec = { ...copy[idx], moduleDurationsMs: { ...copy[idx].moduleDurationsMs } };
    rec.moduleDurationsMs[moduleId] = (rec.moduleDurationsMs[moduleId] ?? 0) + ms;
    rec.totalDurationMs += ms;
    copy[idx] = rec;
  }
  return copy;
}

/**
 * Closes a session: splits the CLOSING session across midnight (if needed)
 * and aggregates each split part into its own day's daily record.
 *
 * NOTE: splitSessionAcrossMidnight prepends the passed-in sessions array,
 * so we must pass [] here — otherwise every pre-existing session would be
 * re-added to dailyRecords on every close (double/triple counting).
 */
function finalizeSession(
  state: { sessions: UsageSession[]; dailyRecords: DailyUsageRecord[] },
  session: UsageSession,
  now: number,
): { sessions: UsageSession[]; dailyRecords: DailyUsageRecord[] } | null {
  const durationMs = now - session.startedAt;
  if (durationMs <= 0) return null;
  const parts = splitSessionAcrossMidnight([], session, session.startedAt, now);
  let records = state.dailyRecords;
  for (const part of parts) {
    const partEnd = part.endedAt;
    if (partEnd == null) continue;
    records = addDuration(records, part.dateKey, part.moduleId, partEnd - part.startedAt);
  }
  const pruned = pruneOldSessions([...state.sessions, ...parts]);
  return { sessions: pruned, dailyRecords: records };
}

function pruneOldSessions(sessions: UsageSession[]): UsageSession[] {
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => s.endedAt && s.endedAt > cutoff);
}

function pruneUsageEvents(events: UsageEvent[], now = Date.now()): UsageEvent[] {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 89);
  return events.filter((event) => Number.isFinite(event.occurredAt) && event.occurredAt >= cutoff.getTime());
}

export function migrateUsageState(persisted: unknown): Partial<UsagePrivateState> {
  const state = persisted && typeof persisted === 'object' ? persisted as Partial<UsagePrivateState> : {};
  return {
    ...state,
    usageEvents: pruneUsageEvents(Array.isArray(state.usageEvents) ? state.usageEvents : []),
    eventHistoryStartedAt: Number.isFinite(state.eventHistoryStartedAt) && (state.eventHistoryStartedAt ?? 0) > 0
      ? state.eventHistoryStartedAt
      : Date.now(),
    lockEpisodeActive: state.lockEpisodeActive === true,
  };
}

export const useUsageStore = create<UsageStore>()(
  persist(
    (set, get) => ({
      currentSession: null,
      isTracking: false,
      sessions: [],
      dailyRecords: [],
      lockSettings: { ...DEFAULT_LOCK_SETTINGS },
      temporaryExtensionMinutes: 0,
      extensionExpiresAt: 0,
      extensionGrantedDateKey: undefined,
      passwordBypassExpiresAt: 0,
      usageEvents: [],
      eventHistoryStartedAt: Date.now(),
      lockEpisodeActive: false,

      startSession: (moduleId) => {
        const state = get();
        if (!state.isTracking) return '';
        // Close any existing session first
        if (state.currentSession) {
          state.closeSession();
        }
        const id = makeId();
        const session: UsageSession = {
          id,
          moduleId,
          startedAt: Date.now(),
          dateKey: toLocalDateString(),
        };
        set({ currentSession: session });
        return id;
      },

      pauseSession: () => {
        const state = get();
        if (!state.currentSession || !state.currentSession.startedAt) return;
        const now = Date.now();
        const session = state.currentSession;
        const finalized = finalizeSession(state, session, now);
        if (!finalized) {
          set({ currentSession: null });
          return;
        }
        set({ currentSession: null, sessions: finalized.sessions, dailyRecords: finalized.dailyRecords });
      },

      resumeSession: () => {
        const state = get();
        if (!state.isTracking) return '';
        if (state.currentSession) return state.currentSession.id;
        const moduleId = resolveUsageModule(window.location.pathname);
        return state.startSession(moduleId);
      },

      closeSession: () => {
        const state = get();
        if (!state.currentSession) return;
        const session = state.currentSession;
        const finalized = finalizeSession(state, session, Date.now());
        if (!finalized) {
          set({ currentSession: null });
          return;
        }
        set({ currentSession: null, sessions: finalized.sessions, dailyRecords: finalized.dailyRecords });
      },

      switchModule: (moduleId) => {
        const state = get();
        if (!state.isTracking) return;
        if (state.currentSession) {
          state.closeSession();
        }
        state.startSession(moduleId);
      },

      stopTracking: () => {
        const state = get();
        if (state.currentSession) {
          state.closeSession();
        }
        set({ isTracking: false });
      },

      startTracking: () => {
        const state = get();
        if (state.isTracking) return;
        const moduleId = resolveUsageModule(window.location.pathname);
        set({ isTracking: true });
        // Start a session if the document is focused and visible
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          state.startSession(moduleId);
        }
      },

      setLockSettings: (patch) =>
        set((s) => ({
          lockSettings: { ...s.lockSettings, ...patch },
          lockEpisodeActive: patch.enabled === false ? false : s.lockEpisodeActive,
        })),

      grantTemporaryExtension: async () => {
        const commit = async (): Promise<TemporaryExtensionGrantResult> => {
          await useUsageStore.persist.rehydrate();
          const state = get();
          const now = Date.now();
          const today = toLocalDateString(new Date(now));
          if (!state.lockSettings.allowTemporaryExtension) return { ok: false, reason: 'not-allowed' };
          if (state.extensionGrantedDateKey === today) return { ok: false, reason: 'already-used-today' };
          if (!state.extensionGrantedDateKey && state.extensionExpiresAt > now) {
            return { ok: false, reason: 'already-active' };
          }
          const limitMs = state.lockSettings.dailyLimitMinutes * 60 * 1000;
          if (!state.lockSettings.enabled || state.getTodayTotalMs() < limitMs) {
            return { ok: false, reason: 'not-at-limit' };
          }
          const nextMidnight = new Date(now);
          nextMidnight.setHours(24, 0, 0, 0);
          const expiresAt = Math.min(now + 10 * 60 * 1000, nextMidnight.getTime());
          set({
            temporaryExtensionMinutes: 10,
            extensionExpiresAt: expiresAt,
            extensionGrantedDateKey: today,
            lockEpisodeActive: false,
            usageEvents: pruneUsageEvents([
              ...state.usageEvents,
              { id: makeId(), type: 'extension_granted', occurredAt: now, dateKey: today, extensionMinutes: 10 },
            ], now),
          });
          const next = get();
          if (
            next.isTracking
            && !next.currentSession
            && document.visibilityState === 'visible'
            && document.hasFocus()
          ) next.resumeSession();
          return { ok: true, expiresAt };
        };
        if (!navigator.locks) return commit();
        return navigator.locks.request('lunartide-usage-extension-grant-v1', { mode: 'exclusive' }, commit);
      },

      grantPasswordBypass: () => {
        const expiresAt = new Date().setHours(23, 59, 59, 999);
        set({ extensionExpiresAt: expiresAt, passwordBypassExpiresAt: expiresAt, lockEpisodeActive: false });
        const state = get();
        if (
          state.isTracking
          && !state.currentSession
          && document.visibilityState === 'visible'
          && document.hasFocus()
        ) state.resumeSession();
      },

      clearExtension: () =>
        set({ temporaryExtensionMinutes: 0, extensionExpiresAt: 0, passwordBypassExpiresAt: 0 }),

      getTodayTotalMs: () => {
        const state = get();
        const today = toLocalDateString();
        const record = state.dailyRecords.find((r) => r.dateKey === today);
        let total = record?.totalDurationMs ?? 0;
        if (state.currentSession) {
          const startOfToday = new Date().setHours(0, 0, 0, 0);
          const elapsed = Date.now() - Math.max(state.currentSession.startedAt, startOfToday);
          if (elapsed > 0) total += elapsed;
        }
        return total;
      },

      getTodayRecord: () => {
        const state = get();
        const today = toLocalDateString();
        const record = state.dailyRecords.find((r) => r.dateKey === today);
        if (!state.currentSession) return record;
        const startOfToday = new Date().setHours(0, 0, 0, 0);
        const elapsed = Date.now() - Math.max(state.currentSession.startedAt, startOfToday);
        if (elapsed <= 0) return record;
        const mod = state.currentSession.moduleId;
        const copy = record
          ? {
              ...record,
              moduleDurationsMs: { ...record.moduleDurationsMs },
            }
          : { dateKey: today, moduleDurationsMs: {} as Record<UsageModuleId, number>, totalDurationMs: 0 };
        copy.moduleDurationsMs[mod] = (copy.moduleDurationsMs[mod] ?? 0) + elapsed;
        copy.totalDurationMs += elapsed;
        return copy;
      },

      isLocked: () => {
        const state = get();
        if (!state.lockSettings.enabled) return false;
        const now = Date.now();
        const today = toLocalDateString(new Date(now));
        const temporaryExtensionActive = state.extensionGrantedDateKey === today && state.extensionExpiresAt > now;
        const legacyPasswordBypassActive = !state.extensionGrantedDateKey && state.extensionExpiresAt > now;
        const passwordBypassActive = state.passwordBypassExpiresAt > now;
        if (temporaryExtensionActive || legacyPasswordBypassActive || passwordBypassActive) return false;
        const todayTotalMs = state.getTodayTotalMs();
        const limitMs = state.lockSettings.dailyLimitMinutes * 60 * 1000;
        return todayTotalMs >= limitMs;
      },

      recordLockTriggered: async () => {
        const commit = async () => {
          await useUsageStore.persist.rehydrate();
          const state = get();
          const today = toLocalDateString();
          const latestLock = [...state.usageEvents].reverse().find((event) => event.type === 'lock_triggered');
          if (!state.isLocked() || (state.lockEpisodeActive && latestLock?.dateKey === today)) return false;
          const now = Date.now();
          const event: UsageEvent = {
            id: makeId(),
            type: 'lock_triggered',
            occurredAt: now,
            dateKey: toLocalDateString(new Date(now)),
            dailyUsageMs: state.getTodayTotalMs(),
            dailyLimitMinutes: state.lockSettings.dailyLimitMinutes,
          };
          set({ lockEpisodeActive: true, usageEvents: pruneUsageEvents([...state.usageEvents, event], now) });
          return true;
        };
        if (!navigator.locks) return commit();
        return navigator.locks.request('lunartide-usage-lock-event-v1', { mode: 'exclusive' }, commit);
      },
    }),
    {
      name: 'lunartide-usage',
      version: 1,
      migrate: (persisted) => migrateUsageState(persisted) as PersistedUsageState,
      partialize: (state) => ({
        sessions: state.sessions,
        dailyRecords: state.dailyRecords,
        lockSettings: state.lockSettings,
        temporaryExtensionMinutes: state.temporaryExtensionMinutes,
        extensionExpiresAt: state.extensionExpiresAt,
        extensionGrantedDateKey: state.extensionGrantedDateKey,
        passwordBypassExpiresAt: state.passwordBypassExpiresAt,
        usageEvents: state.usageEvents,
        eventHistoryStartedAt: state.eventHistoryStartedAt,
        lockEpisodeActive: state.lockEpisodeActive,
      }),
      // Hydrate: after persist restores, compute current state
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Prune old data on load
          const pruned = pruneOldSessions(state.sessions);
          const prunedEvents = pruneUsageEvents(state.usageEvents ?? []);
          if (pruned.length !== state.sessions.length || prunedEvents.length !== (state.usageEvents?.length ?? 0)) {
            useUsageStore.setState({ sessions: pruned, usageEvents: prunedEvents });
          }
        }
      },
    },
  ),
);
