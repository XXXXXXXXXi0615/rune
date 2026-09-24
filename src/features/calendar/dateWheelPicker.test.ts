import { describe, expect, it } from 'vitest';
import { clampWheelDate } from '@/components/ui/DateWheelPicker';

describe('DateWheelPicker date validity', () => {
  it('clamps January 31 when moving into February', () => {
    expect(clampWheelDate(2026, 2, 31)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it('preserves February 29 in a leap year', () => {
    expect(clampWheelDate(2028, 2, 29)).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('clamps February 29 outside a leap year', () => {
    expect(clampWheelDate(2027, 2, 29)).toEqual({ year: 2027, month: 2, day: 28 });
  });
});
