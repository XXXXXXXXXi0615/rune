import { describe, expect, it } from 'vitest';
import { CHECKIN_NUDGE_SNOOZE_KEY, checkInSuppressionKey, shouldShowCheckInNudge } from './checkInNudgePolicy';

describe('check-in nudge policy', () => {
  const now = new Date(2026, 7, 28, 12).getTime();
  const latest = { id: 'c', createdAt: now - 3 * 60 * 60 * 1000, activity: 'working' };
  it('shows only for an old check-in without overlay or silence window', () => {
    expect(shouldShowCheckInNudge({ latest, snoozedUntil: {}, overlayBlocked: false, now })).toBe(true);
    expect(shouldShowCheckInNudge({ latest, snoozedUntil: {}, overlayBlocked: true, now })).toBe(false);
    expect(shouldShowCheckInNudge({ latest: { ...latest, createdAt: now - 30_000 }, snoozedUntil: {}, overlayBlocked: false, now })).toBe(false);
  });
  it('honors snooze and current-day suppression without permanent disablement', () => {
    expect(shouldShowCheckInNudge({ latest, snoozedUntil: { [CHECKIN_NUDGE_SNOOZE_KEY]: now + 1 }, overlayBlocked: false, now })).toBe(false);
    expect(shouldShowCheckInNudge({ latest, snoozedUntil: { [checkInSuppressionKey(new Date(now))]: now + 1 }, overlayBlocked: false, now })).toBe(false);
    expect(shouldShowCheckInNudge({ latest, snoozedUntil: { [checkInSuppressionKey(new Date(now - 86_400_000))]: now + 1 }, overlayBlocked: false, now })).toBe(true);
  });
});
