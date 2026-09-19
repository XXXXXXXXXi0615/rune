import { beforeEach, describe, expect, it } from 'vitest';
import { toLocalDateString } from '@/utils/date';
import { calculatePerfectStreak, findUnreconciledMissedDates, selectLatestMissedDate } from './tideclockEngine';
import { useCheckInStore } from './useCheckInStore';
import type { CheckInRecord } from './types';

function shiftLocalDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

function record(date: string, status: CheckInRecord['status'] = 'completed', extra: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    id: `r-${date}-${status}`,
    date,
    kind: 'clock_in',
    status,
    clockInAt: `${date}T01:00:00.000Z`,
    clockOutAt: null,
    isLate: false,
    graceMinutesUsed: 0,
    report: null,
    makeupReason: null,
    moonDewAwarded: 0,
    ticketNumber: `T-${date}`,
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T01:00:00.000Z`,
    ...extra,
  };
}

const FIXED_NOW = new Date(2026, 8, 20, 9, 0, 0); // 2026-09-20 local

describe('findUnreconciledMissedDates', () => {
  it('has no candidates before any check-in history exists', () => {
    expect(findUnreconciledMissedDates([], FIXED_NOW)).toEqual([]);
  });

  it('marks ended days without a record, anchored to the first check-in', () => {
    // History starts 2026-09-18 → only the ended day after it is a candidate.
    expect(findUnreconciledMissedDates([record('2026-09-18')], FIXED_NOW)).toEqual(['2026-09-19']);
    // Days before the first check-in are never marked.
    expect(findUnreconciledMissedDates([record('2026-09-18')], FIXED_NOW)).not.toContain('2026-09-17');
    // Gaps after the anchor are all marked up to yesterday.
    const gap = findUnreconciledMissedDates([record('2026-09-01')], FIXED_NOW);
    expect(gap[0]).toBe('2026-09-02');
    expect(gap[gap.length - 1]).toBe('2026-09-19');
    expect(gap).toHaveLength(18);
  });

  it('never marks yesterday for a user whose history starts today', () => {
    expect(findUnreconciledMissedDates([record('2026-09-20')], FIXED_NOW)).toEqual([]);
    expect(findUnreconciledMissedDates([record('2026-09-19')], FIXED_NOW)).toEqual([]);
  });

  it('covers the previous day across a month boundary', () => {
    const firstOfMonth = new Date(2026, 8, 1, 9, 0, 0);
    expect(findUnreconciledMissedDates([record('2026-08-29')], firstOfMonth)).toEqual(['2026-08-31']);
  });
});

describe('selectLatestMissedDate', () => {
  it('returns the newest past makeup_required date only', () => {
    const records = [record('2026-09-18', 'makeup_required'), record('2026-09-19', 'makeup_required'), record('2026-09-20', 'makeup_required')];
    expect(selectLatestMissedDate(records, FIXED_NOW)).toBe('2026-09-19');
    expect(selectLatestMissedDate([record('2026-09-19', 'completed')], FIXED_NOW)).toBeNull();
  });
});

describe('reconcileMissedDays (canonical store)', () => {
  beforeEach(() => {
    localStorage.clear();
    useCheckInStore.setState({ records: [], corrections: [], settlements: [], dismissedTodayDate: null, acknowledgedMissedDate: null });
  });

  it('marks each ended day once and is idempotent across reloads', () => {
    const today = shiftLocalDays(0);
    const history = shiftLocalDays(-3);
    useCheckInStore.setState({ records: [record(history)] });

    const marked = useCheckInStore.getState().reconcileMissedDays();
    expect(marked).toBeGreaterThan(0);

    const missedDates = useCheckInStore.getState().records.filter((r) => r.status === 'makeup_required').map((r) => r.date);
    expect(new Set(missedDates).size).toBe(missedDates.length);
    expect(missedDates.every((date) => date < today)).toBe(true);
    expect(missedDates).not.toContain(history);

    // Re-running (reload, remount, visibility) never duplicates or re-marks a day.
    expect(useCheckInStore.getState().reconcileMissedDays()).toBe(0);
    const again = useCheckInStore.getState().records.filter((r) => r.status === 'makeup_required');
    expect(again).toHaveLength(missedDates.length);
  });

  it('breaks the perfect streak without touching completed history', () => {
    const yesterday = shiftLocalDays(-1);
    const dayBefore = shiftLocalDays(-2);
    useCheckInStore.setState({ records: [record(dayBefore)] });
    useCheckInStore.getState().reconcileMissedDays();

    const records = useCheckInStore.getState().records;
    expect(records.some((r) => r.date === yesterday && r.status === 'makeup_required')).toBe(true);
    expect(records.some((r) => r.date === dayBefore && r.status === 'completed')).toBe(true);
    expect(calculatePerfectStreak(records, new Date())).toBe(0);
  });

  it('a makeup submission corrects the record but never restores the streak', () => {
    const yesterday = shiftLocalDays(-1);
    useCheckInStore.setState({ records: [record(shiftLocalDays(-3))] });
    useCheckInStore.getState().reconcileMissedDays();

    const makeup = useCheckInStore.getState().submitMakeup(yesterday, 'overslept');
    expect(makeup?.status).toBe('completed');
    expect(makeup?.makeupReason).toBe('overslept');

    const records = useCheckInStore.getState().records;
    expect(calculatePerfectStreak(records, new Date())).toBe(0);
    expect(useCheckInStore.getState().corrections.some((correction) => correction.recordId === makeup?.id)).toBe(true);
  });
});
