import { describe, it, expect } from 'vitest';
import { deriveStreakTrack, streakSlotLabel } from './streakTrackPresentation';
import type { CheckInRecord, MilestoneReward } from './types';

const NOW = new Date(2026, 8, 11, 9, 12, 0); // local 2026-09-11 (Friday)
const TODAY = '2026-09-11';

const row = (date: string, status: CheckInRecord['status'] = 'completed', isLate = false): CheckInRecord => ({
  id: `seed-${date}`, date, kind: 'clock_in', status, clockInAt: `${date}T01:12:00.000Z`, clockOutAt: null,
  isLate, graceMinutesUsed: 0, report: null, makeupReason: null, moonDewAwarded: 0, ticketNumber: `T-${date}`,
  createdAt: `${date}T01:12:00.000Z`, updatedAt: `${date}T01:12:00.000Z`,
});

const reward = (claimed: boolean): MilestoneReward[] => [{ day: 7, claimed, claimedAt: claimed ? '2026-09-10T00:00:00.000Z' : null, rewardType: 'stamp' }];

const statesOf = (track: ReturnType<typeof deriveStreakTrack>) => track.slots.map((slot) => slot.state);

describe('deriveStreakTrack — current streak cycle board', () => {
  it('streak 0: Day1 = today available, Day2–7 future', () => {
    const track = deriveStreakTrack([], NOW, 0, []);
    expect(statesOf(track)).toEqual(['today-available', 'future', 'future', 'future', 'future', 'future', 'future']);
    expect(track.slots[0].date).toBe(TODAY);
    expect(track.slots[0].isRewardDay).toBe(false);
    expect(track.slots[6].isRewardDay).toBe(true);
    expect(track.reward.visible).toBe(false);
  });

  it('streak 1 (yesterday only): Day1 completed yesterday, Day2 = today available', () => {
    const track = deriveStreakTrack([row('2026-09-10')], NOW, 1, []);
    expect(statesOf(track)).toEqual(['completed', 'today-available', 'future', 'future', 'future', 'future', 'future']);
    expect(track.slots[0].date).toBe('2026-09-10');
    expect(track.slots[1].date).toBe(TODAY);
  });

  it('streak 3 after today check-in: Day1–3 completed with Day3 today-completed', () => {
    const track = deriveStreakTrack([row('2026-09-09'), row('2026-09-10'), row(TODAY)], NOW, 3, []);
    expect(statesOf(track)).toEqual(['completed', 'completed', 'today-completed', 'future', 'future', 'future', 'future']);
    expect(track.slots[2].date).toBe(TODAY);
  });

  it('streak 6 before check-in: Day1–6 completed, Day7 today-available with reward accent', () => {
    const track = deriveStreakTrack(
      ['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((date) => row(date)),
      NOW, 6, [],
    );
    expect(statesOf(track)).toEqual(['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'today-available']);
    expect(track.slots[6].isRewardDay).toBe(true);
    expect(track.slots[6].date).toBe(TODAY);
    expect(track.reward.visible).toBe(false);
  });

  it('streak 7 ending yesterday: board shows the seven-day completed run, reward claimable', () => {
    const track = deriveStreakTrack(
      ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'].map((date) => row(date)),
      NOW, 7, [],
    );
    expect(statesOf(track)).toEqual(Array.from({ length: 7 }, () => 'completed'));
    expect(track.slots[6].date).toBe('2026-09-10');
    expect(track.reward).toEqual({ claimed: false, canClaim: true, visible: true });
  });

  it('streak 8 after check-in: most recent seven-day run ending today', () => {
    const track = deriveStreakTrack(
      ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', TODAY].map((date) => row(date)),
      NOW, 8, [],
    );
    expect(statesOf(track)).toEqual(['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'today-completed']);
    expect(track.slots[0].date).toBe('2026-09-05');
    expect(track.slots[6].date).toBe(TODAY);
    expect(track.reward.canClaim).toBe(true);
  });

  it('broken streak: only the current cycle renders — old run days never inferred from counts', () => {
    const track = deriveStreakTrack(
      [row('2026-09-02'), row('2026-09-03'), row('2026-09-04'), row('2026-09-10')], NOW, 1, [],
    );
    expect(statesOf(track)).toEqual(['completed', 'today-available', 'future', 'future', 'future', 'future', 'future']);
    expect(track.slots[0].date).toBe('2026-09-10');
    expect(track.slots.filter((slot) => slot.date === '2026-09-03')).toEqual([]);
  });

  it('makeup_required day breaks the run and renders as absence, not completion', () => {
    // 09-09 awaits makeup → the current cycle restarts at 09-10.
    const track = deriveStreakTrack(
      [row('2026-09-09', 'makeup_required'), row('2026-09-10')], NOW, 1, [],
    );
    expect(statesOf(track)).toEqual(['completed', 'today-available', 'future', 'future', 'future', 'future', 'future']);
    expect(track.slots[0].date).toBe('2026-09-10');
    expect(track.slots.find((slot) => slot.date === '2026-09-09')).toBeUndefined();
  });

  it('late completed record stays a completion and is flagged isLate', () => {
    const track = deriveStreakTrack([row('2026-09-10', 'late', true)], NOW, 1, []);
    expect(track.slots[0].state).toBe('completed');
    expect(track.slots[0].isLate).toBe(true);
  });

  it('reward eligibility follows milestoneRewards and streak gate', () => {
    expect(deriveStreakTrack([row(TODAY)], NOW, 1, reward(false)).reward).toEqual({ claimed: false, canClaim: false, visible: false });
    expect(deriveStreakTrack([row('2026-09-10')], NOW, 7, reward(false)).reward).toEqual({ claimed: false, canClaim: true, visible: true });
    expect(deriveStreakTrack([row('2026-09-10')], NOW, 7, reward(true)).reward).toEqual({ claimed: true, canClaim: false, visible: true });
  });
});

describe('streakSlotLabel', () => {
  it('exposes per-state labels and the day-7 reward suffix', () => {
    const track = deriveStreakTrack([row('2026-09-10')], NOW, 1, []);
    expect(streakSlotLabel(track.slots[0])).toBe('Day 1，已完成');
    expect(streakSlotLabel(track.slots[1])).toBe('Day 2，今天可以報備');
    expect(streakSlotLabel(track.slots[6])).toBe('Day 7，尚未解鎖，連續報備獎勵');
  });
});
