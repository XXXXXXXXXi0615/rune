import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildHolidayDateMap,
  getHolidayOccurrencesForMonth,
  holidayMarkKind,
  holidayOccurrenceLabel,
  projectHolidayDate,
  projectHolidayMonth,
} from './holidayProjection';
import { getHolidayYear } from './provider';
import { useAppStore } from '@/store/useAppStore';

/**
 * Phase 3B-2 — read-only holiday projection contract.
 * The frozen provider (Phase 3B-1) is consumed as-is; this suite proves the
 * projection adds presentation only: no inference, no fallback, no writes.
 */

const cn2026 = getHolidayYear('CN', 2026);

describe('Holiday read-only projection', () => {
  beforeEach(() => {
    useAppStore.setState({ holidayRegion: null, customEvents: [] });
    localStorage.removeItem('lunartide_data');
  });

  it('1. projects nothing when holidayRegion is null (no fallback inference)', () => {
    expect(projectHolidayMonth({ region: null, year: 2026, month: 9 }).size).toBe(0);
    expect(projectHolidayDate({ region: null, dateKey: '2026-09-25' })).toEqual([]);
    expect(projectHolidayMonth({ region: null, year: 2026, month: 9, providerResult: cn2026 }).size).toBe(0);
  });

  it('2. projects the ready CN/2026 dataset for the visible month', () => {
    const september = projectHolidayMonth({ region: 'CN', year: 2026, month: 9 });
    expect([...september.keys()].toSorted()).toEqual(['2026-09-20', '2026-09-25', '2026-09-26', '2026-09-27']);
    expect(getHolidayOccurrencesForMonth(cn2026.occurrences, 2026, 9)).toHaveLength(5);
    expect(getHolidayOccurrencesForMonth(cn2026.occurrences, 2026, 1)[0]?.dateKey).toBe('2026-01-01');
  });

  it('3. unsupported year or region projects an empty result', () => {
    expect(projectHolidayMonth({ region: 'CN', year: 2027, month: 1 }).size).toBe(0);
    expect(projectHolidayDate({ region: 'CN', dateKey: '2027-01-01' })).toEqual([]);
    expect(projectHolidayMonth({ region: 'TW', year: 2026, month: 9 }).size).toBe(0);
    expect(projectHolidayDate({ region: 'US', dateKey: '2026-09-25' })).toEqual([]);
  });

  it('4. public day off projects on its exact calendar date', () => {
    const [occurrence] = projectHolidayDate({ region: 'CN', dateKey: '2026-09-26' });
    expect(occurrence).toMatchObject({ kind: 'public_holiday', name: '中秋节假期', isDayOff: true, isWorkdayOverride: false });
    expect(holidayMarkKind(occurrence)).toBe('rest');
  });

  it('5. makeup workday is a workday override and never a day off', () => {
    const [occurrence] = projectHolidayDate({ region: 'CN', dateKey: '2026-09-20' });
    expect(occurrence).toMatchObject({ kind: 'makeup_workday', isDayOff: false, isWorkdayOverride: true });
    expect(holidayMarkKind(occurrence)).toBe('work');
    expect(holidayOccurrenceLabel(occurrence)).toBe('国庆节调休补班（補班）');
  });

  it('6. same-date public holiday and traditional festival keep separate identities', () => {
    const sameDay = projectHolidayDate({ region: 'CN', dateKey: '2026-09-25' });
    expect(sameDay.map((occurrence) => occurrence.kind)).toEqual(['public_holiday', 'traditional_festival']);
    expect(sameDay.map((occurrence) => occurrence.id)).toEqual(['cn-2026-public-mid-autumn-09-25', 'cn-2026-traditional-mid-autumn']);
    const bucket = projectHolidayMonth({ region: 'CN', year: 2026, month: 9 }).get('2026-09-25');
    expect(bucket).toHaveLength(2);
    expect(bucket).toEqual(sameDay);
  });

  it('7. observance remains a non-day-off informational occurrence', () => {
    const [occurrence] = projectHolidayDate({ region: 'CN', dateKey: '2026-12-25' });
    expect(occurrence).toMatchObject({ kind: 'observance', name: '圣诞节', isDayOff: false, isWorkdayOverride: false });
    expect(holidayMarkKind(occurrence)).toBe('observance');
  });

  it('8. the inspector projection receives every same-date occurrence', () => {
    const project = projectHolidayDate({ region: 'CN', dateKey: '2026-09-25' });
    const viaProvider = cn2026.occurrences.filter((occurrence) => occurrence.dateKey === '2026-09-25');
    expect(project).toHaveLength(viaProvider.length);
    expect(project.map((occurrence) => occurrence.id)).toEqual(viaProvider.map((occurrence) => occurrence.id));
  });

  it('9. projections never mutate the frozen source arrays', () => {
    const before = structuredClone(cn2026.occurrences);
    expect(Object.isFrozen(cn2026.occurrences)).toBe(true);
    buildHolidayDateMap(cn2026.occurrences);
    getHolidayOccurrencesForMonth(cn2026.occurrences, 2026, 2);
    projectHolidayMonth({ region: 'CN', year: 2026, month: 2 });
    projectHolidayDate({ region: 'CN', dateKey: '2026-02-17' });
    expect(cn2026.occurrences).toEqual(before);
    // Grouping is by reference, never a rewritten copy of the source record.
    const bucket = buildHolidayDateMap(cn2026.occurrences).get('2026-02-17');
    expect(bucket?.[0]).toBe(cn2026.occurrences.find((occurrence) => occurrence.id === bucket?.[0]?.id));
  });

  it('10. customEvents and 11. persisted state stay untouched by projection', () => {
    const events = [{ id: 'evt-keep', date: '2026-09-25', title: '保留事件' }];
    useAppStore.setState({ customEvents: events as never });
    const storageBefore = localStorage.getItem('lunartide_data');
    const keysBefore = Object.keys(localStorage).filter((key) => /holiday/i.test(key));

    for (let month = 1; month <= 12; month += 1) projectHolidayMonth({ region: 'CN', year: 2026, month });
    projectHolidayDate({ region: 'CN', dateKey: '2026-09-25' });

    expect(useAppStore.getState().customEvents).toEqual(events);
    expect(localStorage.getItem('lunartide_data')).toBe(storageBefore);
    expect(Object.keys(localStorage).filter((key) => /holiday/i.test(key))).toEqual(keysBefore);
    expect(keysBefore).toEqual([]);
  });

  it('rejects a mismatched provider result instead of guessing', () => {
    expect(projectHolidayMonth({ region: 'CN', year: 2026, month: 9, providerResult: getHolidayYear('CN', 2027) }).size).toBe(0);
    expect(projectHolidayDate({ region: 'CN', dateKey: '2026-09-25', providerResult: getHolidayYear('CN', 2027) })).toEqual([]);
  });
});
