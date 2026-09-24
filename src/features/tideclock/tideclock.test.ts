import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      addMoonDewEntry: vi.fn(() => true),
    }),
  },
}));

vi.mock('@/store/useQuestStore', () => ({
  useQuestStore: {
    getState: () => ({
      quests: [],
      mainQuestByDate: {},
    }),
  },
}));

import {
  computeCheckInStatus,
  calculatePerfectStreak,
  calculateAttendanceStreak,
  getMonthlyAttendance,
  getNextMilestone,
  computeCheckInMoonDew,
  buildCheckInIdempotencyKey,
  validateReport,
  canClockIn,
  canClockOut,
  canMakeup,
  evaluateConsequence,
  isLate,
  isWithinGrace,
} from './tideclockEngine';
import type { CheckInRecord, CheckInPolicy } from './types';
import { DEFAULT_POLICY } from './types';

function makeRecord(overrides: Partial<CheckInRecord> & { date: string }): CheckInRecord {
  const now = new Date().toISOString();
  const { date, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    date,
    kind: 'clock_in',
    status: 'completed',
    clockInAt: now,
    clockOutAt: null,
    isLate: false,
    graceMinutesUsed: 0,
    report: null,
    makeupReason: null,
    moonDewAwarded: 1,
    ticketNumber: `TC-${date.replace(/-/g, '')}-IN-TEST`,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
}

describe('TideClock Engine', () => {
  describe('1. On-time check-in', () => {
    it('returns completed status when checking in before deadline', () => {
      const records: CheckInRecord[] = [];
      const policy: CheckInPolicy = { ...DEFAULT_POLICY, clockInDeadline: '23:59', graceMinutes: 30 };
      const now = new Date('2025-01-15T09:00:00');
      const result = computeCheckInStatus(records, policy, now);
      expect(result).toBe('pending');
    });
  });

  describe('2. Grace period check-in', () => {
    it('isWithinGrace returns true within grace window', () => {
      const deadline = '10:00';
      const grace = 30;
      const withinWindow = new Date('2025-01-15T10:20:00');
      expect(isWithinGrace(deadline, grace, withinWindow)).toBe(true);
    });

    it('isWithinGrace returns false after grace window', () => {
      const deadline = '10:00';
      const grace = 30;
      const afterWindow = new Date('2025-01-15T10:31:00');
      expect(isWithinGrace(deadline, grace, afterWindow)).toBe(false);
    });
  });

  describe('3. Late check-in', () => {
    it('isLate returns true after deadline + grace', () => {
      const deadline = '10:00';
      const grace = 30;
      const lateTime = new Date('2025-01-15T10:31:00');
      expect(isLate(deadline, grace, lateTime)).toBe(true);
    });

    it('isLate returns false before deadline', () => {
      const deadline = '10:00';
      const grace = 30;
      const earlyTime = new Date('2025-01-15T09:50:00');
      expect(isLate(deadline, grace, earlyTime)).toBe(false);
    });
  });

  describe('4. Missed check-in', () => {
    it('returns makeup_required when deadline passed and mode is strict', () => {
      const records: CheckInRecord[] = [];
      const policy: CheckInPolicy = { ...DEFAULT_POLICY, mode: 'strict', clockInDeadline: '10:00', graceMinutes: 30 };
      const afterDeadline = new Date('2025-01-15T11:00:00');
      const result = computeCheckInStatus(records, policy, afterDeadline);
      expect(result).toBe('makeup_required');
    });
  });

  describe('5. Makeup submission', () => {
    it('canMakeup returns true within makeup window', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-14', status: 'makeup_required', createdAt: '2025-01-14T10:00:00.000Z' }),
      ];
      const policy: CheckInPolicy = { ...DEFAULT_POLICY, makeupHours: 48 };
      const withinWindow = new Date('2025-01-15T10:00:00');
      expect(canMakeup(records, policy, '2025-01-14', withinWindow)).toBe(true);
    });

    it('canMakeup returns false after makeup window', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-14', status: 'makeup_required', createdAt: '2025-01-14T10:00:00.000Z' }),
      ];
      const policy: CheckInPolicy = { ...DEFAULT_POLICY, makeupHours: 48 };
      const afterWindow = new Date('2025-01-17T11:00:00');
      expect(canMakeup(records, policy, '2025-01-14', afterWindow)).toBe(false);
    });
  });

  describe('6. Same-day duplicate does not duplicate settlement', () => {
    it('canClockIn returns false if today already has a record', () => {
      const today = '2025-01-15';
      const records: CheckInRecord[] = [makeRecord({ date: today })];
      const now = new Date(`${today}T12:00:00`);
      expect(canClockIn(records, DEFAULT_POLICY, now)).toBe(false);
    });
  });

  describe('7. Local date and timezone', () => {
    it('buildCheckInIdempotencyKey uses local date', () => {
      const key = buildCheckInIdempotencyKey('2025-01-15', 'clock_in');
      expect(key).toBe('checkin:2025-01-15:clock_in');
    });

    it('idempotency key is stable', () => {
      const key1 = buildCheckInIdempotencyKey('2025-01-15', 'clock_in');
      const key2 = buildCheckInIdempotencyKey('2025-01-15', 'clock_in');
      expect(key1).toBe(key2);
    });
  });

  describe('8. DST boundary', () => {
    it('handles spring forward correctly', () => {
      const deadline = '10:00';
      const grace = 30;
      const beforeDST = new Date('2025-03-09T09:50:00');
      expect(isLate(deadline, grace, beforeDST)).toBe(false);
    });

    it('handles fall back correctly', () => {
      const deadline = '10:00';
      const grace = 30;
      const afterFallBack = new Date('2025-11-02T10:20:00');
      expect(isWithinGrace(deadline, grace, afterFallBack)).toBe(true);
    });
  });

  describe('9. Perfect streak', () => {
    it('counts consecutive completed days', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-13', status: 'completed', isLate: false }),
        makeRecord({ date: '2025-01-14', status: 'completed', isLate: false }),
        makeRecord({ date: '2025-01-15', status: 'completed', isLate: false }),
      ];
      const now = new Date('2025-01-15T12:00:00');
      expect(calculatePerfectStreak(records, now)).toBe(3);
    });

    it('breaks streak on makeup record', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-13', status: 'completed', isLate: false }),
        makeRecord({ date: '2025-01-14', status: 'completed', isLate: true, makeupReason: 'overslept' }),
        makeRecord({ date: '2025-01-15', status: 'completed', isLate: false }),
      ];
      const now = new Date('2025-01-15T12:00:00');
      expect(calculatePerfectStreak(records, now)).toBe(1);
    });
  });

  describe('10. Attendance streak', () => {
    it('counts consecutive days including makeup', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-13', status: 'completed', isLate: false }),
        makeRecord({ date: '2025-01-14', status: 'completed', isLate: true, makeupReason: 'overslept' }),
        makeRecord({ date: '2025-01-15', status: 'completed', isLate: false }),
      ];
      const now = new Date('2025-01-15T12:00:00');
      expect(calculateAttendanceStreak(records, now)).toBe(3);
    });
  });

  describe('11. Milestone only settles once', () => {
    it('getNextMilestone returns next unclaimed', () => {
      expect(getNextMilestone(0)).toBe(3);
      expect(getNextMilestone(3)).toBe(7);
      expect(getNextMilestone(7)).toBe(14);
      expect(getNextMilestone(100)).toBeNull();
    });
  });

  describe('12. AI offline still can check in', () => {
    it('validateReport works without AI', () => {
      const report = { sleepOk: true, mainTask: '寫程式', curfewNote: '' };
      expect(validateReport(report)).toBe(true);
    });

    it('validateReport rejects empty mainTask', () => {
      const report = { sleepOk: true, mainTask: '', curfewNote: '' };
      expect(validateReport(report)).toBe(false);
    });
  });

  describe('13. Consequence levels', () => {
    it('standard has no restriction', () => {
      const records: CheckInRecord[] = [];
      const result = evaluateConsequence(records, 'standard', new Date('2025-01-15T12:00:00'));
      expect(result.restricted).toBe(false);
    });

    it('strict restricts when no record', () => {
      const records: CheckInRecord[] = [];
      const result = evaluateConsequence(records, 'strict', new Date('2025-01-15T12:00:00'));
      expect(result.restricted).toBe(true);
    });

    it('warden restricts when no record and zero streak', () => {
      const records: CheckInRecord[] = [];
      const result = evaluateConsequence(records, 'warden', new Date('2025-01-15T12:00:00'));
      expect(result.restricted).toBe(true);
    });

    it('warden does not restrict when record exists', () => {
      const records: CheckInRecord[] = [makeRecord({ date: '2025-01-15' })];
      const result = evaluateConsequence(records, 'warden', new Date('2025-01-15T12:00:00'));
      expect(result.restricted).toBe(false);
    });
  });

  describe('14. Correction audit', () => {
    it('canClockOut returns false for non-strict mode', () => {
      const records: CheckInRecord[] = [makeRecord({ date: '2025-01-15' })];
      const now = new Date('2025-01-15T20:00:00');
      expect(canClockOut(records, DEFAULT_POLICY, now)).toBe(false);
    });

    it('canClockOut returns true for strict mode with clock-in', () => {
      const records: CheckInRecord[] = [makeRecord({ date: '2025-01-15' })];
      const policy: CheckInPolicy = { ...DEFAULT_POLICY, mode: 'strict' };
      const now = new Date('2025-01-15T20:00:00');
      expect(canClockOut(records, policy, now)).toBe(true);
    });
  });

  describe('Moon Dew computation', () => {
    it('base amount is 1', () => {
      expect(computeCheckInMoonDew(1)).toBe(1);
    });

    it('3-day streak gets +1 bonus', () => {
      expect(computeCheckInMoonDew(3)).toBe(2);
    });

    it('7-day streak gets +2 bonus', () => {
      expect(computeCheckInMoonDew(7)).toBe(3);
    });

    it('non-milestone streak gets base only', () => {
      expect(computeCheckInMoonDew(5)).toBe(1);
    });
  });

  describe('Monthly attendance', () => {
    it('returns records for current month', () => {
      const records: CheckInRecord[] = [
        makeRecord({ date: '2025-01-10', status: 'completed' }),
        makeRecord({ date: '2025-01-15', status: 'late' }),
        makeRecord({ date: '2025-02-01', status: 'completed' }),
      ];
      const now = new Date('2025-01-20');
      const monthly = getMonthlyAttendance(records, now);
      expect(Object.keys(monthly)).toHaveLength(2);
      expect(monthly['2025-01-10']).toBe('completed');
      expect(monthly['2025-01-15']).toBe('late');
      expect(monthly['2025-02-01']).toBeUndefined();
    });
  });
});
