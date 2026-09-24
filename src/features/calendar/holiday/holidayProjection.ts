import { getHolidayOccurrencesForDate, getHolidayOccurrencesForRange } from './adapter';
import { getHolidayYear } from './provider';
import type { HolidayKind, HolidayOccurrence, HolidayProviderResult, HolidayRegion } from './types';

/**
 * Holiday read-only projection layer — Rune Calendar Phase 3B-2.
 *
 * Pure derived presentation over the frozen Holiday provider contract:
 * no storage writes, no network, no fallback inference, no region guessing.
 * `holidayRegion === null` and `status === 'unavailable'` both project to an
 * empty result — the layer never infers CN, never falls back to a previous
 * year, never computes lunar dates, and never fabricates data.
 *
 * Dates are compared as calendar date keys only; occurrence dates are never
 * converted through timezone timestamps.
 */

/** Date-key → occurrences for that date (occurrence identities preserved). */
export type HolidayDateMap = ReadonlyMap<string, readonly HolidayOccurrence[]>;

export const HOLIDAY_KIND_LABEL: Record<HolidayKind, string> = {
  public_holiday: '公眾假期',
  makeup_workday: '調休補班',
  traditional_festival: '傳統節日',
  observance: '紀念日',
};

/** All occurrences of one month (1–12), calendar-key comparison only. */
export function getHolidayOccurrencesForMonth(
  occurrences: readonly HolidayOccurrence[],
  year: number,
  month: number,
): readonly HolidayOccurrence[] {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return getHolidayOccurrencesForRange(occurrences, `${monthKey}-01`, `${monthKey}-31`);
}

/**
 * Groups occurrences by dateKey. Every occurrence keeps its own identity —
 * a same-date public holiday and traditional festival stay separate entries.
 */
export function buildHolidayDateMap(occurrences: readonly HolidayOccurrence[]): HolidayDateMap {
  const map = new Map<string, readonly HolidayOccurrence[]>();
  for (const occurrence of occurrences) {
    // Per-date adapter ordering keeps the frozen provider ordering contract.
    if (!map.has(occurrence.dateKey)) map.set(occurrence.dateKey, getHolidayOccurrencesForDate(occurrences, occurrence.dateKey));
  }
  return map;
}

export interface HolidayMonthProjectionInput {
  region: HolidayRegion | null;
  year: number;
  /** 1–12 (the visible month of the month surface). */
  month: number;
  /** Deterministic injection for tests; defaults to the frozen provider. */
  providerResult?: HolidayProviderResult;
}

/** Month projection: null region or unavailable provider → empty map. */
export function projectHolidayMonth({ region, year, month, providerResult }: HolidayMonthProjectionInput): HolidayDateMap {
  if (!region) return new Map();
  const result = providerResult ?? getHolidayYear(region, year);
  if (result.status !== 'ready' || result.region !== region || result.year !== year) return new Map();
  return buildHolidayDateMap(getHolidayOccurrencesForMonth(result.occurrences, year, month));
}

export interface HolidayDateProjectionInput {
  region: HolidayRegion | null;
  dateKey: string;
  providerResult?: HolidayProviderResult;
}

/** Selected-date projection: null region or unavailable provider → empty list. */
export function projectHolidayDate({ region, dateKey, providerResult }: HolidayDateProjectionInput): readonly HolidayOccurrence[] {
  if (!region || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
  const year = Number(dateKey.slice(0, 4));
  const result = providerResult ?? getHolidayYear(region, year);
  if (result.status !== 'ready' || result.region !== region || result.year !== year) return [];
  return getHolidayOccurrencesForDate(result.occurrences, dateKey);
}

/** Marker semantics for the month cell (day-off and override stay distinct). */
export type HolidayMarkKind = 'rest' | 'work' | 'festival' | 'observance';

export function holidayMarkKind(occurrence: HolidayOccurrence): HolidayMarkKind {
  if (occurrence.kind === 'public_holiday' && occurrence.isDayOff) return 'rest';
  if (occurrence.kind === 'makeup_workday' && occurrence.isWorkdayOverride) return 'work';
  if (occurrence.kind === 'traditional_festival') return 'festival';
  return 'observance';
}

/** Accessible label for one occurrence (never implies a day off for 補班). */
export function holidayOccurrenceLabel(occurrence: HolidayOccurrence): string {
  if (occurrence.kind === 'makeup_workday') return `${occurrence.name}（補班）`;
  return occurrence.name;
}
