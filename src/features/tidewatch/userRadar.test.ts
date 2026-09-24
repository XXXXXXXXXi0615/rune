import { describe, expect, it } from 'vitest';
import { selectUserRadarSummary } from './userRadar';
import type { CheckIn, WritingTelemetryEvent } from './types';

const now = new Date(2026, 7, 28, 12).getTime();
const day = 86_400_000;
const checkIn = (daysAgo: number, value: number): CheckIn => ({ id: String(daysAgo), createdAt: now - daysAgo * day, activity: 'working', mood: value, energy: value, focus: value });
const writing = (daysAgo: number, chars: number): WritingTelemetryEvent => ({ id: `w${daysAgo}`, timestamp: now - daysAgo * day, actor: 'user', surface: 'chat', inputChars: chars, committedChars: chars });

describe('selectUserRadarSummary', () => {
  it('keeps axes absent when fewer than three distinct check-in days exist', () => {
    const result = selectUserRadarSummary([checkIn(0, 5), checkIn(1, 1)], [], [], now);
    expect(result).toMatchObject({ distinctCheckInDays: 2, sufficient: false });
    expect(result.axes.every((axis) => axis.value === null)).toBe(true);
  });

  it('normalizes check-ins and compares writing with the user historical baseline deterministically', () => {
    const result = selectUserRadarSummary(
      [checkIn(0, 5), checkIn(1, 3), checkIn(2, 1)],
      [],
      [writing(0, 200), writing(1, 200), writing(2, 300), writing(7, 100), writing(8, 100), writing(9, 100), writing(10, 100), writing(11, 100), writing(12, 100), writing(13, 100)],
      now,
    );
    expect(result.axes.map((axis) => axis.value)).toEqual([50, 50, 50, 43, 50]);
    expect(result.writingBaselineStatus).toBe('ready');
  });

  it('does not fabricate neutral writing activity before a committed historical baseline exists', () => {
    const result = selectUserRadarSummary([checkIn(0, 5), checkIn(1, 3), checkIn(2, 1)], [], [writing(0, 700)], now);
    expect(result).toMatchObject({ sufficient: true, writingBaselineStatus: 'forming' });
    expect(result.axes.find((axis) => axis.id === 'writing')?.value).toBeNull();
  });
});
