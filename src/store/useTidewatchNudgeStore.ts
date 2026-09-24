import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * TIDEWATCH reminder acknowledgement / snooze state (Phase 0 ownership closure).
 *
 * This is NOT a task store. TIDEQUEST (`useQuestStore`) remains the single
 * canonical task owner. This store only records per-quest snooze windows so a
 * nudge can be acknowledged without mutating quest data.
 *
 * Phase 1A (TIDEWATCH) will replace/extend the policy; this remains the only
 * snooze persistence seam.
 */
interface TidewatchNudgeState {
  /** questId → epoch ms until which the reminder is silenced */
  snoozedUntil: Record<string, number>;
  snooze: (questId: string, minutes: number) => void;
  clearSnooze: (questId: string) => void;
}

export const useTidewatchNudgeStore = create<TidewatchNudgeState>()(persist((set) => ({
  snoozedUntil: {},
  snooze: (questId, minutes) => set((state) => ({
    snoozedUntil: { ...state.snoozedUntil, [questId]: Date.now() + Math.max(1, minutes) * 60000 },
  })),
  clearSnooze: (questId) => set((state) => ({
    snoozedUntil: Object.fromEntries(Object.entries(state.snoozedUntil).filter(([id]) => id !== questId)),
  })),
}), {
  name: 'lunartide-tidewatch-nudge-v1',
  version: 1,
}));
