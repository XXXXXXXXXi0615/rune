import { describe, expect, it } from 'vitest';
import { getHolidayYear } from './provider';
import { getHolidayIdentityForDate, HOLIDAY_DAY_BADGE_LABEL, holidayIdentityLabel } from './holidayDayIdentity';
import type { HolidayOccurrence } from './types';

/**
 * Calendar 3B-4.1 — pure selected-day holiday identity.
 * The canonical CN/2026 provider result is used as-is: nothing in these tests
 * writes, migrates, or fabricates holiday data.
 */

const cn2026 = getHolidayYear('CN', 2026);
if (cn2026.status !== 'ready') throw new Error('CN/2026 dataset must be available for these tests');
const occurrences = cn2026.occurrences;

const identity = (dateKey: string) => getHolidayIdentityForDate(occurrences, dateKey);

describe('holiday day identity — public day off', () => {
  it('2026-09-25 keeps both same-date occurrences and reads as a statutory day off', () => {
    const day = identity('2026-09-25');
    expect(day.occurrences).toHaveLength(2);
    expect(day.occurrences.map((occurrence) => occurrence.id).toSorted()).toEqual([
      'cn-2026-public-mid-autumn-09-25',
      'cn-2026-traditional-mid-autumn',
    ]);
    // Consolidated presentation: the festival names the day, the day off qualifies it.
    expect(day.primaryOccurrence?.kind).toBe('traditional_festival');
    expect(day.labels).toEqual([day.occurrences[0].name, day.occurrences[1].name]);
    expect(day.isPublicDayOff).toBe(true);
    expect(day.isWorkdayOverride).toBe(false);
    expect(day.hasTraditionalFestival).toBe(true);
    expect(day.hasObservance).toBe(false);
    expect(day.badges).toEqual(['legal_day_off', 'traditional_festival']);
    expect(day.badges.map((badge) => HOLIDAY_DAY_BADGE_LABEL[badge])).toEqual(['法定休假', '傳統節慶']);
    expect(day.dayOffRange).toEqual({ from: '2026-09-25', to: '2026-09-27' });
  });

  it('2026-09-26 is part of the Mid-Autumn run without inventing a festival', () => {
    const day = identity('2026-09-26');
    expect(day.occurrences).toHaveLength(1);
    expect(day.occurrences[0].kind).toBe('public_holiday');
    expect(day.isPublicDayOff).toBe(true);
    expect(day.hasTraditionalFestival).toBe(false);
    expect(day.badges).toEqual(['legal_day_off']);
    expect(day.dayOffRange).toEqual({ from: '2026-09-25', to: '2026-09-27' });
  });

  it('a single day off has no range copy (元旦 2026-01-01 starts a run, 清明 2026-04-04 too)', () => {
    expect(identity('2026-01-01').dayOffRange).toEqual({ from: '2026-01-01', to: '2026-01-03' });
    expect(identity('2026-04-05').dayOffRange).toEqual({ from: '2026-04-04', to: '2026-04-06' });
  });

  it('never mutates source occurrences', () => {
    const before = structuredClone(occurrences);
    identity('2026-09-25');
    identity('2026-09-20');
    expect(occurrences).toEqual(before);
    expect(Object.isFrozen(occurrences)).toBe(true);
  });
});

describe('holiday day identity — makeup workday', () => {
  for (const dateKey of ['2026-09-20', '2026-10-10']) {
    it(`${dateKey} reads as 調休上班 and never as a day off`, () => {
      const day = identity(dateKey);
      expect(day.occurrences).toHaveLength(1);
      expect(day.occurrences[0].kind).toBe('makeup_workday');
      expect(day.isPublicDayOff).toBe(false);
      expect(day.isWorkdayOverride).toBe(true);
      expect(day.hasTraditionalFestival).toBe(false);
      expect(day.hasObservance).toBe(false);
      expect(day.badges).toEqual(['makeup_workday']);
      expect(HOLIDAY_DAY_BADGE_LABEL[day.badges[0]]).toBe('補班');
      // The identity line is the status phrase — not the dataset's holiday name.
      expect(day.labels).toEqual(['調休上班']);
      // 調休上班 is the 3B-4.1 status wording; no day-off claim may appear with it.
      expect(day.labels.join('')).not.toContain('放假');
      expect(day.badges).not.toContain('legal_day_off');
      expect(day.badges.map((badge) => HOLIDAY_DAY_BADGE_LABEL[badge])).not.toContain('法定休假');
      expect(day.dayOffRange).toBeNull();
    });
  }

  it('labels a 補班 occurrence by status while other kinds keep their canonical name', () => {
    const makeup = occurrences.find((occurrence) => occurrence.kind === 'makeup_workday')!;
    expect(holidayIdentityLabel(makeup)).toBe('調休上班');
    const festival = occurrences.find((occurrence) => occurrence.kind === 'traditional_festival')!;
    expect(holidayIdentityLabel(festival)).toBe(festival.name);
  });
});

describe('holiday day identity — observance', () => {
  it('2026-12-25 is an observance and never a statutory day off', () => {
    const day = identity('2026-12-25');
    expect(day.occurrences).toHaveLength(1);
    expect(day.occurrences[0].kind).toBe('observance');
    expect(day.isPublicDayOff).toBe(false);
    expect(day.isWorkdayOverride).toBe(false);
    expect(day.hasObservance).toBe(true);
    expect(day.badges).toEqual(['observance']);
    expect(day.badges).not.toContain('legal_day_off');
    expect(day.dayOffRange).toBeNull();
  });
});

describe('holiday day identity — unsupported data', () => {
  it('an unsupported year yields no identity from its provider result', () => {
    const result = getHolidayYear('CN', 2027);
    expect(result.status).toBe('unavailable');
    const day = getHolidayIdentityForDate(result.occurrences, '2027-09-25');
    expect(day.occurrences).toEqual([]);
    expect(day.primaryOccurrence).toBeNull();
    expect(day.labels).toEqual([]);
    expect(day.badges).toEqual([]);
    expect(day.isPublicDayOff).toBe(false);
    expect(day.isWorkdayOverride).toBe(false);
    expect(day.dayOffRange).toBeNull();
  });

  it('an unsupported region yields no identity', () => {
    for (const region of ['TW', 'HK', 'JP', 'US'] as const) {
      const result = getHolidayYear(region, 2026);
      expect(result.status).toBe('unavailable');
      expect(getHolidayIdentityForDate(result.occurrences, '2026-09-25').occurrences).toEqual([]);
    }
  });

  it('an occurrence-free set and a malformed date key both stay empty', () => {
    const empty = getHolidayIdentityForDate([], '2026-09-25');
    expect(empty.occurrences).toEqual([]);
    expect(empty.badges).toEqual([]);
    expect(empty.dayOffRange).toBeNull();
    const malformed = getHolidayIdentityForDate(occurrences, '2026-09');
    expect(malformed.occurrences).toEqual([]);
    expect(malformed.badges).toEqual([]);
  });
});

describe('holiday day identity — selected-date switching', () => {
  it('switches identity with the canonical selected date without touching storage', () => {
    const dayOff = identity('2026-09-25');
    const workday = identity('2026-09-20');
    const observance = identity('2026-12-25');
    const plain = identity('2026-09-22');
    expect([dayOff.isPublicDayOff, workday.isWorkdayOverride, observance.hasObservance]).toEqual([true, true, true]);
    expect(plain.occurrences).toEqual([]);
    expect(plain.badges).toEqual([]);
    expect(plain.date).toBe('2026-09-22');
  });

  it('accepts a partial occurrence set (the selected date only) and preserves its records', () => {
    const dayOnly: HolidayOccurrence[] = occurrences.filter((occurrence) => occurrence.dateKey === '2026-09-25');
    const day = getHolidayIdentityForDate(dayOnly, '2026-09-25');
    expect(day.occurrences).toHaveLength(2);
    expect(day.badges).toEqual(['legal_day_off', 'traditional_festival']);
    // The range needs neighbouring days, so a partial set resolves it as null.
    expect(day.dayOffRange).toBeNull();
  });
});
