/**
 * Focus Runtime Selectors — Phase 1.1A
 *
 * All selectors return stable references (via snapshot copies) to avoid
 * unintended re-renders. No new derived persist keys are created.
 */
import type { FocusSessionEntry } from '@/types';
import { MINIMUM_VALID_FOCUS_SECONDS } from '@/features/focus/focusRuntimeConstants';
import { toLocalDateString } from '@/utils/date';
import type { DisciplineAlert } from '@/store/useDisciplineAlertStore';
import type { BladderIncident } from '@/store/useToiletRiskStore';

/** Stable: valid completed voyages (≥ MINIMUM_VALID_FOCUS_SECONDS active focus seconds). */
export function selectValidCompletedVoyages(logs: FocusSessionEntry[]): FocusSessionEntry[] {
  return logs.filter(
    (entry) => entry.status === 'completed' && entry.actualFocusMinutes > 0 && entry.actualFocusMinutes * 60 >= MINIMUM_VALID_FOCUS_SECONDS,
  );
}

/** Today's total valid focus seconds from valid voyages only (completed AND ≥ threshold). */
export function selectTodayValidFocusSeconds(logs: FocusSessionEntry[]): number {
  const today = toLocalDateString();
  return selectValidCompletedVoyages(logs)
    .filter((entry) => entry.date === today)
    .reduce((sum, entry) => sum + Math.max(0, Math.round(entry.actualFocusMinutes * 60)), 0);
}

/** Count of valid completed voyages. */
export function selectCompletedVoyageCount(logs: FocusSessionEntry[]): number {
  return selectValidCompletedVoyages(logs).length;
}

/** Returns the single active bladder incident, or null. */
export function selectActiveBladderIncident(incidents: BladderIncident[]): BladderIncident | null {
  return incidents.find((inc) => inc.status === 'active') ?? null;
}

/** Returns all unhandled (not acknowledged and not resolved) alerts. */
export function selectUnhandledAlerts(alerts: DisciplineAlert[]): DisciplineAlert[] {
  return alerts.filter((a) => !a.acknowledgedAt && !a.resolvedAt);
}

/** Returns the highest current severity among unhandled alerts. */
export function selectHighestAlertSeverity(alerts: DisciplineAlert[]): 'none' | 'info' | 'attention' | 'urgent' {
  const unhandled = selectUnhandledAlerts(alerts);
  if (unhandled.some((a) => a.severity === 'urgent')) return 'urgent';
  if (unhandled.some((a) => a.severity === 'attention')) return 'attention';
  if (unhandled.some((a) => a.severity === 'info')) return 'info';
  return 'none';
}
