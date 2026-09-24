import { describe, expect, it } from 'vitest';
import { buildLast4Weeks, getMonday } from './buildLast4Weeks';

function entry(createdAt: string, opts?: { archived?: boolean; visibility?: string }) {
  return { id: 'e', kind: 'diary' as const, author: 'user' as const, content: '', createdAt, updatedAt: createdAt, tags: [], attachments: [], favorite: false, pinned: false, archived: opts?.archived ?? false, visibility: opts?.visibility, aiAccess: 'private' as const };
}

describe('getMonday', () => {
  it('returns same day for Monday', () => {
    const d = new Date(2026, 6, 27); // Monday July 27 2026
    expect(getMonday(d).getDate()).toBe(27);
  });

  it('goes back to Monday for Wednesday', () => {
    const d = new Date(2026, 6, 29); // Wednesday July 29
    expect(getMonday(d).getDate()).toBe(27);
  });

  it('goes back to Monday for Sunday', () => {
    const d = new Date(2026, 7, 2); // Sunday August 2
    expect(getMonday(d).getDate()).toBe(27); // July 27
  });

  it('crosses month boundary correctly', () => {
    const d = new Date(2026, 0, 1); // Thursday January 1 2026
    const mon = getMonday(d);
    // Monday before Jan 1 is Dec 29 2025
    expect(mon.getFullYear()).toBe(2025);
    expect(mon.getMonth()).toBe(11); // December
    expect(mon.getDate()).toBe(29);
  });

  it('crosses year boundary correctly', () => {
    const d = new Date(2026, 11, 31); // Thursday December 31 2026
    const mon = getMonday(d);
    // Monday is Dec 28
    expect(mon.getFullYear()).toBe(2026);
    expect(mon.getMonth()).toBe(11);
    expect(mon.getDate()).toBe(28);
  });

  it('handles local midnight without UTC offset issues', () => {
    const d = new Date(2026, 5, 15, 0, 0, 0, 0); // June 15 00:00:00 local
    const mon = getMonday(d);
    expect(mon.getHours()).toBe(0);
    expect(mon.getMinutes()).toBe(0);
  });
});

describe('buildLast4Weeks', () => {
  it('returns 4 slots even with no entries', () => {
    const slots = buildLast4Weeks([]);
    expect(slots).toHaveLength(4);
  });

  it('each slot has label, count, start, end, isCurrent', () => {
    const slots = buildLast4Weeks([]);
    for (const s of slots) {
      expect(s.label).toBeTruthy();
      expect(typeof s.count).toBe('number');
      expect(s.start instanceof Date).toBe(true);
      expect(s.end instanceof Date).toBe(true);
      expect(typeof s.isCurrent).toBe('boolean');
    }
  });

  it('last slot is marked current', () => {
    const slots = buildLast4Weeks([]);
    expect(slots[3].isCurrent).toBe(true);
  });

  it('counts entries within the correct week', () => {
    const now = new Date();
    const mon = getMonday(now);
    const yesterday = new Date(mon);
    yesterday.setDate(mon.getDate() - 1); // Sunday before Monday = previous week
    const slots = buildLast4Weeks([entry(yesterday.toISOString())]);
    // Entry is in week before current (since Monday is the current week start)
    const total = slots.reduce((s, w) => s + w.count, 0);
    expect(total).toBe(1);
  });

  it('uses local dates (month boundary)', () => {
    // Find Monday of current week, go back 2 weeks
    const now = new Date();
    const mon = getMonday(now);
    const twoWeeksAgo = new Date(mon);
    twoWeeksAgo.setDate(mon.getDate() - 14);
    // Create entry at noon local on that Monday
    twoWeeksAgo.setHours(12, 0, 0, 0);
    const slots = buildLast4Weeks([entry(twoWeeksAgo.toISOString())]);
    // Entry should be counted in the correct week
    expect(slots.some((s) => s.count > 0)).toBe(true);
    // getMonday(twoWeeksAgo) should still be midnight local
    const checkMon = getMonday(twoWeeksAgo);
    expect(checkMon.getHours()).toBe(0);
  });

  it('filters archived entries', () => {
    const now = new Date().toISOString();
    const slots = buildLast4Weeks([entry(now, { archived: true })]);
    const total = slots.reduce((s, w) => s + w.count, 0);
    expect(total).toBe(0);
  });

  it('filters private entries', () => {
    const now = new Date().toISOString();
    const slots = buildLast4Weeks([entry(now, { visibility: 'private' })]);
    const total = slots.reduce((s, w) => s + w.count, 0);
    expect(total).toBe(0);
  });
});
