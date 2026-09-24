import { describe, expect, it } from 'vitest';
import { deriveRecentCheckIns, formatCheckInAgeZh } from './checkInPresentation';
import type { CheckIn } from '@/features/tidewatch/types';

describe('formatCheckInAgeZh', () => {
  const now = new Date(2026, 7, 28, 12).getTime();
  it.each([[0, '剛剛'], [3, '3 分鐘前'], [23, '23 分鐘前'], [60, '1 小時前']])('localizes %i minutes', (minutes, expected) => {
    expect(formatCheckInAgeZh(now - minutes * 60_000, now)).toBe(expected);
  });
});

describe('deriveRecentCheckIns', () => {
  const entry = (id: string, createdAt: number, activity = 'working'): CheckIn => ({ id, createdAt, activity });
  it('caps at max and orders newest first even from unordered input', () => {
    expect(deriveRecentCheckIns([entry('a', 300), entry('b', 100), entry('c', 200), entry('d', 400)], 3).map((item) => item.id)).toEqual(['d', 'a', 'c']);
  });
  it('returns empty list for empty history and clamps max', () => {
    expect(deriveRecentCheckIns([], 3)).toEqual([]);
    expect(deriveRecentCheckIns([entry('a', 1)], 0)).toEqual([]);
  });
});
