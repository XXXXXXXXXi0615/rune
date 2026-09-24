import type { HolidayKind, HolidayOccurrence } from './types';

/**
 * Holiday day identity — Rune Calendar Phase 3B-4.1.
 *
 * A pure, derived presentation over the frozen `HolidayOccurrence` records:
 * nothing here persists, mutates, merges, or copies occurrences, and nothing
 * here calls the network or infers a region. The caller supplies the
 * occurrence set (typically the canonical region/year provider result) and the
 * selected calendar date; every field is computed from those records only.
 *
 * The provider contract stays authoritative: an empty occurrence set (region
 * `null`, unsupported region/year, unavailable provider) yields an empty
 * identity — never a guessed statutory state.
 *
 * Dates are compared as calendar date keys only.
 */

/** Statutory badges derived from occurrence kinds + flags. */
export type HolidayDayBadge = 'legal_day_off' | 'traditional_festival' | 'makeup_workday' | 'observance';

/** Badge wording (authoring copy; `補班` is never a day-off badge). */
export const HOLIDAY_DAY_BADGE_LABEL: Record<HolidayDayBadge, string> = {
  legal_day_off: '法定休假',
  traditional_festival: '傳統節慶',
  makeup_workday: '補班',
  observance: '紀念日',
};

/**
 * Identity line copy for one occurrence. A makeup workday is named by its
 * status — it must never read as a holiday or a day off.
 */
export function holidayIdentityLabel(occurrence: HolidayOccurrence): string {
  if (occurrence.kind === 'makeup_workday') return '調休上班';
  return occurrence.name;
}

/** Identity ranking: the festival names the day, the legal day off qualifies it. */
const IDENTITY_RANK: Record<HolidayKind, number> = {
  traditional_festival: 0,
  public_holiday: 1,
  makeup_workday: 2,
  observance: 3,
};

function compareIdentity(a: HolidayOccurrence, b: HolidayOccurrence): number {
  return IDENTITY_RANK[a.kind] - IDENTITY_RANK[b.kind] || a.id.localeCompare(b.id);
}

export interface HolidayDayIdentity {
  /** Canonical selected date key (`YYYY-MM-DD`). */
  date: string;
  /** Every occurrence of that date, identities preserved and unmerged. */
  occurrences: readonly HolidayOccurrence[];
  /** The occurrence that names the day (festival → day off → 補班 → observance). */
  primaryOccurrence: HolidayOccurrence | null;
  /** Identity-line copy per occurrence, in identity order. */
  labels: readonly string[];
  /** A statutory day off (public holiday with `isDayOff`, never a 補班). */
  isPublicDayOff: boolean;
  /** A makeup workday (`isWorkdayOverride`). */
  isWorkdayOverride: boolean;
  hasTraditionalFestival: boolean;
  hasObservance: boolean;
  /** Statutory badges, in presentation order; empty when nothing qualifies. */
  badges: readonly HolidayDayBadge[];
  /**
   * Contiguous public-day-off run containing this date, when the supplied
   * occurrence set covers it and the run is longer than one day. `null` for a
   * 補班 day, a festival-only day, or an isolated day off.
   */
  dayOffRange: Readonly<{ from: string; to: string }> | null;
}

const EMPTY_IDENTITY_FLAGS = {
  isPublicDayOff: false,
  isWorkdayOverride: false,
  hasTraditionalFestival: false,
  hasObservance: false,
  badges: [] as readonly HolidayDayBadge[],
};

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Day-off date keys inside the supplied set (public holidays only). */
function collectDayOffKeys(occurrences: readonly HolidayOccurrence[]): Set<string> {
  const keys = new Set<string>();
  for (const occurrence of occurrences) {
    if (occurrence.kind === 'public_holiday' && occurrence.isDayOff && !occurrence.isWorkdayOverride) {
      keys.add(occurrence.dateKey);
    }
  }
  return keys;
}

function resolveDayOffRange(dayOffKeys: ReadonlySet<string>, dateKey: string): Readonly<{ from: string; to: string }> | null {
  if (!dayOffKeys.has(dateKey)) return null;
  let from = dateKey;
  let to = dateKey;
  while (dayOffKeys.has(shiftDateKey(from, -1))) from = shiftDateKey(from, -1);
  while (dayOffKeys.has(shiftDateKey(to, 1))) to = shiftDateKey(to, 1);
  return from === to ? null : Object.freeze({ from, to });
}

/**
 * Derives the selected day's holiday identity from existing occurrences.
 * `occurrences` may be any set that contains the selected date's records
 * (the canonical region/year set is the expected input); records for other
 * dates are only used to resolve the contiguous day-off range.
 */
export function getHolidayIdentityForDate(
  occurrences: readonly HolidayOccurrence[],
  selectedDate: string,
): HolidayDayIdentity {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    return { date: selectedDate, occurrences: [], primaryOccurrence: null, labels: [], ...EMPTY_IDENTITY_FLAGS, dayOffRange: null };
  }
  const dayOccurrences = occurrences.filter((occurrence) => occurrence.dateKey === selectedDate).toSorted(compareIdentity);
  if (dayOccurrences.length === 0) {
    return { date: selectedDate, occurrences: [], primaryOccurrence: null, labels: [], ...EMPTY_IDENTITY_FLAGS, dayOffRange: null };
  }

  const isPublicDayOff = dayOccurrences.some((occurrence) => occurrence.kind === 'public_holiday' && occurrence.isDayOff && !occurrence.isWorkdayOverride);
  const isWorkdayOverride = dayOccurrences.some((occurrence) => occurrence.kind === 'makeup_workday' && occurrence.isWorkdayOverride);
  const hasTraditionalFestival = dayOccurrences.some((occurrence) => occurrence.kind === 'traditional_festival');
  const hasObservance = dayOccurrences.some((occurrence) => occurrence.kind === 'observance');

  const badges: HolidayDayBadge[] = [];
  if (isPublicDayOff) badges.push('legal_day_off');
  if (hasTraditionalFestival) badges.push('traditional_festival');
  if (isWorkdayOverride) badges.push('makeup_workday');
  if (hasObservance) badges.push('observance');

  return {
    date: selectedDate,
    occurrences: dayOccurrences,
    primaryOccurrence: dayOccurrences[0],
    labels: dayOccurrences.map(holidayIdentityLabel),
    isPublicDayOff,
    isWorkdayOverride,
    hasTraditionalFestival,
    hasObservance,
    badges,
    dayOffRange: isPublicDayOff ? resolveDayOffRange(collectDayOffKeys(occurrences), selectedDate) : null,
  };
}
