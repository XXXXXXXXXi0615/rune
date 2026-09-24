import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { formatDateStr } from '@/calendar/core';
import { getNextHoliday, type NextHoliday } from '@/features/calendar/holiday/adapter';
import { getHolidayYear } from '@/features/calendar/holiday/provider';
import { getHolidayIdentityForDate } from '@/features/calendar/holiday/holidayDayIdentity';
import type { HolidayRegion } from '@/features/calendar/holiday/types';

/**
 * Calendar Phase 3B-4 — Upcoming Holiday Countdown (read-only).
 *
 * Composes only the frozen holiday pieces: the canonical `holidayRegion`
 * preference, the frozen provider, and `getNextHoliday()` (which already
 * considers public day-off occurrences only — makeup workdays are excluded by
 * the frozen helper). Nothing is persisted, nothing is inferred, no fallback
 * region or previous-year lookup, and no CountdownEvent is created.
 *
 * Copy contract: 0 → 今天 · 1 → 明天 · otherwise 還有 N 天.
 *
 * Calendar C3 (subsection A) — when the Day Inspector is presenting a selected
 * date that already falls inside the same holiday span this card is counting
 * down to, the card is suppressed: the compact inspector-header identity
 * (`HolidayDayIdentity`) already states that holiday, so the card would only
 * repeat it. `getNextHoliday` semantics are untouched — the card still counts
 * down to the same occurrence, it is simply not drawn for that selected date.
 */

export function holidayCountdownCopy(daysUntil: number): string {
  if (daysUntil <= 0) return '今天';
  if (daysUntil === 1) return '明天';
  return `還有 ${daysUntil} 天`;
}

/** Pure selector: null region / unavailable provider / no upcoming day off → null. */
export function selectUpcomingHoliday(region: HolidayRegion | null, todayKey: string): NextHoliday | null {
  if (!region) return null;
  const year = Number(todayKey.slice(0, 4));
  const result = getHolidayYear(region, year);
  if (result.status !== 'ready') return null;
  return getNextHoliday(todayKey, region, result.occurrences);
}

/**
 * C3 — is the selected date inside the same holiday span the card counts down to?
 *
 * The span is the contiguous public-day-off run that contains the upcoming
 * occurrence (the same run `HolidayDayIdentity` reports as `dayOffRange`), so a
 * date anywhere inside 9/25–9/27 suppresses a card counting down to 9/25.
 * Returns false for a null region, an unavailable provider, a date in a
 * different holiday, a 補班 day, or an isolated single-day holiday that is not
 * the counted-down date itself.
 */
export function isSameHolidaySpan(
  region: HolidayRegion | null,
  selectedDate: string,
  next: NextHoliday,
): boolean {
  if (!region) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return false;
  if (selectedDate === next.occurrence.dateKey) return true;
  const result = getHolidayYear(region, Number(selectedDate.slice(0, 4)));
  if (result.status !== 'ready') return false;
  const range = getHolidayIdentityForDate(result.occurrences, selectedDate).dayOffRange;
  if (!range) return false;
  return range.from <= next.occurrence.dateKey && next.occurrence.dateKey <= range.to;
}

export function HolidayCountdownSection({ selectedDate }: { selectedDate?: string } = {}) {
  const holidayRegion = useAppStore((state) => state.holidayRegion);
  const todayKey = formatDateStr(new Date());
  const next = useMemo(() => selectUpcomingHoliday(holidayRegion, todayKey), [holidayRegion, todayKey]);
  const sameSpan = useMemo(
    () => (next && selectedDate ? isSameHolidaySpan(holidayRegion, selectedDate, next) : false),
    [next, selectedDate, holidayRegion],
  );
  if (!next || sameSpan) return null;

  return (
    <section className="calendar-holiday-countdown" data-testid="holiday-countdown" aria-label="下一個節假日">
      <h3 className="calendar-holiday-countdown-title">下一個節假日</h3>
      <article
        className="calendar-holiday-countdown-card"
        data-holiday-id={next.occurrence.id}
        data-days-until={next.daysUntil}
      >
        <div className="calendar-holiday-countdown-head">
          <strong>{next.occurrence.name}</strong>
          <span className="calendar-holiday-countdown-badge">法定休假</span>
        </div>
        <p className="calendar-holiday-countdown-meta">
          <time dateTime={next.occurrence.dateKey}>{next.occurrence.dateKey.replaceAll('-', '.')}</time>
          <span data-testid="holiday-countdown-days">{holidayCountdownCopy(next.daysUntil)}</span>
        </p>
      </article>
    </section>
  );
}
