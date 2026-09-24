import type { UsageSession } from '@/types/usage';
import { toLocalDateString } from '@/utils/date';

export function makeId(): string {
  return crypto.randomUUID();
}

/**
 * Splits a session across a local-midnight boundary.
 *
 * Same-day sessions pass through unchanged (with endedAt set).
 * Cross-day sessions are split into two parts at the midnight
 * of the end date, each with its own id/dateKey.
 *
 * Pure function — no Date.now(), fully testable.
 */
export function splitSessionAcrossMidnight(
  sessions: UsageSession[],
  session: UsageSession,
  startMs: number,
  endMs: number,
): UsageSession[] {
  const startDate = toLocalDateString(new Date(startMs));
  const endDate = toLocalDateString(new Date(endMs));
  if (startDate === endDate) {
    return [...sessions, { ...session, endedAt: endMs }];
  }
  // Split at midnight of end date
  const midnightEnd = new Date(endDate);
  midnightEnd.setHours(0, 0, 0, 0);
  const midnightTs = midnightEnd.getTime();
  const firstPart: UsageSession = { ...session, id: makeId(), endedAt: midnightTs, dateKey: startDate };
  const secondPart: UsageSession = {
    ...session,
    id: makeId(),
    startedAt: midnightTs,
    endedAt: endMs,
    dateKey: endDate,
  };
  return [...sessions, firstPart, secondPart];
}