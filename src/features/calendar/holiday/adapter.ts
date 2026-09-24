import type { HolidayOccurrence, HolidayProviderResult, HolidayRegion } from './types';

function compareOccurrences(a: HolidayOccurrence, b: HolidayOccurrence): number {
  const kindOrder = { public_holiday: 0, traditional_festival: 1, makeup_workday: 2, observance: 3 } as const;
  return a.dateKey.localeCompare(b.dateKey)
    || kindOrder[a.kind] - kindOrder[b.kind]
    || a.id.localeCompare(b.id);
}

function calendarDayDistance(fromDateKey: string, toDateKey: string): number {
  const parse = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Math.round((parse(toDateKey) - parse(fromDateKey)) / 86_400_000);
}

export function getHolidayYearStatus(result: HolidayProviderResult): HolidayProviderResult['status'] {
  return result.status;
}

export function getHolidayOccurrencesForDate(
  occurrences: readonly HolidayOccurrence[],
  dateKey: string,
): readonly HolidayOccurrence[] {
  return occurrences.filter((occurrence) => occurrence.dateKey === dateKey).toSorted(compareOccurrences);
}

export function getHolidayOccurrencesForRange(
  occurrences: readonly HolidayOccurrence[],
  fromDateKey: string,
  toDateKey: string,
): readonly HolidayOccurrence[] {
  if (fromDateKey > toDateKey) return [];
  return occurrences
    .filter((occurrence) => occurrence.dateKey >= fromDateKey && occurrence.dateKey <= toDateKey)
    .toSorted(compareOccurrences);
}

export type NextHoliday = Readonly<{ occurrence: HolidayOccurrence; daysUntil: number }>;

/**
 * A holiday countdown is derived only from public day-off occurrences. A
 * same-day festival is intentionally not merged into its legal day-off record.
 */
export function getNextHoliday(
  todayDateKey: string,
  region: HolidayRegion,
  occurrences: readonly HolidayOccurrence[],
): NextHoliday | null {
  const candidate = occurrences
    .filter((occurrence) => occurrence.region === region && occurrence.isDayOff && occurrence.dateKey >= todayDateKey)
    .toSorted(compareOccurrences)[0];
  return candidate ? { occurrence: candidate, daysUntil: calendarDayDistance(todayDateKey, candidate.dateKey) } : null;
}
