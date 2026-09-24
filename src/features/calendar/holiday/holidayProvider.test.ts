import { beforeEach, describe, expect, it } from 'vitest';
import { getHolidayOccurrencesForDate, getHolidayOccurrencesForRange, getNextHoliday } from './adapter';
import { HOLIDAY_PROVENANCE_BY_ID } from './data/provenance';
import { getHolidayYear, validateHolidayDataset } from './provider';
import { createDefaultStore, normalizeStore } from '@/store/storage';
import { useAppStore } from '@/store/useAppStore';

const cn2026 = getHolidayYear('CN', 2026);

describe('Calendar Holiday Provider — CN 2026 vertical slice', () => {
  beforeEach(() => {
    useAppStore.setState({ holidayRegion: null, customEvents: [] });
    localStorage.removeItem('lunartide_data');
  });

  it('is ready only for CN 2026 and preserves an explicit unavailable state otherwise', () => {
    expect(cn2026.status).toBe('ready');
    expect(cn2026.occurrences).toHaveLength(43);
    expect(getHolidayYear('CN', 2027)).toEqual({ status: 'unavailable', region: 'CN', year: 2027, occurrences: [] });
    for (const region of ['TW', 'HK', 'JP', 'US'] as const) {
      expect(getHolidayYear(region, 2026)).toEqual({ status: 'unavailable', region, year: 2026, occurrences: [] });
    }
  });

  it('validates every CN record, provenance reference, and mutually exclusive workday flags', () => {
    expect(validateHolidayDataset(cn2026.occurrences, { region: 'CN', year: 2026 })).toEqual([]);
    expect(new Set(cn2026.occurrences.map((occurrence) => occurrence.id)).size).toBe(cn2026.occurrences.length);
    for (const occurrence of cn2026.occurrences) {
      expect(occurrence.dateKey).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(occurrence.region).toBe('CN');
      expect(occurrence.sourceYear).toBe(2026);
      expect(HOLIDAY_PROVENANCE_BY_ID.get(occurrence.sourceId)).toBeDefined();
      if (occurrence.kind === 'makeup_workday') expect(occurrence).toMatchObject({ isDayOff: false, isWorkdayOverride: true });
      if (occurrence.kind === 'public_holiday') expect(occurrence).toMatchObject({ isDayOff: true, isWorkdayOverride: false });
    }
  });

  it('keeps traditional festivals and legal days off as independent same-date occurrences', () => {
    const lunarNewYear = getHolidayOccurrencesForDate(cn2026.occurrences, '2026-02-17');
    expect(lunarNewYear.map((occurrence) => occurrence.kind)).toEqual(['public_holiday', 'traditional_festival']);
    expect(lunarNewYear.map((occurrence) => occurrence.name)).toEqual(['春节假期', '春节']);
  });

  it('keeps Christmas as a non-day-off observance', () => {
    expect(getHolidayOccurrencesForDate(cn2026.occurrences, '2026-12-25')).toEqual([
      expect.objectContaining({ kind: 'observance', name: '圣诞节', isDayOff: false, isWorkdayOverride: false }),
    ]);
  });

  it('projects exact dates and inclusive ranges without creating a second month model', () => {
    expect(getHolidayOccurrencesForDate(cn2026.occurrences, '2026-01-04')).toEqual([
      expect.objectContaining({ kind: 'makeup_workday', isWorkdayOverride: true }),
    ]);
    expect(getHolidayOccurrencesForRange(cn2026.occurrences, '2026-09-25', '2026-09-27')).toHaveLength(4);
    expect(getHolidayOccurrencesForRange(cn2026.occurrences, '2026-09-27', '2026-09-25')).toEqual([]);
  });

  it('derives next public day off deterministically for D-3, D-1, D0, and past exclusions', () => {
    expect(getNextHoliday('2025-12-29', 'CN', cn2026.occurrences)).toMatchObject({ occurrence: { dateKey: '2026-01-01' }, daysUntil: 3 });
    expect(getNextHoliday('2025-12-31', 'CN', cn2026.occurrences)).toMatchObject({ occurrence: { dateKey: '2026-01-01' }, daysUntil: 1 });
    expect(getNextHoliday('2026-01-01', 'CN', cn2026.occurrences)).toMatchObject({ occurrence: { dateKey: '2026-01-01' }, daysUntil: 0 });
    expect(getNextHoliday('2026-01-04', 'CN', cn2026.occurrences)).toMatchObject({ occurrence: { dateKey: '2026-02-15' }, daysUntil: 42 });
    expect(getNextHoliday('2026-12-26', 'CN', cn2026.occurrences)).toBeNull();
  });

  it('has no Calendar event writes or countdown persistence side effect', () => {
    const beforeEvents = structuredClone(useAppStore.getState().customEvents);
    const beforeStorage = localStorage.getItem('lunartide_data');
    getNextHoliday('2025-12-31', 'CN', cn2026.occurrences);
    expect(useAppStore.getState().customEvents).toEqual(beforeEvents);
    expect(localStorage.getItem('lunartide_data')).toBe(beforeStorage);
  });

  it('defaults holidayRegion to null and persists an explicit canonical choice through hydration', () => {
    expect(createDefaultStore().holidayRegion).toBeNull();
    useAppStore.getState().setHolidayRegion('CN');
    expect(useAppStore.getState().holidayRegion).toBe('CN');
    const persisted = JSON.parse(localStorage.getItem('lunartide_data') || '{}');
    expect(persisted.state.holidayRegion).toBe('CN');
    expect(normalizeStore(persisted.state).holidayRegion).toBe('CN');
    expect(normalizeStore({ holidayRegion: 'invalid' as never }).holidayRegion).toBeNull();
  });
});
