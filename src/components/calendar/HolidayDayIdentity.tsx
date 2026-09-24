import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getHolidayYear } from '@/features/calendar/holiday/provider';
import {
  HOLIDAY_DAY_BADGE_LABEL,
  getHolidayIdentityForDate,
} from '@/features/calendar/holiday/holidayDayIdentity';
import { parseLocalDateKey } from '@/utils/date';

/**
 * Selected-day Holiday identity — Rune Calendar Phase 3B-4.1.
 *
 * A read-only projection of the frozen Holiday provider for the canonical
 * `selectedDate`, rendered as one compact identity row in the Day Inspector
 * header area (the day's identity, not another workspace).
 *
 * Nothing is persisted, no second holiday store exists, source occurrences are
 * never mutated or merged, and the component renders nothing when the region
 * is null, the provider is unavailable (unsupported region/year), or the day
 * has no occurrences — no fabricated identity, no lunar inference, no
 * previous-year fallback.
 */

function formatDayMonth(dateKey: string): string {
  const date = parseLocalDateKey(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function HolidayDayIdentity({ dateKey }: { dateKey: string }) {
  const holidayRegion = useAppStore((state) => state.holidayRegion);
  const identity = useMemo(() => {
    if (!holidayRegion || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const year = Number(dateKey.slice(0, 4));
    const result = getHolidayYear(holidayRegion, year);
    if (result.status !== 'ready' || result.region !== holidayRegion || result.year !== year) return null;
    return getHolidayIdentityForDate(result.occurrences, dateKey);
  }, [holidayRegion, dateKey]);

  if (!identity || identity.occurrences.length === 0) return null;

  const range = identity.dayOffRange;
  return (
    <div
      className="calendar-inspector-holiday"
      data-testid="inspector-holiday-identity"
      data-holiday-date={identity.date}
      data-holiday-count={identity.occurrences.length}
      data-holiday-kinds={identity.occurrences.map((occurrence) => occurrence.kind).join(',')}
      data-holiday-dayoff={identity.isPublicDayOff ? 'true' : 'false'}
      data-holiday-workday-override={identity.isWorkdayOverride ? 'true' : 'false'}
    >
      <span className="calendar-inspector-holiday-name" data-holiday-primary-kind={identity.primaryOccurrence?.kind}>
        {identity.labels[0]}
      </span>
      <span className="calendar-inspector-holiday-badges">
        {identity.badges.map((badge) => (
          <span key={badge} className={`cal-holiday-badge is-${badge}`} data-holiday-badge={badge}>
            {HOLIDAY_DAY_BADGE_LABEL[badge]}
          </span>
        ))}
      </span>
      {range && (
        <small className="calendar-inspector-holiday-range">{`${formatDayMonth(range.from)}－${formatDayMonth(range.to)}放假`}</small>
      )}
    </div>
  );
}
