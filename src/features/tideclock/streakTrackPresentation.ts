import { toLocalDateString } from '@/utils/date';
import type { CheckInRecord, MilestoneReward } from './types';

/**
 * Pure presentation derivation for the 7-day consecutive check-in track.
 * Uses the CURRENT STREAK CYCLE (not a calendar week): the run of consecutive
 * perfect clock-in dates ending today (or yesterday when today is unchecked),
 * exactly mirroring calculatePerfectStreak's walk — never streak-count math.
 */

export type StreakSlotState = 'completed' | 'today-available' | 'today-completed' | 'future';

export interface StreakTrackSlot {
  /** 1..7, ascending. */
  index: number;
  /** Local calendar date behind the slot when the slot maps to a real day. */
  date: string | null;
  state: StreakSlotState;
  /** Day 7 is the streak-cycle reward slot (presentation accent only). */
  isRewardDay: boolean;
  isLate?: boolean;
}

export interface StreakTrackReward {
  claimed: boolean;
  /** streak >= 7 && !claimed — mirrors claimMilestone(7)'s own gate. */
  canClaim: boolean;
  /** The reward block renders only when claimable or already claimed. */
  visible: boolean;
}

export interface StreakTrack {
  slots: StreakTrackSlot[];
  reward: StreakTrackReward;
}

const REWARD_DAY = 7;
export const STREAK_REWARD_DAY = REWARD_DAY;

export function deriveStreakTrack(
  records: CheckInRecord[],
  now: Date,
  streak: number,
  milestoneRewards: MilestoneReward[],
): StreakTrack {
  const today = toLocalDateString(now);
  const perfectDates = new Set(
    records
      .filter((record) => record.kind === 'clock_in' && record.status !== 'makeup_required' && !record.makeupReason)
      .map((record) => record.date),
  );
  const recordByDate = new Map(
    records.filter((record) => record.kind === 'clock_in').map((record) => [record.date, record]),
  );

  // Walk the run exactly like calculatePerfectStreak: end at today when today is
  // checked in, otherwise at yesterday. Collect the actual dates, not counts.
  const runDates: string[] = [];
  const cursor = new Date(now);
  if (!perfectDates.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (perfectDates.has(toLocalDateString(cursor))) {
    runDates.unshift(toLocalDateString(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  const todayRecord = recordByDate.get(today);
  const slots: StreakTrackSlot[] = [];
  const pushSlot = (index: number, date: string | null, state: StreakSlotState) => {
    const record = date ? recordByDate.get(date) : undefined;
    slots.push({
      index,
      date,
      state,
      isRewardDay: index === REWARD_DAY,
      isLate: record?.isLate || undefined,
    });
  };

  if (runDates.length >= REWARD_DAY) {
    // Most recent seven-day completed run fills the whole board.
    runDates.slice(runDates.length - REWARD_DAY).forEach((date, i) => {
      pushSlot(i + 1, date, date === today ? 'today-completed' : 'completed');
    });
  } else {
    runDates.forEach((date, i) => {
      pushSlot(i + 1, date, date === today ? 'today-completed' : 'completed');
    });
    if (!todayRecord) {
      pushSlot(slots.length + 1, today, 'today-available');
    }
    while (slots.length < REWARD_DAY) {
      pushSlot(slots.length + 1, null, 'future');
    }
  }

  const claimed = Boolean(milestoneRewards.find((milestone) => milestone.day === REWARD_DAY)?.claimed);
  const canClaim = !claimed && streak >= REWARD_DAY;
  return { slots, reward: { claimed, canClaim, visible: claimed || canClaim } };
}

/** Non-interactive slot label; only the primary action may check in. */
export function streakSlotLabel(slot: StreakTrackSlot): string {
  const base = `Day ${slot.index}，${
    slot.state === 'completed' ? '已完成'
      : slot.state === 'today-completed' ? '今日已完成'
        : slot.state === 'today-available' ? '今天可以報備'
          : '尚未解鎖'
  }`;
  return slot.isRewardDay ? `${base}，連續報備獎勵` : base;
}
