import { describe, expect, it } from 'vitest';
import type { CheckInRecord } from '@/features/tideclock/types';
import { deriveDailyCheckInMonthSummary } from './dailyCheckInWelcomePresentation';

const record = (date: string, status: CheckInRecord['status'], kind: CheckInRecord['kind'] = 'clock_in'): CheckInRecord => ({
  id: `${date}-${status}-${kind}`, date, kind, status, clockInAt: status === 'makeup_required' ? null : `${date}T08:00:00Z`, clockOutAt: null,
  isLate: status === 'late', graceMinutesUsed: 0, report: null, makeupReason: null, moonDewAwarded: 0,
  ticketNumber: 'TEST', createdAt: `${date}T08:00:00Z`, updatedAt: `${date}T08:00:00Z`,
});

describe('Daily Check-in welcome presentation', () => {
  it('counts unique completed/late and missed days in the current month', () => {
    expect(deriveDailyCheckInMonthSummary([
      record('2026-09-01', 'completed'), record('2026-09-02', 'late'), record('2026-09-03', 'makeup_required'),
      record('2026-09-02', 'late', 'clock_out'), record('2026-08-31', 'completed'),
    ], new Date('2026-09-11T12:00:00'))).toEqual({ checked: 2, missed: 1 });
  });
});
