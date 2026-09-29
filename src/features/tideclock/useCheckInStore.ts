import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toLocalDateString } from '@/utils/date';
import { emitDailyCheckInCompleted } from './dailyCheckInEvents';
import { useAppStore } from '@/store/useAppStore';
import type {
  CheckInRecord,
  CheckInPolicy,
  CheckInCorrection,
  CheckInReport,
  CheckInSettlement,
  MilestoneReward,
  CheckInKind,
} from './types';
import { DEFAULT_POLICY, makeTicketNumber, MILESTONES } from './types';
import {
  computeCheckInMoonDew,
  buildCheckInIdempotencyKey,
  calculatePerfectStreak,
  calculateAttendanceStreak,
  getMonthlyAttendance,
  getNextMilestone,
  canClockIn,
  canClockOut,
  canMakeup,
  evaluateConsequence,
  findUnreconciledMissedDates,
  isLate,
  validateReport,
  getClaimableMilestones,
} from './tideclockEngine';
import { buildMoonDewEntry, hasMoonDewKey, moonDewIdempotencyKey } from '@/utils/moonDewEngine';

const STORAGE_KEY = 'lunartide-check-in';

/** Canonical missed-day record: one final `makeup_required` state per date. */
function buildMissedRecord(date: string, createdAt: string): CheckInRecord {
  return {
    id: crypto.randomUUID(),
    date,
    kind: 'clock_in',
    status: 'makeup_required',
    clockInAt: null,
    clockOutAt: null,
    isLate: false,
    graceMinutesUsed: 0,
    report: null,
    makeupReason: null,
    moonDewAwarded: 0,
    ticketNumber: makeTicketNumber(date, 'clock_in'),
    createdAt,
    updatedAt: createdAt,
  };
}

interface CheckInState {
  records: CheckInRecord[];
  corrections: CheckInCorrection[];
  settlements: CheckInSettlement[];
  policy: CheckInPolicy;
  milestoneRewards: MilestoneReward[];
  dismissedTodayDate: string | null;
  /** Latest missed-day consequence that has already been presented (shown once). */
  acknowledgedMissedDate: string | null;
}

interface CheckInActions {
  clockIn: (report?: CheckInReport) => CheckInRecord | null;
  clockOut: () => CheckInRecord | null;
  markMissed: (date: string) => void;
  reconcileMissedDays: (now?: Date) => number;
  acknowledgeMissedConsequence: (date: string) => void;
  submitMakeup: (date: string, reason: string) => CheckInRecord | null;
  excuseRecord: (recordId: string, reason: string) => void;
  applyCorrection: (recordId: string, field: string, oldValue: string, newValue: string, reason: string) => void;
  getTodayStatus: () => CheckInRecord | undefined;
  getCurrentPerfectStreak: () => number;
  getAttendanceStreak: () => number;
  getMonthlyAttendance: () => Record<string, CheckInRecord['status']>;
  getNextMilestone: () => number | null;
  getConsequence: () => { restricted: boolean; reason: string | null };
  claimMilestone: (day: number) => boolean;
  dismissToday: () => void;
  updatePolicy: (patch: Partial<CheckInPolicy>) => void;
}

export const useCheckInStore = create<CheckInState & CheckInActions>()(
  persist(
    (set, get) => ({
      records: [],
      corrections: [],
      settlements: [],
      policy: { ...DEFAULT_POLICY },
      milestoneRewards: MILESTONES.map((day) => ({
        day,
        claimed: false,
        claimedAt: null,
        rewardType: day <= 7 ? 'stamp' : day <= 30 ? 'asset' : 'explore',
      })),
          dismissedTodayDate: null,
          acknowledgedMissedDate: null,

      clockIn: (report) => {
        const state = get();
        const now = new Date();
        const today = toLocalDateString(now);

        if (!canClockIn(state.records, state.policy, now)) {
          return null;
        }

        if (state.policy.requireReport && state.policy.mode === 'report' && report && !validateReport(report)) {
          return null;
        }

        const late = isLate(state.policy.clockInDeadline, state.policy.graceMinutes, now);
        const status: CheckInRecord['status'] = late ? 'late' : 'completed';
        const streakDay = calculatePerfectStreak(state.records, now) + 1;
        const moonDewAmount = computeCheckInMoonDew(streakDay);
        const idempotencyKey = buildCheckInIdempotencyKey(today, 'clock_in');
        const ticketNumber = makeTicketNumber(today, 'clock_in');
        const nowStr = now.toISOString();

        const moonDewEntry = buildMoonDewEntry({
          amount: moonDewAmount,
          source: 'check_in',
          reasonCode: late ? 'checkin:late' : 'checkin:on_time',
          title: late ? `遲到打卡 (連續 ${streakDay} 天)` : `準時打卡 (連續 ${streakDay} 天)`,
          idempotencyKey,
          metadata: { streakDay, late, kind: 'clock_in' },
        });

        const addMoonDewEntry = useAppStore.getState().addMoonDewEntry;
        const moonDewAdded = addMoonDewEntry(moonDewEntry);

        const record: CheckInRecord = {
          id: crypto.randomUUID(),
          date: today,
          kind: 'clock_in',
          status,
          clockInAt: nowStr,
          clockOutAt: null,
          isLate: late,
          graceMinutesUsed: late ? 0 : Math.max(0, (now.getTime() - new Date(`${today}T${state.policy.clockInDeadline}:00`).getTime()) / 60_000),
          report: report || null,
          makeupReason: null,
          moonDewAwarded: moonDewAdded ? moonDewAmount : 0,
          ticketNumber,
          createdAt: nowStr,
          updatedAt: nowStr,
        };

        const settlement: CheckInSettlement = {
          recordId: record.id,
          moonDewAmount: moonDewAdded ? moonDewAmount : 0,
          idempotencyKey,
          settled: moonDewAdded,
          settledAt: moonDewAdded ? nowStr : null,
        };

        set((s) => ({
          records: [record, ...s.records],
          settlements: [settlement, ...s.settlements],
      dismissedTodayDate: null,
        }));

        emitDailyCheckInCompleted({ date: today });
        return record;
      },

      clockOut: () => {
        const state = get();
        const now = new Date();
        const today = toLocalDateString(now);

        if (!canClockOut(state.records, state.policy, now)) {
          return null;
        }

        const nowStr = now.toISOString();
        const ticketNumber = makeTicketNumber(today, 'clock_out');

        const record: CheckInRecord = {
          id: crypto.randomUUID(),
          date: today,
          kind: 'clock_out',
          status: 'completed',
          clockInAt: null,
          clockOutAt: nowStr,
          isLate: isLate(state.policy.clockOutDeadline, state.policy.graceMinutes, now),
          graceMinutesUsed: 0,
          report: null,
          makeupReason: null,
          moonDewAwarded: 0,
          ticketNumber,
          createdAt: nowStr,
          updatedAt: nowStr,
        };

        set((s) => ({
          records: [record, ...s.records],
        }));

        return record;
      },

      markMissed: (date) => {
        const state = get();
        const existing = state.records.find((r) => r.date === date && r.kind === 'clock_in');
        if (existing) return;

        set((s) => ({
          records: [buildMissedRecord(date, new Date().toISOString()), ...s.records],
        }));
      },

      /** Idempotent day-close reconcile: marks ended days without a check-in as missed once. */
      reconcileMissedDays: (now = new Date()) => {
        const state = get();
        const dates = findUnreconciledMissedDates(state.records, now);
        if (dates.length === 0) return 0;

        const nowStr = now.toISOString();
        set((s) => ({
          records: [...dates.map((date) => buildMissedRecord(date, nowStr)), ...s.records],
        }));

        return dates.length;
      },

      acknowledgeMissedConsequence: (date) => {
        if (get().acknowledgedMissedDate === date) return;
        set({ acknowledgedMissedDate: date });
      },

      submitMakeup: (date, reason) => {
        const state = get();
        const now = new Date();

        if (!canMakeup(state.records, state.policy, date, now)) {
          return null;
        }

        const existing = state.records.find((r) => r.date === date && r.kind === 'clock_in');
        if (!existing) return null;

        const nowStr = now.toISOString();
        const updatedRecord: CheckInRecord = {
          ...existing,
          status: 'completed',
          clockInAt: nowStr,
          isLate: true,
          makeupReason: reason,
          moonDewAwarded: 0,
          updatedAt: nowStr,
        };

        const correction: CheckInCorrection = {
          id: crypto.randomUUID(),
          recordId: existing.id,
          field: 'status',
          oldValue: 'makeup_required',
          newValue: 'completed',
          reason,
          createdAt: nowStr,
        };

        set((s) => ({
          records: s.records.map((r) => (r.id === existing.id ? updatedRecord : r)),
          corrections: [correction, ...s.corrections],
        }));

        return updatedRecord;
      },

      excuseRecord: (recordId, reason) => {
        const now = new Date().toISOString();
        set((s) => {
          const record = s.records.find((r) => r.id === recordId);
          if (!record) return s;

          const correction: CheckInCorrection = {
            id: crypto.randomUUID(),
            recordId,
            field: 'status',
            oldValue: record.status,
            newValue: 'completed',
            reason,
            createdAt: now,
          };

          return {
            records: s.records.map((r) =>
              r.id === recordId ? { ...r, status: 'completed' as const, updatedAt: now } : r,
            ),
            corrections: [correction, ...s.corrections],
          };
        });
      },

      applyCorrection: (recordId, field, oldValue, newValue, reason) => {
        const now = new Date().toISOString();
        const correction: CheckInCorrection = {
          id: crypto.randomUUID(),
          recordId,
          field,
          oldValue,
          newValue,
          reason,
          createdAt: now,
        };

        set((s) => ({
          corrections: [correction, ...s.corrections],
        }));
      },

      getTodayStatus: () => {
        const state = get();
        const now = new Date();
        const today = toLocalDateString(now);
        return state.records.find((r) => r.date === today && r.kind === 'clock_in');
      },

      getCurrentPerfectStreak: () => {
        const state = get();
        return calculatePerfectStreak(state.records, new Date());
      },

      getAttendanceStreak: () => {
        const state = get();
        return calculateAttendanceStreak(state.records, new Date());
      },

      getMonthlyAttendance: () => {
        const state = get();
        return getMonthlyAttendance(state.records, new Date());
      },

      getNextMilestone: () => {
        const state = get();
        const streak = calculatePerfectStreak(state.records, new Date());
        return getNextMilestone(streak);
      },

      getConsequence: () => {
        const state = get();
        return evaluateConsequence(state.records, state.policy.consequenceLevel, new Date());
      },

      claimMilestone: (day) => {
        const state = get();
        const streak = calculatePerfectStreak(state.records, new Date());
        if (streak < day) return false;

        const existing = state.milestoneRewards.find((m) => m.day === day);
        if (existing?.claimed) return false;

        const now = new Date().toISOString();
        set((s) => ({
          milestoneRewards: s.milestoneRewards.map((m) =>
            m.day === day ? { ...m, claimed: true, claimedAt: now } : m,
          ),
        }));

        return true;
      },

      dismissToday: () => {
        set({ dismissedTodayDate: toLocalDateString(new Date()) });
      },

      updatePolicy: (patch) => {
        set((s) => ({
          policy: { ...s.policy, ...patch },
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        records: state.records,
        corrections: state.corrections,
        settlements: state.settlements,
        policy: state.policy,
        milestoneRewards: state.milestoneRewards,
        dismissedTodayDate: state.dismissedTodayDate,
        acknowledgedMissedDate: state.acknowledgedMissedDate,
      }),
    },
  ),
);
