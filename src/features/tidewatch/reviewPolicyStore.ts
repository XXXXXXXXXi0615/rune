import { create } from 'zustand';
import { decideReview, selectAdaptiveDifficultyExplanation, validateReasonQuality, type ReviewReasonInput } from './reviewGate';
import { toLocalDateString } from '@/utils/date';
import { loadAllConsequences, loadAllReviewRecords, loadConsequencePreferences, loadReviewPreferences, saveConsequence, saveConsequencePreferences, saveReviewPreferences, saveReviewRecord } from './repository';
import { cryptoConsequenceRng, resolveConsequenceLifecycle, resolveConsequenceSelection, validateConsequenceSafety } from './consequenceEngine';
import type { ConsequencePoolItem, ReviewRecord, ReviewRequestType, TidewatchConsequence, TidewatchConsequencePreferences, TidewatchReviewPreferences } from './types';

const DEFAULT_PREFERENCES: TidewatchReviewPreferences = { baseDifficulty: 2, difficultyMode: 'fixed', tone: 'restrained' };
const DEFAULT_CONSEQUENCE_PREFERENCES: TidewatchConsequencePreferences = { intensity: 3, pool: [
  { id: 'tidy-desk', title: '整理桌面 10 分鐘', enabled: true, intensity: 1, executionType: 'manual', weight: 2, createdAt: 1, updatedAt: 1 },
  { id: 'review-note', title: '寫下這次失敗的復盤', enabled: true, intensity: 2, executionType: 'manual', weight: 2, createdAt: 1, updatedAt: 1 },
  { id: 'focus-recovery', title: '專注補做 20 分鐘', enabled: true, intensity: 3, executionType: 'timer', durationMinutes: 20, weight: 1, createdAt: 1, updatedAt: 1 },
] };

interface SubmitReviewInput extends ReviewReasonInput { questId: string; questTitle: string; requestType: ReviewRequestType; now?: number }
interface OverrideInput { questId: string; questTitle: string; reason: ReviewRecord['overrideReason']; now?: number }

interface TidewatchPolicyState {
  preferences: TidewatchReviewPreferences;
  consequencePreferences: TidewatchConsequencePreferences;
  reviews: ReviewRecord[];
  consequences: TidewatchConsequence[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreferences: (patch: Partial<TidewatchReviewPreferences>) => Promise<void>;
  useBaseDifficultyToday: (now?: Date) => Promise<void>;
  setConsequenceIntensity: (intensity: number) => Promise<void>;
  upsertConsequencePoolItem: (item: Omit<ConsequencePoolItem, 'createdAt' | 'updatedAt'> & Partial<Pick<ConsequencePoolItem, 'createdAt' | 'updatedAt'>>) => Promise<{ ok: boolean; reason?: string }>;
  deleteConsequencePoolItem: (id: string) => Promise<void>;
  submitReview: (input: SubmitReviewInput) => Promise<ReviewRecord>;
  acceptConditions: (reviewId: string, now?: number) => Promise<ReviewRecord | undefined>;
  ensureConsequence: (sourceEventId: string, questId: string, questTitle: string, now?: number) => Promise<TidewatchConsequence>;
  resolveConsequence: (id: string, rng?: () => number, now?: number) => Promise<TidewatchConsequence | undefined>;
  activateConsequence: (id: string, now?: number, timerSessionId?: string) => Promise<TidewatchConsequence | undefined>;
  fulfillConsequence: (id: string, now?: number) => Promise<TidewatchConsequence | undefined>;
  setConsequenceFeedback: (id: string, perceivedIntensity: NonNullable<TidewatchConsequence['perceivedIntensity']>) => Promise<TidewatchConsequence | undefined>;
  safetyOverride: (input: OverrideInput) => Promise<ReviewRecord>;
}

let hydratePromise: Promise<void> | null = null;

export const useTidewatchPolicyStore = create<TidewatchPolicyState>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  consequencePreferences: DEFAULT_CONSEQUENCE_PREFERENCES,
  reviews: [],
  consequences: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    if (hydratePromise) return hydratePromise;
    hydratePromise = Promise.all([loadReviewPreferences(), loadConsequencePreferences(), loadAllReviewRecords(), loadAllConsequences()]).then(([preferences, consequencePreferences, reviews, consequences]) => set({ preferences: preferences || DEFAULT_PREFERENCES, consequencePreferences: consequencePreferences || DEFAULT_CONSEQUENCE_PREFERENCES, reviews: reviews.sort((a, b) => b.createdAt - a.createdAt), consequences, hydrated: true })).finally(() => { hydratePromise = null; });
    return hydratePromise;
  },
  setPreferences: async (patch) => {
    if (!get().hydrated) await get().hydrate();
    const next = { ...get().preferences, ...patch, baseDifficulty: Math.max(1, Math.min(5, Math.round(patch.baseDifficulty ?? get().preferences.baseDifficulty))) };
    set({ preferences: next }); await saveReviewPreferences(next);
  },
  useBaseDifficultyToday: async (now = new Date()) => { if (!get().hydrated) await get().hydrate(); const date = toLocalDateString(now); const next = { ...get().preferences, useBaseDifficultyByDate: { ...get().preferences.useBaseDifficultyByDate, [date]: true as const } }; set({ preferences: next }); await saveReviewPreferences(next); },
  setConsequenceIntensity: async (intensity) => {
    if (!get().hydrated) await get().hydrate();
    const next = { ...get().consequencePreferences, intensity: Math.max(1, Math.min(5, Math.round(intensity))) };
    set({ consequencePreferences: next }); await saveConsequencePreferences(next);
  },
  upsertConsequencePoolItem: async (input) => {
    if (!get().hydrated) await get().hydrate();
    const safety = validateConsequenceSafety(input.title); if (!safety.safe) return { ok: false, reason: safety.reason };
    const now = Date.now(); const current = get().consequencePreferences; const existing = current.pool.find((item) => item.id === input.id);
    const item: ConsequencePoolItem = { ...input, title: input.title.trim(), intensity: Math.max(1, Math.min(5, Math.round(input.intensity))), durationMinutes: input.executionType === 'timer' ? Math.max(1, Math.round(input.durationMinutes ?? 20)) : undefined, weight: Math.max(0, input.weight ?? 1), createdAt: existing?.createdAt ?? input.createdAt ?? now, updatedAt: now };
    const next = { ...current, pool: existing ? current.pool.map((entry) => entry.id === item.id ? item : entry) : [...current.pool, item] };
    set({ consequencePreferences: next }); await saveConsequencePreferences(next); return { ok: true };
  },
  deleteConsequencePoolItem: async (id) => { if (!get().hydrated) await get().hydrate(); const next = { ...get().consequencePreferences, pool: get().consequencePreferences.pool.filter((item) => item.id !== id) }; set({ consequencePreferences: next }); await saveConsequencePreferences(next); },
  submitReview: async (input) => {
    if (!get().hydrated) await get().hydrate();
    const now = input.now ?? Date.now(); const state = get();
    const baseDifficulty = state.preferences.baseDifficultyByType?.[input.requestType] ?? state.preferences.baseDifficulty;
    const date = new Date(now); const overridden = Boolean(state.preferences.useBaseDifficultyByDate?.[toLocalDateString(date)]);
    const difficulty = selectAdaptiveDifficultyExplanation(baseDifficulty, state.preferences.difficultyMode === 'adaptive', state.reviews, date, overridden).todayDerivedDifficulty;
    const validation = validateReasonQuality(input, difficulty, state.reviews.slice(0, 5).map((item) => item.reasonSnapshot));
    const record: ReviewRecord = { id: crypto.randomUUID(), questId: input.questId, questTitleSnapshot: input.questTitle, requestType: input.requestType, reasonSnapshot: validation.normalizedReason, recoveryPlanSnapshot: input.recoveryPlan ? input.recoveryPlan.trim() : undefined, nextActionSnapshot: input.nextAction ? input.nextAction.trim() : undefined, resumeAtSnapshot: input.resumeAt || undefined, difficultySnapshot: difficulty, decision: decideReview(input.requestType, validation), createdAt: now };
    await saveReviewRecord(record); set((current) => ({ reviews: [record, ...current.reviews] })); return record;
  },
  acceptConditions: async (reviewId, now = Date.now()) => {
    if (!get().hydrated) await get().hydrate();
    const record = get().reviews.find((item) => item.id === reviewId); if (!record || record.decision.decision !== 'conditional') return undefined;
    const accepted = { ...record, conditionsAcceptedAt: now }; await saveReviewRecord(accepted); set((state) => ({ reviews: state.reviews.map((item) => item.id === reviewId ? accepted : item) })); return accepted;
  },
  ensureConsequence: async (sourceEventId, questId, questTitle, now = Date.now()) => {
    if (!get().hydrated) await get().hydrate();
    const existing = get().consequences.find((item) => item.sourceEventId === sourceEventId); if (existing) return existing;
    const consequence: TidewatchConsequence = { id: crypto.randomUUID(), sourceEventId, questId, questTitleSnapshot: questTitle, lifecycle: 'pending', createdAt: now, updatedAt: now };
    try { await saveConsequence(consequence); } catch { const reloaded = (await loadAllConsequences()).find((item) => item.sourceEventId === sourceEventId); if (reloaded) return reloaded; throw new Error('無法建立後果紀錄'); }
    set((state) => ({ consequences: [...state.consequences, consequence] })); return consequence;
  },
  resolveConsequence: async (id, rng = cryptoConsequenceRng, now = Date.now()) => {
    if (!get().hydrated) await get().hydrate(); const record = get().consequences.find((item) => item.id === id); if (!record) return undefined;
    const prefs = get().consequencePreferences; const resolved = resolveConsequenceSelection(record, prefs.pool, prefs.intensity, rng, now); if (resolved === record) return record;
    await saveConsequence(resolved); set((state) => ({ consequences: state.consequences.map((item) => item.id === id ? resolved : item) })); return resolved;
  },
  activateConsequence: async (id, now = Date.now(), timerSessionId) => { const record = get().consequences.find((item) => item.id === id); if (!record || !['revealed', 'active'].includes(record.lifecycle)) return record; if (record.lifecycle === 'active' && (!timerSessionId || record.timerSessionId)) return record; const active = { ...resolveConsequenceLifecycle(record, 'active'), executionStartedAt: record.executionStartedAt ?? now, timerSessionId: record.timerSessionId ?? timerSessionId, updatedAt: now }; await saveConsequence(active); set((state) => ({ consequences: state.consequences.map((item) => item.id === id ? active : item) })); return active; },
  fulfillConsequence: async (id, now = Date.now()) => { const record = get().consequences.find((item) => item.id === id); if (!record || record.lifecycle !== 'active') return record; const fulfilled = { ...resolveConsequenceLifecycle(record, 'fulfilled'), fulfilledAt: now, updatedAt: now }; await saveConsequence(fulfilled); set((state) => ({ consequences: state.consequences.map((item) => item.id === id ? fulfilled : item) })); return fulfilled; },
  setConsequenceFeedback: async (id, perceivedIntensity) => { const record = get().consequences.find((item) => item.id === id); if (!record || record.lifecycle !== 'fulfilled') return record; const updated = { ...record, perceivedIntensity, updatedAt: Date.now() }; await saveConsequence(updated); set((state) => ({ consequences: state.consequences.map((item) => item.id === id ? updated : item) })); return updated; },
  safetyOverride: async (input) => {
    if (!get().hydrated) await get().hydrate();
    const now = input.now ?? Date.now(); const record: ReviewRecord = { id: crypto.randomUUID(), questId: input.questId, questTitleSnapshot: input.questTitle, requestType: 'pause', reasonSnapshot: '規則例外', difficultySnapshot: 1, decision: { decision: 'approved', reasonCode: 'safety_override', message: '規則例外已記錄。' }, overrideReason: input.reason, createdAt: now };
    const updatedConsequences = get().consequences.map((item) => item.questId === input.questId && item.lifecycle !== 'fulfilled' ? { ...item, lifecycle: 'fulfilled' as const, safetyOverride: input.reason, updatedAt: now } : item);
    await Promise.all([saveReviewRecord(record), ...updatedConsequences.filter((item) => item.questId === input.questId).map(saveConsequence)]); set((state) => ({ reviews: [record, ...state.reviews], consequences: updatedConsequences }));
    return record;
  },
}));
