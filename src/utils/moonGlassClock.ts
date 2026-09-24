export type ClockMotionMode = 'standard' | 'reduced' | 'none';

export interface ClockParts {
  hour: string;
  minute: string;
  dayPeriod: string;
  year: string;
  weekday: string;
  dateLabel: string;
  dateTime: string;
  ariaLabel: string;
}

export function resolveHour12(locale: string, override?: boolean): boolean {
  if (typeof override === 'boolean') return override;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
}

export function formatClockParts(date: Date, locale: string, hour12 = resolveHour12(locale)): ClockParts {
  const timeParts = new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', hour12,
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => timeParts.find((part) => part.type === type)?.value ?? '';
  const hour = read('hour').padStart(2, '0');
  const minute = read('minute').padStart(2, '0');
  const dayPeriod = read('dayPeriod');
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'long', day: 'numeric',
  }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(date);
  const fullDate = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    hour: '2-digit', minute: '2-digit', hour12,
  }).format(date);

  return {
    hour, minute, dayPeriod, year, weekday, dateLabel,
    dateTime: date.toISOString(),
    ariaLabel: `${fullDate}${dayPeriod ? ` ${dayPeriod}` : ''}`,
  };
}

export function diffClockGroups(previous: ClockParts | null, next: ClockParts) {
  return {
    hour: Boolean(previous && previous.hour !== next.hour),
    minute: Boolean(previous && previous.minute !== next.minute),
  };
}

export function resolveClockMotion(reducedMotion: boolean, hidden: boolean): ClockMotionMode {
  if (hidden) return 'none';
  return reducedMotion ? 'reduced' : 'standard';
}
