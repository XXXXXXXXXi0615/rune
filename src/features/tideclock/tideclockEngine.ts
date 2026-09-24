import { toLocalDateString } from '@/utils/date';
import type {
  CheckInRecord,
  CheckInStatus,
  CheckInKind,
  CheckInPolicy,
  CheckInReport,
  ConsequenceLevel,
  MilestoneReward,
} from './types';
import { MILESTONES, DEFAULT_POLICY, makeTicketNumber } from './types';

const CHECKIN_MOON_DEW_BASE = 1;
const CHECKIN_MOON_DEW_STREAK_BONUS_3 = 1;
const CHECKIN_MOON_DEW_STREAK_BONUS_7 = 2;

export function getLocalNow(): Date {
  return new Date();
}

export function isWithinGrace(deadline: string, graceMinutes: number, now: Date = getLocalNow()): boolean {
  const today = toLocalDateString(now);
  const deadlineMs = new Date(`${today}T${deadline}:00`).getTime();
  return now.getTime() <= deadlineMs + graceMinutes * 60_000;
}

export function isLate(deadline: string, graceMinutes: number, now: Date = getLocalNow()): boolean {
  return !isWithinGrace(deadline, graceMinutes, now);
}

export function computeCheckInStatus(
  records: CheckInRecord[],
  policy: CheckInPolicy,
  now: Date = getLocalNow(),
): CheckInStatus {
  const today = toLocalDateString(now);
  const todayRecord = records.find((r) => r.date === today && r.kind === 'clock_in');
  if (!todayRecord) {
    if (policy.mode === 'strict') {
      const deadlineMs = new Date(`${today}T${policy.clockInDeadline}:00`).getTime();
      if (now.getTime() > deadlineMs + policy.graceMinutes * 60_000) {
        return 'makeup_required';
      }
    }
    return 'pending';
  }
  return todayRecord.status;
}

export function getTodayRecord(records: CheckInRecord[], now: Date = getLocalNow()): CheckInRecord | undefined {
  const today = toLocalDateString(now);
  return records.find((r) => r.date === today && r.kind === 'clock_in');
}

export function calculatePerfectStreak(records: CheckInRecord[], now: Date = getLocalNow()): number {
  const today = toLocalDateString(now);
  const dateSet = new Set(
    records
      .filter((r) => r.kind === 'clock_in' && r.status !== 'makeup_required' && !r.makeupReason)
      .map((r) => r.date),
  );

  let streak = 0;
  let checkDate = new Date(now);

  if (!dateSet.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = toLocalDateString(checkDate);
    if (!dateSet.has(key)) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function calculateAttendanceStreak(records: CheckInRecord[], now: Date = getLocalNow()): number {
  const today = toLocalDateString(now);
  const dateSet = new Set(
    records.filter((r) => r.kind === 'clock_in').map((r) => r.date),
  );

  let streak = 0;
  let checkDate = new Date(now);

  if (!dateSet.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = toLocalDateString(checkDate);
    if (!dateSet.has(key)) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

export function getMonthlyAttendance(records: CheckInRecord[], now: Date = getLocalNow()): Record<string, CheckInStatus> {
  const year = now.getFullYear();
  const month = now.getMonth();
  const result: Record<string, CheckInStatus> = {};

  records.forEach((r) => {
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month && r.kind === 'clock_in') {
      result[r.date] = r.status;
    }
  });

  return result;
}

export function getNextMilestone(currentStreak: number): number | null {
  for (const m of MILESTONES) {
    if (currentStreak < m) return m;
  }
  return null;
}

/**
 * Phase 1 missed-day reconcile candidates: local dates that ended without a
 * check-in and have no canonical record yet. Anchored to the user's own history
 * (strictly after the earliest check-in) so days before reporting started are
 * never marked, bounded to the current local month, and the previous day is
 * always covered so the 23:59 → 00:00 rollover works even across a month
 * boundary. A store with no check-in history has no candidates.
 */
export function findUnreconciledMissedDates(records: CheckInRecord[], now: Date = getLocalNow()): string[] {
  const clockInRecords = records.filter((record) => record.kind === 'clock_in');
  if (clockInRecords.length === 0) return [];

  const today = toLocalDateString(now);
  const existing = new Set(clockInRecords.map((record) => record.date));
  const earliest = clockInRecords.map((record) => record.date).sort()[0];
  const anchorNext = new Date(`${earliest}T12:00:00`);
  anchorNext.setDate(anchorNext.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const previousDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  const dates = new Set<string>();
  const consider = (date: Date) => {
    const key = toLocalDateString(date);
    if (key < today && key >= toLocalDateString(anchorNext) && !existing.has(key)) dates.add(key);
  };

  // Post-anchor, post-month-start days up to yesterday.
  const cursor = new Date(Math.max(monthStart.getTime(), anchorNext.getTime()));
  while (toLocalDateString(cursor) < today) {
    consider(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  // Rollover guarantee: the previous day, even when it is in the previous month.
  if (anchorNext.getTime() <= previousDay.getTime()) consider(previousDay);

  return [...dates].sort();
}

/** Latest past date already marked `makeup_required` (the newest missed day). */
export function selectLatestMissedDate(records: CheckInRecord[], now: Date = getLocalNow()): string | null {
  const today = toLocalDateString(now);
  const missed = records
    .filter((record) => record.kind === 'clock_in' && record.status === 'makeup_required' && record.date < today)
    .map((record) => record.date)
    .sort();
  return missed.length > 0 ? missed[missed.length - 1] : null;
}

export function computeCheckInMoonDew(streakDay: number): number {
  let amount = CHECKIN_MOON_DEW_BASE;
  if (streakDay > 0 && streakDay % 7 === 0) amount += CHECKIN_MOON_DEW_STREAK_BONUS_7;
  else if (streakDay > 0 && streakDay % 3 === 0) amount += CHECKIN_MOON_DEW_STREAK_BONUS_3;
  return amount;
}

export function buildCheckInIdempotencyKey(date: string, kind: CheckInKind): string {
  return `checkin:${date}:${kind}`;
}

export function validateReport(report: CheckInReport): boolean {
  return typeof report.sleepOk === 'boolean'
    && typeof report.mainTask === 'string'
    && report.mainTask.trim().length > 0
    && typeof report.curfewNote === 'string';
}

export function canClockIn(
  records: CheckInRecord[],
  policy: CheckInPolicy,
  now: Date = getLocalNow(),
): boolean {
  const today = toLocalDateString(now);
  const existing = records.find((r) => r.date === today && r.kind === 'clock_in');
  return !existing;
}

export function canClockOut(
  records: CheckInRecord[],
  policy: CheckInPolicy,
  now: Date = getLocalNow(),
): boolean {
  if (policy.mode !== 'strict') return false;
  const today = toLocalDateString(now);
  const hasIn = records.some((r) => r.date === today && r.kind === 'clock_in');
  const hasOut = records.some((r) => r.date === today && r.kind === 'clock_out');
  return hasIn && !hasOut;
}

export function canMakeup(
  records: CheckInRecord[],
  policy: CheckInPolicy,
  date: string,
  now: Date = getLocalNow(),
): boolean {
  const record = records.find((r) => r.date === date && r.kind === 'clock_in');
  if (!record || record.status !== 'makeup_required') return false;
  const deadline = new Date(record.createdAt).getTime() + policy.makeupHours * 3600_000;
  return now.getTime() <= deadline;
}

export function evaluateConsequence(
  records: CheckInRecord[],
  level: ConsequenceLevel,
  now: Date = getLocalNow(),
): { restricted: boolean; reason: string | null } {
  const streak = calculatePerfectStreak(records, now);
  const today = toLocalDateString(now);
  const todayRecord = getTodayRecord(records, now);

  if (level === 'standard') {
    if (!todayRecord && now.getHours() >= 12) {
      return { restricted: false, reason: '今日尚未打卡，但無額外限制' };
    }
    return { restricted: false, reason: null };
  }

  if (level === 'strict') {
    if (!todayRecord) {
      return { restricted: true, reason: 'strict: 需完成補交說明' };
    }
    return { restricted: false, reason: null };
  }

  if (level === 'warden') {
    if (!todayRecord && streak === 0) {
      return { restricted: true, reason: 'warden: 需一次有效打卡' };
    }
    return { restricted: false, reason: null };
  }

  return { restricted: false, reason: null };
}

export function buildMakeupRecord(
  originalDate: string,
  reason: string,
  now: Date = getLocalNow(),
): Partial<CheckInRecord> {
  const nowStr = now.toISOString();
  return {
    date: originalDate,
    kind: 'clock_in',
    status: 'completed',
    clockInAt: nowStr,
    clockOutAt: null,
    isLate: true,
    graceMinutesUsed: 0,
    report: null,
    makeupReason: reason,
    moonDewAwarded: 0,
    ticketNumber: makeTicketNumber(originalDate, 'clock_in'),
    updatedAt: nowStr,
  };
}

export function getClaimableMilestones(
  currentStreak: number,
  claimedMilestones: MilestoneReward[],
): number[] {
  return MILESTONES.filter((m) => {
    if (currentStreak < m) return false;
    const claimed = claimedMilestones.find((c) => c.day === m);
    return !claimed?.claimed;
  });
}
