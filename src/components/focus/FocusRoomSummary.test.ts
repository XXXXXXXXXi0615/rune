import { describe, expect, it } from 'vitest';
import { getFocusRoomSummaryMinutes } from './focusRoomSummary';

describe('TIDEBOUND room summary', () => {
  it('uses focus duration for focus rooms and selected break duration for break/rest rooms', () => {
    expect(getFocusRoomSummaryMinutes('computer', 25, 3)).toBe(25);
    expect(getFocusRoomSummaryMinutes('coffee', 40, 3)).toBe(40);
    expect(getFocusRoomSummaryMinutes('toilet', 25, 3)).toBe(3);
    expect(getFocusRoomSummaryMinutes('bed', 25, 3)).toBe(3);
  });
});
