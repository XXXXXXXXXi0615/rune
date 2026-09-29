import type { LocalDateKey } from '@/utils/date';

export const DAILY_CHECKIN_COMPLETED = 'daily-checkin:completed' as const;
export type DailyCheckInCompleted = { date: LocalDateKey };
type Listener = (event: DailyCheckInCompleted) => void;
const listeners = new Set<Listener>();

export function subscribeDailyCheckInCompleted(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitDailyCheckInCompleted(event: DailyCheckInCompleted): void {
  for (const listener of [...listeners]) {
    try { listener(event); } catch { /* presentation listeners cannot fail a check-in */ }
  }
}
