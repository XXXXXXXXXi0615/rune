/**
 * Canonical check-in streak — Phase A ownership closure.
 *
 * The single active check-in owner is `useCheckInStore` (`lunartide-check-in` v1).
 * This module is a ONE-WAY derived adapter: it reads the canonical store and hands
 * the streak value to Moon Dew presentation. It never writes back, never mirrors
 * streak state, and must not be used to build a second streak source.
 *
 * Legacy `useAppStore.tideCheckIn.currentStreak` is fenced (no active reader) — see
 * `docs/reports/life-utility-phase-a-ownership-closure.md`.
 */
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { calculatePerfectStreak } from '@/features/tideclock/tideclockEngine';
import type { CheckInRecord } from '@/features/tideclock/types';

/** Pure selector: canonical perfect streak derived from the check-in records. */
export function selectCanonicalCheckInStreak(records: CheckInRecord[], now: Date = new Date()): number {
  return calculatePerfectStreak(records, now);
}

/** React binding for Moon Dew presentation surfaces. */
export function useCanonicalCheckInStreak(): number {
  return useCheckInStore((state) => selectCanonicalCheckInStreak(state.records));
}
