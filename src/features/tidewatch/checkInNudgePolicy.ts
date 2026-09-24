import type { CheckIn } from './types';

export const CHECKIN_NUDGE_SNOOZE_KEY = 'checkin-reminder';
export const CHECKIN_NUDGE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export const checkInSuppressionKey = (now: Date) => `checkin-reminder:day:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

export function shouldShowCheckInNudge(input: { latest: CheckIn | null; snoozedUntil: Record<string, number>; overlayBlocked: boolean; now: number; thresholdMs?: number }) {
  const { latest, snoozedUntil, overlayBlocked, now, thresholdMs = CHECKIN_NUDGE_THRESHOLD_MS } = input;
  if (overlayBlocked || !latest || now - latest.createdAt < thresholdMs) return false;
  if ((snoozedUntil[CHECKIN_NUDGE_SNOOZE_KEY] ?? 0) > now) return false;
  if ((snoozedUntil[checkInSuppressionKey(new Date(now))] ?? 0) > now) return false;
  return true;
}

export function minutesUntilTomorrow(now: Date) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.ceil((tomorrow.getTime() - now.getTime()) / 60_000));
}
