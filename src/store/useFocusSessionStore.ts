import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppStore } from '@/store/useAppStore';
import { useFocusWitnessStore } from '@/store/useFocusWitnessStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useFocusCareerStore } from '@/store/useFocusCareerStore';
import { useTideRailStore } from '@/store/useTideRailStore';
import { toLocalDateString } from '@/utils/date';
import { todayEarnedBySource, todayLostBySource, settleFocusSession, CAP_RULES } from '@/utils/moonDewEngine';
import { MINIMUM_VALID_FOCUS_SECONDS } from '@/features/focus/focusRuntimeConstants';
import type { FocusSessionEntry, MemoryEntry, MoonDewLedgerEntry } from '@/types';
import type { FocusRoomCategory, FocusRoomType } from '@/components/focus/types';

export type FocusEventType =
  | 'session_created'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'early_exit'
  | 'abandoned';

export interface FocusFlags {
  overAdjusting: boolean
  earlyEscape: boolean
  noTaskDefined: boolean
  goodRecovery: boolean
  honestCompletion: boolean
  fakePreparation: boolean
}

function defaultFlags(): FocusFlags {
  return {
    overAdjusting: false,
    earlyEscape: false,
    noTaskDefined: false,
    goodRecovery: false,
    honestCompletion: false,
    fakePreparation: false,
  };
}

function clawdObservation(flags: FocusFlags, pauseCount: number, status: string): string {
  if (status === 'completed') {
    if (flags.goodRecovery) return 'CLAWD 看見你暫停卻守住了約定，值得尊敬。';
    if (flags.honestCompletion) return 'CLAWD 見證了一次誠實的約定。';
    return 'CLAWD 守住了這次約定。';
  }
  if (status === 'early_exit' || status === 'abandoned') {
    if (flags.earlyEscape) return 'CLAWD 抓包：你提早溜走了。';
    if (flags.overAdjusting) return 'CLAWD 盯梢：你是不是一直在調參數？';
    if (pauseCount > 2) return 'CLAWD 拆藉口檢測：暫停太多次了。';
    return 'CLAWD 注意到這次沒有完成約定。';
  }
  return '';
}

function writeMemoryEntry(
  entry: FocusSessionEntry,
  eventType: FocusEventType,
  flags: FocusFlags,
  pauseCount: number,
  durationChanges: number,
  task?: string,
  sessionId?: string,
): string | undefined {
  const witness = useFocusWitnessStore.getState();
  if (!witness.witnessEnabled) return;

  const store = useAppStore.getState();
  const statusLabel = eventType === 'completed' ? '完成' : eventType === 'early_exit' ? '提早結束' : '中斷';
  const observation = clawdObservation(flags, pauseCount, eventType);

  // Phase 1.1.1: Idempotency — find existing focus memory for this session
  const existingFocusMemory = sessionId
    ? (store.memoryEntries || []).find(
        (m) => m.source === 'focus' && m.metadata && typeof m.metadata === 'object' && (m.metadata as Record<string, unknown>).sessionId === sessionId,
      )
    : undefined;

  const vaultEntry: Partial<MemoryEntry> = {
    scene: `TIDEBOUND · ${statusLabel} · ${entry.plannedFocusMinutes}min`,
    triggerText: '',
    bodyThoughts: [
      task ? `任務: ${task}` : null,
      `計劃時長: ${entry.plannedFocusMinutes} 分鐘`,
      `實際時長: ${entry.actualFocusMinutes} 分鐘`,
      `暫停次數: ${pauseCount}`,
      `修改時間次數: ${durationChanges}`,
      entry.status !== 'completed' ? '⚠ 提前退出' : null,
      observation ? `CLAWD 觀察: ${observation}` : null,
    ].filter(Boolean).join('\n'),
    anxietyLevel: 0,
    nextStep: '',
    title: `TIDEBOUND · ${statusLabel}`,
    content: `${entry.plannedFocusMinutes} 分鐘專注，實際 ${entry.actualFocusMinutes} 分鐘`,
    owner: 'shared',
    createdBy: 'system',
    source: 'focus',
    type: 'focus-session',
    allowAiRecall: witness.allowRecall,
    localOnly: true,
    sensitive: false,
    status: 'active',
    tags: Object.entries(flags).filter(([, v]) => v).map(([k]) => k),
    metadata: {
      sessionId: entry.id,
      task: task || '',
      plannedDuration: entry.plannedFocusMinutes,
      actualDuration: entry.actualFocusMinutes,
      pauseCount,
      durationChanges,
      roundsCompleted: entry.roundsCompleted,
      plannedRounds: entry.plannedRounds,
      eventType,
      flags,
      clawdObservation: observation,
    },
  } as any;

  if (existingFocusMemory) {
    // Update existing memory
    store.updateMemoryEntry(existingFocusMemory.id, vaultEntry as any);
    return existingFocusMemory.id;
  }

  return store.addMemoryEntry(vaultEntry as any);
}

export type FocusSessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'interrupted';

export interface FocusSettlementResult {
  sessionId: string;
  outcome: 'completed' | 'early_exit' | 'abandoned';
  entries: MoonDewLedgerEntry[];
  total: number;
  timestamp: number;
  balanceAfter: number;
  selfReport?: string;
  memorySaved?: boolean;
  memoryEntryId?: string;
  requestedTotal?: number;
}

export interface FocusSession {
  sessionId: string | null;
  status: FocusSessionStatus;
  startedAt: number;
  durationMinutes: number;
  restMinutes: number;
  rounds: number;
  currentRound: number;
  phase: 'focus' | 'break';
  endAt: number;
  remainingSeconds: number;
  /** Accumulated focus-seconds across all rounds. Only ticks when status===running && phase===focus. */
  elapsedFocusSeconds: number;
  interruptions: number;
  roundsCompleted: number;
  pauseCount: number;
  durationChangeCount: number;
  task?: string;
  flags: FocusFlags;
  selfReport?: string;
  lastSettlement: FocusSettlementResult | null;
  loopMode: boolean;
  sessionCategory: FocusRoomCategory;
  roomType: FocusRoomType;
  linkedQuestId?: string;
}

interface FocusSessionActions {
  startSession: (opts: { durationMinutes: number; restMinutes: number; rounds: number; task?: string; loopMode?: boolean; category?: FocusRoomCategory; roomType?: FocusRoomType; linkedQuestId?: string }) => void;
  setTask: (task: string) => void;
  changeDuration: (minutes: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  completeSession: (selfReport?: string) => void;
  interruptSession: () => void;
  tick: () => void;
  transitionPhase: () => void;
  resetSession: () => void;
  finalizeFocusSession: (outcome: 'completed' | 'early_exit' | 'abandoned') => void;
  clearLastSettlement: () => void;
  dismissSettlement: () => void;
  saveSelfReport: (report: string) => void;
  recoverSettlement: () => void;
}

const initialState: FocusSession = {
  sessionId: null,
  status: 'idle',
  startedAt: 0,
  durationMinutes: 25,
  restMinutes: 5,
  rounds: 0,
  currentRound: 1,
  phase: 'focus',
  endAt: 0,
  remainingSeconds: 0,
  elapsedFocusSeconds: 0,
  interruptions: 0,
  roundsCompleted: 0,
  pauseCount: 0,
  durationChangeCount: 0,
  task: undefined,
  flags: defaultFlags(),
  selfReport: undefined,
  lastSettlement: null,
  loopMode: false,
  sessionCategory: 'focus',
  roomType: 'computer',
  linkedQuestId: undefined,
};

function genId(): string {
  return `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSessionEntry(
  s: FocusSession,
  sessionId: string,
  status: FocusSessionEntry['status'],
  actualFocusMinutes?: number,
  opts?: { outcome?: FocusSessionEntry['outcome']; flags?: FocusFlags; outcomeLabel?: string },
): FocusSessionEntry {
  const now = Date.now();
  const actualMin = s.elapsedFocusSeconds > 0
    ? Math.round(s.elapsedFocusSeconds / 60)
    : actualFocusMinutes ?? Math.round((s.durationMinutes * s.roundsCompleted * 60) / 60);
  const entry: FocusSessionEntry = {
    id: sessionId,
    date: toLocalDateString(),
    startTime: s.startedAt,
    endTime: now,
    actualFocusMinutes: actualMin,
    plannedFocusMinutes: s.durationMinutes,
    plannedRounds: s.rounds,
    roundsCompleted: s.roundsCompleted,
    interruptions: s.interruptions,
    status,
  };
  // Phase 2.1: enriched fields
  if (s.sessionId) entry.sessionId = s.sessionId;
  if (s.task) entry.task = s.task;
  if (opts?.outcome) entry.outcome = opts.outcome;
  if (opts?.flags) entry.flags = { ...opts.flags };
  if (s.pauseCount > 0) entry.pauseCount = s.pauseCount;
  if (s.linkedQuestId) entry.linkedQuestId = s.linkedQuestId;
  if (s.durationMinutes <= 8) entry.modeId = 'night';
  else if (s.durationMinutes <= 15) entry.modeId = 'espresso';
  else if (s.durationMinutes <= 30) entry.modeId = 'flow';
  else entry.modeId = 'deep_work';
  return entry;
}

function dispatchFocusEvent(type: FocusEventType) {
  const compatMap: Record<FocusEventType, string | null> = {
    session_created: 'session-start',
    started: 'session-start',
    paused: 'session-pause',
    resumed: 'session-resume',
    completed: 'session-complete',
    early_exit: 'session-interrupted',
    abandoned: 'session-interrupted',
  };
  const detail = { type };
  window.dispatchEvent(new CustomEvent('focus:event', { detail }));
  const compatType = compatMap[type];
  if (compatType) {
    window.dispatchEvent(new CustomEvent('focus:event', { detail: { type: compatType } }));
  }
}

/* ── Persisted settlement (localStorage, survives refresh) ── */
interface PersistedSettlement {
  sessionId: string;
  outcome: 'completed' | 'early_exit' | 'abandoned';
  ledgerEntryIds: string[];
  memoryEntryId?: string;
  sessionSnapshot: {
    task?: string;
    durationMinutes: number;
    roundsCompleted: number;
    rounds: number;
    pauseCount: number;
    flags: FocusFlags;
  };
  createdAt: string;
  dismissedAt?: string;
  selfReport?: string;
}

/* ── Settlement Marker — independent idempotency key ── */
interface FocusSettlementMarker {
  sessionId: string;
  outcome: 'completed' | 'early_exit' | 'abandoned';
  batchKey: string;
  ledgerEntryIds: string[];
  requestedTotal: number;
  appliedTotal: number;
  settledAt: string;
}

function readMarker(): FocusSettlementMarker | null {
  try {
    const raw = localStorage.getItem('focus_settlement_marker');
    if (!raw) return null;
    return JSON.parse(raw) as FocusSettlementMarker;
  } catch { return null; }
}

function writeMarker(marker: FocusSettlementMarker) {
  try {
    localStorage.setItem('focus_settlement_marker', JSON.stringify(marker));
  } catch {}
}

function clearMarker() {
  try { localStorage.removeItem('focus_settlement_marker'); } catch {}
}

function readPersistedSettlement(): PersistedSettlement | null {
  try {
    const raw = localStorage.getItem('focus_settlement');
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedSettlement;
    if (data.dismissedAt) return null;
    return data;
  } catch { return null; }
}

function writePersistedSettlement(data: PersistedSettlement) {
  try {
    localStorage.setItem('focus_settlement', JSON.stringify(data));
  } catch {}
}

/* ── Rebuild settlement from persisted data using actual ledger entries ── */
function rebuildSettlement(): FocusSettlementResult | null {
  const persisted = readPersistedSettlement();
  if (!persisted) return null;

  const store = useAppStore.getState();
  const ledger = store.moonDewLedger || [];

  if (persisted.ledgerEntryIds.length > 0) {
    const idSet = new Set(persisted.ledgerEntryIds);
    const entries = ledger.filter((e) => idSet.has(e.id));
    const total = entries.reduce((sum, e) => sum + e.amount, 0);

    // Phase 1.1.2: Marker consistency verification
    const marker = readMarker();
    if (marker && marker.sessionId === persisted.sessionId && total !== marker.appliedTotal) {
      if (import.meta.env.DEV) {
        console.warn(
          '[rebuildSettlement] marker.appliedTotal (%d) differs from ledger sum (%d). Using ledger sum.',
          marker.appliedTotal, total,
        );
      }
    }
    return {
      sessionId: persisted.sessionId,
      outcome: persisted.outcome,
      entries,
      total,
      timestamp: new Date(persisted.createdAt).getTime(),
      balanceAfter: store.getMoonDewBalance(),
      selfReport: persisted.selfReport,
      memorySaved: true,
      memoryEntryId: persisted.memoryEntryId,
    };
  }

  // ledgerEntryIds empty — rebuild from marker
  const marker = readMarker();
  if (!marker || marker.sessionId !== persisted.sessionId) {
    try { localStorage.removeItem('focus_settlement'); } catch {}
    return null;
  }

  return {
    sessionId: persisted.sessionId,
    outcome: persisted.outcome,
    entries: [],
    total: marker.appliedTotal,
    timestamp: new Date(persisted.createdAt).getTime(),
    balanceAfter: store.getMoonDewBalance(),
    selfReport: persisted.selfReport,
    memorySaved: true,
    memoryEntryId: persisted.memoryEntryId,
    requestedTotal: marker.requestedTotal,
  };
}

/* ── Fallback elapsed computation for old persisted sessions ── */
/** @internal exported for testing only */
export function computeFallbackElapsed(s: Partial<FocusSession>): number {
  const durationMin = (typeof s.durationMinutes === 'number' && s.durationMinutes > 0) ? s.durationMinutes : 25;
  const completedRounds = typeof s.roundsCompleted === 'number' ? Math.max(0, s.roundsCompleted) : 0;
  const remaining = typeof s.remainingSeconds === 'number' ? Math.max(0, s.remainingSeconds) : 0;
  const phase = s.phase || 'focus';

  if (phase === 'focus') {
    const currentRoundElapsed = Math.max(0, durationMin * 60 - remaining);
    const completedElapsed = completedRounds * durationMin * 60;
    const total = completedElapsed + currentRoundElapsed;
    const maxPossible = durationMin * 60 * Math.max(1, completedRounds + 1);
    if (import.meta.env.DEV && total > maxPossible) {
      console.warn('[focus-session merge] fallback elapsed (%d) exceeds max possible (%d)', total, maxPossible);
    }
    const clamped = Math.min(total, maxPossible);
    if (import.meta.env.DEV && clamped !== total) {
      console.warn('[focus-session merge] clamped elapsed from %d to %d', total, clamped);
    }
    return isNaN(clamped) || clamped < 0 ? 0 : clamped;
  }

  /* break phase — only completed rounds count */
  const completedElapsed = completedRounds * durationMin * 60;
  return isNaN(completedElapsed) || completedElapsed < 0 ? 0 : completedElapsed;
}

/* ── Atomic Settlement Snapshot ── */
export interface FinalFocusSnapshot {
  sessionId: string;
  task: string;
  modeId: string;
  plannedMinutes: number;
  elapsedFocusSeconds: number;
  actualMinutes: number;
  roundsCompleted: number;
  targetRounds: number;
  pauseCount: number;
  flags: FocusFlags;
  outcome: 'completed' | 'early_exit' | 'abandoned';
  finishedAt: string;
}

export const useFocusSessionStore = create<FocusSession & FocusSessionActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      startSession: (opts) => {
        const now = Date.now();
        const remaining = opts.durationMinutes * 60;
        const s = get();
        const fakePrep = s.durationChangeCount > 3 && s.status === 'idle';
        const safeRounds = Math.max(1, Number.isFinite(opts.rounds) ? opts.rounds : 1);
        set({
          sessionId: genId(),
          status: 'running',
          startedAt: now,
          durationMinutes: opts.durationMinutes,
          restMinutes: opts.restMinutes,
          rounds: safeRounds,
          currentRound: 1,
          phase: 'focus',
          endAt: now + remaining * 1000,
          remainingSeconds: remaining,
          elapsedFocusSeconds: 0,
          interruptions: 0,
          roundsCompleted: 0,
          pauseCount: 0,
          durationChangeCount: 0,
          task: opts.task,
          flags: { ...defaultFlags(), fakePreparation: fakePrep },
          selfReport: undefined,
          loopMode: opts.loopMode ?? false,
          sessionCategory: opts.category || 'focus',
          roomType: opts.roomType || 'computer',
          linkedQuestId: opts.linkedQuestId,
        });
        if ((opts.category || 'focus') === 'focus') useFocusCareerStore.getState().startTracking(get().sessionId!, now, opts.linkedQuestId);
        dispatchFocusEvent('started');
      },

      setTask: (task) => set({ task }),

      changeDuration: (minutes) => {
        const s = get();
        const count = s.durationChangeCount + 1;
        set({
          durationMinutes: minutes,
          durationChangeCount: count,
          flags: { ...s.flags, overAdjusting: count > 3 },
        });
      },

      pauseSession: () => {
        const s = get();
        if (s.status !== 'running') return;
        const remaining = Math.max(0, Math.round((s.endAt - Date.now()) / 1000));
        set({ status: 'paused', remainingSeconds: remaining, pauseCount: s.pauseCount + 1 });
        if (s.sessionId && s.phase === 'focus' && s.sessionCategory === 'focus') useFocusCareerStore.getState().pauseTracking(s.sessionId);
        dispatchFocusEvent('paused');
      },

      resumeSession: () => {
        const s = get();
        if (s.status !== 'paused') return;
        set({ status: 'running', endAt: Date.now() + s.remainingSeconds * 1000 });
        if (s.sessionId && s.phase === 'focus' && s.sessionCategory === 'focus') useFocusCareerStore.getState().resumeTracking(s.sessionId);
        dispatchFocusEvent('resumed');
      },

      endSession: () => {
        const s = get();
        if (s.status === 'idle') return;
        if (s.sessionCategory !== 'focus') {
          set({ ...initialState });
          return;
        }
        if (s.status !== 'completed') {
          const outcome: 'early_exit' | 'abandoned' = s.roundsCompleted > 0 ? 'early_exit' : 'abandoned';
          get().finalizeFocusSession(outcome);
        } else {
          set({ ...initialState });
        }
      },

      completeSession: (selfReport) => {
        const s = get();
        if (s.status === 'idle') return;
        if (s.sessionCategory !== 'focus') {
          set({ ...initialState });
          return;
        }
        if (selfReport) set({ selfReport });
        get().finalizeFocusSession('completed');
      },

      interruptSession: () => {
        get().endSession();
      },

      resetSession: () => {
        set({ ...initialState });
      },

      finalizeFocusSession: (outcome) => {
        const s = get();
        if (s.status === 'idle' || !s.sessionId) return;
        if (s.sessionCategory !== 'focus') {
          set({ ...initialState });
          return;
        }
        const store = useAppStore.getState();
        const batchKey = `focus:${s.sessionId}:settlement`;

        /* ── Atomic snapshot — captured before any side effects ── */
        const snapshot: FinalFocusSnapshot = {
          sessionId: s.sessionId,
          task: s.task || '',
          modeId: s.durationMinutes <= 8 ? 'night' : s.durationMinutes <= 15 ? 'espresso' : s.durationMinutes <= 30 ? 'flow' : 'deep_work',
          plannedMinutes: s.durationMinutes,
          elapsedFocusSeconds: s.elapsedFocusSeconds,
          actualMinutes: s.elapsedFocusSeconds > 0 ? Math.round(s.elapsedFocusSeconds / 60) : 0,
          roundsCompleted: s.roundsCompleted,
          targetRounds: s.rounds,
          pauseCount: s.pauseCount,
          flags: { ...s.flags },
          outcome,
          finishedAt: new Date().toISOString(),
        };

        // Phase 1.1.1: Check independent settlement marker first
        const existingMarker = readMarker();
        if (existingMarker && existingMarker.sessionId === s.sessionId) {
          // Already settled — rebuild result from existing data
          const existingEntries = (store.moonDewLedger || []).filter(
            (e) => e.relatedEntityId === s.sessionId || e.idempotencyKey.startsWith(`${batchKey}:`),
          );
          const result: FocusSettlementResult = {
            sessionId: s.sessionId,
            outcome: existingMarker.outcome,
            entries: existingEntries,
            total: existingMarker.appliedTotal,
            timestamp: Date.now(),
            balanceAfter: store.getMoonDewBalance(),
            selfReport: s.selfReport,
            requestedTotal: existingMarker.requestedTotal,
          };
          set({ ...initialState, lastSettlement: result });
          return;
        }

        /* ── Phase 1.1A: Skip sub-threshold voyages — no log, no settlement, no career ── */
        if (snapshot.elapsedFocusSeconds < MINIMUM_VALID_FOCUS_SECONDS) {
          set({ ...initialState });
          return;
        }

        // Career settlement is downstream of the authoritative Session lifecycle and
        // runs only after the existing persisted settlement guard has cleared.
        useFocusCareerStore.getState().settleSession(s.sessionId, outcome, Date.now());

        const isComplete = outcome === 'completed';
        const eventType: FocusEventType = isComplete ? 'completed' : outcome;
        const flags = isComplete
          ? { ...snapshot.flags, goodRecovery: snapshot.pauseCount > 0 && snapshot.roundsCompleted > 0, honestCompletion: !!s.selfReport }
          : { ...snapshot.flags, earlyEscape: true };

        const actualMinutes = snapshot.actualMinutes;

        if (!isComplete && actualMinutes > 0) {
          store.addFocusTime(actualMinutes);
          store.addActivityLog({
            type: 'system', title: `創作中止：${actualMinutes} 分鐘`, detail: '', level: 'warning', route: '/',
          });
        }

        const sessionOutcome: FocusSessionEntry['outcome'] = isComplete
          ? 'kept'
          : outcome === 'early_exit' || outcome === 'abandoned'
            ? 'caught'
            : 'recorded';

        const entry = buildSessionEntry(
          { ...s, elapsedFocusSeconds: snapshot.elapsedFocusSeconds, interruptions: isComplete ? s.interruptions : s.interruptions + 1, flags },
          snapshot.sessionId,
          isComplete ? 'completed' : 'interrupted',
          actualMinutes,
          { outcome: sessionOutcome, flags },
        );
        store.addFocusSessionEntry(entry);
        if (isComplete && s.linkedQuestId) {
          useQuestStore.getState().linkFocusSession(s.linkedQuestId, entry.id, entry.actualFocusMinutes);
        }

        // Phase 1.1.1: Memory idempotency — check for existing focus memory for this session
        const memoryEntryId = writeMemoryEntry(entry, eventType, flags, s.pauseCount, s.durationChangeCount, s.task, s.sessionId);

        // Compute today's earned/lost from focus-source entries only (Phase 1.1.2)
        const todayEarned = todayEarnedBySource(store.moonDewLedger || [], CAP_RULES.earnCapSources);
        const todayLost = todayLostBySource(store.moonDewLedger || [], CAP_RULES.lossCapSources);

        // Phase 1.1.1: Compute requested total from raw settlement (pre-cap)
        const rawSettlement = settleFocusSession({
          sessionId: s.sessionId,
          status: outcome,
          actualFocusMinutes: entry.actualFocusMinutes,
          flags,
          currentBalance: store.getMoonDewBalance(),
          todayEarned,
          todayLost,
        });
        const requestedTotal = rawSettlement.metadata.requestedAmount as number;

        // The one true settlement
        store.settleFocusForMoonDew({
          sessionId: s.sessionId,
          status: outcome,
          actualFocusMinutes: entry.actualFocusMinutes,
          flags,
        });

        // Re-read store state after settlement
        const postStore = useAppStore.getState();
        const postLedger = postStore.moonDewLedger || [];

        // Phase 1.1.1: Filter entries by session ID exclusively
        const settlementEntries = postLedger.filter(
          (e) => e.relatedEntityId === s.sessionId || e.idempotencyKey.startsWith(`${batchKey}:`),
        );

        const actualTotal = settlementEntries.reduce((sum, e) => sum + e.amount, 0);
        const balanceAfter = postStore.getMoonDewBalance();

        dispatchFocusEvent(eventType);

        // Write settlement marker (always — even when appliedTotal === 0)
        const marker: FocusSettlementMarker = {
          sessionId: s.sessionId,
          outcome,
          batchKey,
          ledgerEntryIds: settlementEntries.map((e) => e.id),
          requestedTotal,
          appliedTotal: actualTotal,
          settledAt: new Date().toISOString(),
        };
        writeMarker(marker);

        const result: FocusSettlementResult = {
          sessionId: s.sessionId,
          outcome,
          entries: settlementEntries,
          total: actualTotal,
          timestamp: Date.now(),
          balanceAfter,
          selfReport: s.selfReport,
          memoryEntryId,
          memorySaved: !!memoryEntryId,
          requestedTotal,
        };

        set({
          ...initialState,
          lastSettlement: result,
        });
        useTideRailStore.getState().recordSessionClosure({ sessionId: result.sessionId, outcome: result.outcome, sessionTask: s.task });

        // Persist for crash recovery
        writePersistedSettlement({
          sessionId: s.sessionId,
          outcome,
          ledgerEntryIds: settlementEntries.map((e) => e.id),
          memoryEntryId,
          sessionSnapshot: {
            task: s.task,
            durationMinutes: s.durationMinutes,
            roundsCompleted: s.roundsCompleted,
            rounds: s.rounds,
            pauseCount: s.pauseCount,
            flags,
          },
          createdAt: new Date().toISOString(),
          selfReport: s.selfReport,
        });
      },

      clearLastSettlement: () => {
        set({ lastSettlement: null });
      },

      dismissSettlement: () => {
        try {
          const raw = localStorage.getItem('focus_settlement');
          if (raw) {
            const data = JSON.parse(raw) as PersistedSettlement;
            data.dismissedAt = new Date().toISOString();
            localStorage.setItem('focus_settlement', JSON.stringify(data));
          }
        } catch {
          try { localStorage.removeItem('focus_settlement'); } catch {}
        }
        set({ lastSettlement: null });
      },

      saveSelfReport: (report: string) => {
        const s = get();
        const settlement = s.lastSettlement;
        if (!settlement) return;

        const store = useAppStore.getState();
        const witness = useFocusWitnessStore.getState();
        const sessionSnapshot = readPersistedSettlement()?.sessionSnapshot;

        if (witness.witnessEnabled) {
          const isCompleted = report === 'completed';

          // Phase 1.1.1: Find existing focus memory and update it with self-report
          const existingFocusMemory = settlement.memoryEntryId
            ? (store.memoryEntries || []).find((m) => m.id === settlement.memoryEntryId)
            : undefined;

          const selfReportContent = [
            sessionSnapshot?.task ? `任務: ${sessionSnapshot.task}` : null,
            `計劃時長: ${sessionSnapshot?.durationMinutes || 25} 分鐘`,
            `暫停次數: ${sessionSnapshot?.pauseCount || 0}`,
            `自報結果: ${isCompleted ? '有完成' : report === 'partial' ? '只完成一部分' : '沒有'}`,
            `結算結果: ${settlement.outcome}`,
            `月印變動: ${settlement.total > 0 ? '+' : ''}${settlement.total}`,
          ].filter(Boolean).join('\n');

          if (existingFocusMemory) {
            // Update existing — append self-report to bodyThoughts
            const currentBody = existingFocusMemory.bodyThoughts || '';
            const updatedBody = currentBody.includes('自報結果')
              ? currentBody
              : currentBody + '\n\n--- 自報 ---\n' + selfReportContent;
            store.updateMemoryEntry(existingFocusMemory.id, {
              bodyThoughts: updatedBody,
              tags: [...(existingFocusMemory.tags || []).filter((t) => t !== 'honestCompletion'), report, isCompleted ? 'honestCompletion' : null].filter(Boolean),
              updatedAt: Date.now(),
            } as any);
          } else {
            // Fallback: create new memory entry
            store.addMemoryEntry({
              scene: `TIDEBOUND · 自報 · ${settlement.outcome === 'completed' ? '完成' : '中斷'} · ${sessionSnapshot?.durationMinutes || 25}min`,
              triggerText: '',
              anxietyLevel: 0,
              nextStep: '',
              bodyThoughts: selfReportContent,
              title: `TIDEBOUND · 自報${
                isCompleted ? '完成' : report === 'partial' ? '部分' : '未完成'
              }`,
              content: `自報${isCompleted ? '已' : '未'}完成本輪任務`,
              owner: 'shared',
              createdBy: 'system',
              source: 'focus',
              type: 'focus-session',
              allowAiRecall: witness.allowRecall,
              localOnly: true,
              sensitive: false,
              status: 'active',
              tags: [report, isCompleted ? 'honestCompletion' : null].filter(Boolean),
              metadata: {
                sessionId: settlement.sessionId,
                selfReport: report,
                settlementOutcome: settlement.outcome,
                moonDewTotal: settlement.total,
              },
            } as any);
          }
        }

        // Update persisted settlement
        try {
          const raw = localStorage.getItem('focus_settlement');
          if (raw) {
            const data = JSON.parse(raw) as PersistedSettlement;
            data.selfReport = report;
            localStorage.setItem('focus_settlement', JSON.stringify(data));
          }
        } catch {}

        // Update in-memory settlement
        set({
          lastSettlement: {
            ...settlement,
            selfReport: report,
            memorySaved: true,
          },
        });
      },

      recoverSettlement: () => {
        const s = get();
        if (s.lastSettlement || s.status !== 'idle') return;
        const rebuilt = rebuildSettlement();
        if (rebuilt) {
          set({ lastSettlement: rebuilt });
        }
      },

      tick: () => {
        const s = get();
        if (s.status !== 'running') return;
        if (s.sessionId && s.phase === 'focus' && s.sessionCategory === 'focus') useFocusCareerStore.getState().checkpoint(s.sessionId);
        const remaining = Math.max(0, Math.round((s.endAt - Date.now()) / 1000));
        const delta = s.remainingSeconds - remaining;
        if (remaining !== s.remainingSeconds) {
          const nextElapsed = delta > 0 && s.phase === 'focus' && s.sessionCategory === 'focus'
            ? s.elapsedFocusSeconds + delta
            : s.elapsedFocusSeconds;
          set({ remainingSeconds: remaining, elapsedFocusSeconds: nextElapsed });
        }
        if (remaining <= 0 && s.remainingSeconds > 0) {
          get().transitionPhase();
        }
      },

      transitionPhase: () => {
        const s = get();
        if (s.sessionCategory !== 'focus') {
          set({ ...initialState });
          return;
        }
        const store = useAppStore.getState();
        if (s.phase === 'focus') {
          if (s.sessionId) useFocusCareerStore.getState().pauseTracking(s.sessionId);
          const fullMinutes = s.durationMinutes;
          store.addFocusTime(fullMinutes);
          store.incrementCompletedRounds();
          store.addActivityLog({
            type: 'system', title: `創作完成：${fullMinutes} 分鐘`,
            detail: `第 ${store.focusSessions} 輪`, level: 'success', route: '/',
          });
          store.addTimelineEvent({
            type: 'focus', sourceType: 'focus', sourceId: `round-${Date.now()}`,
            date: toLocalDateString(), icon: '🎯', label: '創作完成',
            detail: `${fullMinutes} 分鐘 · 第 ${store.focusSessions} 輪`,
            subDetail: s.rounds > 1 ? `第 ${s.currentRound}/${s.rounds} 輪` : undefined,
            color: 'var(--coral)', route: '/',
          });
          const remaining = s.restMinutes * 60;
          dispatchFocusEvent('completed');
          set({
            phase: 'break', currentRound: s.currentRound,
            roundsCompleted: s.roundsCompleted + 1,
            remainingSeconds: remaining, endAt: Date.now() + remaining * 1000,
          });
        } else {
          const nextRound = s.currentRound + 1;
          if (!s.loopMode && nextRound > s.rounds) {
            get().finalizeFocusSession('completed');
          } else {
            const remaining = s.durationMinutes * 60;
            set({
              phase: 'focus', currentRound: nextRound,
              remainingSeconds: remaining, endAt: Date.now() + remaining * 1000,
            });
            if (s.sessionId) useFocusCareerStore.getState().resumeTracking(s.sessionId);
          }
        }
      },
    }),
    {
      name: 'focus-session',
      partialize: (state) => ({
        sessionId: state.sessionId,
        status: state.status,
        startedAt: state.startedAt,
        durationMinutes: state.durationMinutes,
        restMinutes: state.restMinutes,
        rounds: state.rounds,
        currentRound: state.currentRound,
        phase: state.phase,
        endAt: state.endAt,
        remainingSeconds: state.remainingSeconds,
        interruptions: state.interruptions,
        roundsCompleted: state.roundsCompleted,
        pauseCount: state.pauseCount,
        durationChangeCount: state.durationChangeCount,
        task: state.task,
        flags: state.flags,
        selfReport: state.selfReport,
        loopMode: state.loopMode,
        sessionCategory: state.sessionCategory,
        roomType: state.roomType,
        linkedQuestId: state.linkedQuestId,
        elapsedFocusSeconds: state.elapsedFocusSeconds,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<FocusSession>) };
        if (!merged.sessionId) {
          merged.sessionId = null;
        }
        // Defensive fallback for old persisted sessions without elapsedFocusSeconds
        if (merged.elapsedFocusSeconds == null || typeof merged.elapsedFocusSeconds !== 'number') {
          merged.elapsedFocusSeconds = computeFallbackElapsed(merged);
        }
        return merged;
      },
    },
  ),
);
