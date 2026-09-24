import { describe, expect, it } from 'vitest';
import { CHECKIN_ACTIVITY_LABELS, CHECKIN_QUICK_OPTIONS, CHECKIN_KNOWN_ACTIVITIES, deriveRecentCustomActivities, isCheckInKnown } from './activityOptions';
import type { CheckIn } from './types';

const entry = (activity: string, createdAt: number, id: string): CheckIn => ({ id, createdAt, activity });

describe('check-in activity options', () => {
  it('keeps exactly five presets plus custom, all backed by NOW labels', () => {
    expect(CHECKIN_QUICK_OPTIONS.map((option) => option.value)).toEqual(['working', 'studying', 'creating', 'exercising', 'resting']);
    expect(CHECKIN_QUICK_OPTIONS.every((option) => CHECKIN_ACTIVITY_LABELS[option.value])).toBe(true);
  });

  it('recognizes every canonical legacy activity as known', () => {
    expect(CHECKIN_KNOWN_ACTIVITIES.every(isCheckInKnown)).toBe(true);
    expect(isCheckInKnown('整理月潮')).toBe(false);
    expect(isCheckInKnown('')).toBe(false);
  });

  it('derives recent unique custom activities newest-first, ignoring presets and duplicates', () => {
    const now = 1_000_000;
    const checkIns = [
      entry('整理月潮', now, 'a'),
      entry('working', now - 1, 'b'),
      entry('修 Music 頁面', now - 2, 'c'),
      entry('整理月潮', now - 3, 'd'),
      entry('   ', now - 4, 'e'),
    ];
    expect(deriveRecentCustomActivities(checkIns, 3)).toEqual(['整理月潮', '修 Music 頁面']);
  });

  it('caps at max and survives unordered input', () => {
    const checkIns = [
      entry('c2', 200, 'x'),
      entry('c1', 300, 'y'),
      entry('c3', 100, 'z'),
      entry('c4', 50, 'w'),
    ];
    expect(deriveRecentCustomActivities(checkIns, 3)).toEqual(['c1', 'c2', 'c3']);
    expect(deriveRecentCustomActivities([], 3)).toEqual([]);
  });
});
