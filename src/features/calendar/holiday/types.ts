/**
 * Holiday is a read-only regional calendar domain. It intentionally does not
 * reuse CalendarEvent: user events and published holiday occurrences have
 * different authorship, provenance, and persistence contracts.
 */
export const HOLIDAY_REGIONS = ['CN', 'TW', 'HK', 'JP', 'US'] as const;

export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number];

export type HolidayKind =
  | 'public_holiday'
  | 'makeup_workday'
  | 'traditional_festival'
  | 'observance';

export type HolidayOccurrence = Readonly<{
  id: string;
  dateKey: string;
  region: HolidayRegion;
  kind: HolidayKind;
  name: string;
  isDayOff: boolean;
  isWorkdayOverride: boolean;
  sourceId: string;
  sourceYear: number;
}>;

export type HolidayProviderStatus = 'ready' | 'unavailable';

export type HolidayProviderResult = Readonly<{
  status: HolidayProviderStatus;
  region: HolidayRegion;
  year: number;
  occurrences: readonly HolidayOccurrence[];
}>;

export type HolidayProvenance = Readonly<{
  sourceId: string;
  region: HolidayRegion;
  year: number;
  issuer: string;
  title: string;
  officialUrl: string;
  publishedAt?: string;
  coverage: string;
  retrievedAt: string;
}>;

export function isHolidayRegion(value: unknown): value is HolidayRegion {
  return typeof value === 'string' && (HOLIDAY_REGIONS as readonly string[]).includes(value);
}
