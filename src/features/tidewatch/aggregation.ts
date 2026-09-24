/**
 * TIDEWATCH — pure aggregation selectors.
 *
 * Derived from writing telemetry events.
 * Do not persist aggregate totals as second truth.
 */
import type {
  WritingTelemetryEvent,
  PeriodStats,
  SurfaceBreakdown,
  DailyBreakdown,
  WeeklyWordTrace,
} from './types';
import { countWritingGraphemes } from '@/utils/countWritingGraphemes';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Period aggregation
// ---------------------------------------------------------------------------

function filterByRange(
  events: WritingTelemetryEvent[],
  from: number,
  to: number,
): WritingTelemetryEvent[] {
  return events.filter((e) => e.timestamp >= from && e.timestamp <= to);
}

export function aggregatePeriod(
  events: WritingTelemetryEvent[],
  from: number,
  to: number,
): PeriodStats {
  const range = filterByRange(events, from, to);
  let userInput = 0;
  let userCommitted = 0;
  let agentCommitted = 0;

  for (const e of range) {
    if (e.actor === 'user') {
      userInput += e.inputChars;
      userCommitted += e.committedChars;
    } else {
      agentCommitted += e.committedChars;
    }
  }

  return {
    userInput,
    userCommitted,
    agentCommitted,
    combinedCommitted: userCommitted + agentCommitted,
  };
}

export function todayStats(events: WritingTelemetryEvent[]): PeriodStats {
  const now = new Date();
  const from = startOfDay(now).getTime();
  const to = endOfDay(now).getTime();
  return aggregatePeriod(events, from, to);
}

export function yesterdayStats(events: WritingTelemetryEvent[]): PeriodStats {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return aggregatePeriod(events, startOfDay(yesterday).getTime(), endOfDay(yesterday).getTime());
}

export function currentWeekStats(events: WritingTelemetryEvent[]): PeriodStats {
  const now = new Date();
  const from = startOfWeek(now).getTime();
  const to = endOfDay(now).getTime();
  return aggregatePeriod(events, from, to);
}

export function previousWeekStats(events: WritingTelemetryEvent[]): PeriodStats {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const prevStart = new Date(weekStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(weekStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  return aggregatePeriod(events, prevStart.getTime(), endOfDay(prevEnd).getTime());
}

export function lifetimeStats(events: WritingTelemetryEvent[]): PeriodStats {
  if (events.length === 0) {
    return { userInput: 0, userCommitted: 0, agentCommitted: 0, combinedCommitted: 0 };
  }
  const from = Math.min(...events.map((e) => e.timestamp));
  const to = Math.max(...events.map((e) => e.timestamp));
  return aggregatePeriod(events, from, to);
}

// ---------------------------------------------------------------------------
// Surface breakdown
// ---------------------------------------------------------------------------

export function surfaceBreakdown(
  events: WritingTelemetryEvent[],
  from: number,
  to: number,
): SurfaceBreakdown[] {
  const range = filterByRange(events, from, to);
  const totals: Record<string, number> = {};

  for (const e of range) {
    totals[e.surface] = (totals[e.surface] || 0) + e.committedChars;
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Object.entries(totals)
    .map(([surface, chars]) => ({
      surface,
      chars,
      percentage: Math.round((chars / total) * 100),
    }))
    .sort((a, b) => b.chars - a.chars);
}

// ---------------------------------------------------------------------------
// Daily breakdown
// ---------------------------------------------------------------------------

export function dailyBreakdown(events: WritingTelemetryEvent[], days = 7): DailyBreakdown[] {
  const now = new Date();
  const result: DailyBreakdown[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const from = startOfDay(d).getTime();
    const to = endOfDay(d).getTime();
    const range = filterByRange(events, from, to);

    let userChars = 0;
    let agentChars = 0;
    for (const e of range) {
      if (e.actor === 'user') userChars += e.committedChars;
      else agentChars += e.committedChars;
    }

    result.push({
      date: formatDate(d),
      userChars,
      agentChars,
      combinedChars: userChars + agentChars,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Weekly word trace
// ---------------------------------------------------------------------------

export function computeWeeklyWordTrace(events: WritingTelemetryEvent[]): WeeklyWordTrace {
  const weekEvents = (() => {
    const now = new Date();
    const from = startOfWeek(now).getTime();
    const to = endOfDay(now).getTime();
    return filterByRange(events, from, to);
  })();

  const prevEvents = (() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(weekStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return filterByRange(events, prevStart.getTime(), endOfDay(prevEnd).getTime());
  })();

  let userChars = 0;
  let agentChars = 0;
  for (const e of weekEvents) {
    if (e.actor === 'user') userChars += e.committedChars;
    else agentChars += e.committedChars;
  }

  const daily = dailyBreakdown(events, 7);
  const mostActiveDay = daily.reduce<string | null>((best, day) => {
    if (!best) return day.date;
    return day.combinedChars > (daily.find((d) => d.date === best)?.combinedChars ?? 0)
      ? day.date
      : best;
  }, null);

  const sb = surfaceBreakdown(events, startOfWeek(new Date()).getTime(), endOfDay(new Date()).getTime());

  const prevCombined = prevEvents.reduce((sum, e) => sum + e.committedChars, 0);
  const currCombined = userChars + agentChars;
  const changeVsPreviousWeek = prevCombined === 0
    ? (currCombined > 0 ? 100 : 0)
    : Math.round(((currCombined - prevCombined) / prevCombined) * 100);

  return {
    userChars,
    agentChars,
    combinedChars: currCombined,
    dailyBreakdown: daily,
    mostActiveDay: (daily.find((d) => d.combinedChars > 0) ? mostActiveDay : null),
    surfaceBreakdown: sb,
    changeVsPreviousWeek,
  };
}
