import { describe, expect, it } from 'vitest';
import { getActivityHeatmapDateKeys, getActivityHeatmapLevel, getActivityHeatmapRange } from '@/utils/activityHeatmap';
import { toLocalDateString } from '@/utils/date';

describe('activity heatmap date range', () => {
  const today = new Date(2026, 6, 16, 12, 0, 0);

  it('includes the current incomplete week through Sunday', () => {
    const range = getActivityHeatmapRange(today, 8);
    expect(toLocalDateString(range.startDate)).toBe('2026-05-25');
    expect(toLocalDateString(range.endDate)).toBe('2026-07-19');
    expect(getActivityHeatmapDateKeys(today, 8).slice(-8)).toEqual([
      '2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15',
      '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19',
    ]);
  });

  it('uses local date keys without UTC conversion', () => {
    const lateLocal = new Date(2026, 6, 16, 23, 59, 59);
    expect(toLocalDateString(lateLocal)).toBe('2026-07-16');
    expect(toLocalDateString(new Date(2026, 6, 17, 0, 0, 1))).toBe('2026-07-17');
  });

  it('marks only dates after today as future', () => {
    const keys = getActivityHeatmapDateKeys(today, 1);
    const todayIndex = keys.indexOf('2026-07-16');
    expect(keys.slice(todayIndex + 1)).toEqual(['2026-07-17', '2026-07-18', '2026-07-19']);
  });
});

describe('activity heatmap intensity', () => {
  it('maps real counts to deterministic levels', () => {
    expect([0, 1, 2, 3, 4, 6, 7, 20].map(getActivityHeatmapLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });
});
