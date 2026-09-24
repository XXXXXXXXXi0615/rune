import { describe, expect, it } from 'vitest';
import { deriveWaterProgress, ritualMarkVariant } from './dailyRitualPresentation';

describe('daily ritual presentation truth', () => {
  it.each([[0, 0], [500, 25], [1000, 50], [1500, 75], [2000, 100], [2500, 100]])(
    'maps %i / 2000 ml to %i%% without clamping the canonical total',
    (total, expected) => expect(deriveWaterProgress(total, 2000)).toBe(expected),
  );

  it('derives stable hand-drawn variants from dateKey', () => {
    expect(ritualMarkVariant('2026-08-13')).toEqual(ritualMarkVariant('2026-08-13'));
    expect(ritualMarkVariant('2026-08-13')).not.toEqual(ritualMarkVariant('2026-08-14'));
  });
});
