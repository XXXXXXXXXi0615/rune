import { beforeEach, describe, expect, it } from 'vitest';
import { holidayCountdownCopy, selectUpcomingHoliday } from './HolidayCountdownSection';
import { useAppStore } from '@/store/useAppStore';

/**
 * Phase 3B-4 — upcoming holiday countdown contract.
 * Composes the frozen provider + getNextHoliday only: public day-offs, no
 * makeup workdays, no fallback/inference, no persistence.
 */

describe('Upcoming holiday countdown', () => {
  beforeEach(() => {
    useAppStore.setState({ holidayRegion: null, customEvents: [] });
    localStorage.removeItem('lunartide_data');
  });

  it('CN/2026 returns the correct next public day off', () => {
    const next = selectUpcomingHoliday('CN', '2026-09-22');
    expect(next?.occurrence).toMatchObject({ id: 'cn-2026-public-mid-autumn-09-25', name: '中秋节假期', kind: 'public_holiday', isDayOff: true });
    expect(next?.daysUntil).toBe(3);
  });

  it('covers D-3 / D-1 / D0 and the general copy rule', () => {
    expect(selectUpcomingHoliday('CN', '2026-09-22')?.daysUntil).toBe(3);
    expect(holidayCountdownCopy(3)).toBe('還有 3 天');
    expect(selectUpcomingHoliday('CN', '2026-09-24')?.daysUntil).toBe(1);
    expect(holidayCountdownCopy(1)).toBe('明天');
    expect(selectUpcomingHoliday('CN', '2026-09-25')?.daysUntil).toBe(0);
    expect(holidayCountdownCopy(0)).toBe('今天');
    expect(holidayCountdownCopy(24)).toBe('還有 24 天');
    expect(holidayCountdownCopy(2)).toBe('還有 2 天');
  });

  it('excludes makeup workdays from the main countdown', () => {
    // 2026-09-20 is 国庆节调休补班 (isDayOff false) — the countdown skips it.
    const next = selectUpcomingHoliday('CN', '2026-09-19');
    expect(next?.occurrence.dateKey).toBe('2026-09-25');
    expect(next?.occurrence.kind).toBe('public_holiday');
    expect(next?.daysUntil).toBe(6);
    for (const today of ['2026-01-01', '2026-02-13', '2026-09-19', '2026-09-30']) {
      expect(selectUpcomingHoliday('CN', today)?.occurrence.kind).not.toBe('makeup_workday');
    }
  });

  it('hides quietly for a null region, an unsupported region and an unsupported year', () => {
    expect(selectUpcomingHoliday(null, '2026-09-22')).toBeNull();
    expect(selectUpcomingHoliday('TW', '2026-09-22')).toBeNull();
    expect(selectUpcomingHoliday('CN', '2027-01-05')).toBeNull();
    // Past the last 2026 day off there is no next occurrence in the dataset.
    expect(selectUpcomingHoliday('CN', '2026-12-26')).toBeNull();
  });

  it('writes nothing: no customEvents, no storage keys, no holiday records', () => {
    const events = [{ id: 'evt-keep', date: '2026-09-25', title: '保留事件' }];
    useAppStore.setState({ customEvents: events as never, holidayRegion: 'CN' });
    const keysBefore = Object.keys(localStorage).sort();
    for (let day = 1; day <= 28; day += 1) selectUpcomingHoliday('CN', `2026-09-${String(day).padStart(2, '0')}`);
    expect(useAppStore.getState().customEvents).toEqual(events);
    expect(Object.keys(localStorage).sort()).toEqual(keysBefore);
    expect(Object.keys(localStorage).some((key) => /holiday/i.test(key))).toBe(false);
    expect(localStorage.getItem('lunartide-countdown-v1')).toBeNull();
  });
});
