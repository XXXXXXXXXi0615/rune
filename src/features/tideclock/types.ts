export type CheckInMode = 'simple' | 'report' | 'strict';

export type CheckInStatus = 'pending' | 'completed' | 'late' | 'makeup_required';

export type CheckInKind = 'clock_in' | 'clock_out';

export type ConsequenceLevel = 'standard' | 'strict' | 'warden';

export interface CheckInRecord {
  id: string;
  date: string;
  kind: CheckInKind;
  status: CheckInStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
  isLate: boolean;
  graceMinutesUsed: number;
  report: CheckInReport | null;
  makeupReason: string | null;
  moonDewAwarded: number;
  ticketNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInReport {
  sleepOk: boolean;
  mainTask: string;
  curfewNote: string;
}

export interface CheckInPolicy {
  mode: CheckInMode;
  clockInDeadline: string;
  clockOutDeadline: string;
  graceMinutes: number;
  makeupHours: number;
  consequenceLevel: ConsequenceLevel;
  requireReport: boolean;
}

export interface CheckInCorrection {
  id: string;
  recordId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: string;
}

export interface CheckInSettlement {
  recordId: string;
  moonDewAmount: number;
  idempotencyKey: string;
  settled: boolean;
  settledAt: string | null;
}

export interface MilestoneReward {
  day: number;
  claimed: boolean;
  claimedAt: string | null;
  rewardType: string;
}

export const DEFAULT_POLICY: CheckInPolicy = {
  mode: 'report',
  clockInDeadline: '10:00',
  clockOutDeadline: '23:59',
  graceMinutes: 30,
  makeupHours: 48,
  consequenceLevel: 'standard',
  requireReport: true,
};

export const MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export function makeTicketNumber(date: string, kind: CheckInKind): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = kind === 'clock_in' ? 'IN' : 'OUT';
  return `TC-${date.replace(/-/g, '')}-${prefix}-${rand}`;
}
