// ================================================================
// TIDECOUNT Phase 1 — Countdown Engine
//
// Pure functions: CountdownEvent → CountdownDisplay
//   - Calendar Day arithmetic (UTC-midnight delta, DST-safe)
//   - recurrence: none / monthly / yearly
//   - 2.29 yearly → falls back to 2.28 in non-leap years
//   - direction: until / since / auto
//   - timezone metadata only; runtime uses local calendar
//   - NO `ms / 86400000` for timezone-shifted comparisons
// ================================================================

export type CountdownDirection = 'until' | 'since' | 'auto';
export type CountdownRecurrenceType = 'none' | 'monthly' | 'yearly';

export interface CountdownRecurrence {
  type: CountdownRecurrenceType;
}

export interface CountdownEvent {
  id: string;
  title: string;
  /** ISO-like calendar date `YYYY-MM-DD` (target calendar day in local TZ) */
  targetAt: string;
  /** Optional `HH:mm` 24h. When present, time-of-day matters. */
  targetTime?: string;
  /** IANA timezone name. Falls back to local TZ when missing. */
  timezone: string;

  direction: CountdownDirection;

  recurrence: CountdownRecurrence;

  /** When true, the target day itself counts as day 0 for until / day 1 for since. */
  includeTargetDay: boolean;
  showTime: boolean;

  colorToken?: string;
  iconId?: string;
  /** IndexedDB asset id (no base64 in store) */
  coverAssetId?: string;

  pinnedToHome: boolean;
  homeOrder?: number;

  createdAt: number;
  updatedAt: number;
}

export interface CountdownEventDraft {
  title: string;
  targetAt: string;
  targetTime?: string;
  timezone?: string;
  direction: CountdownDirection;
  recurrence: CountdownRecurrence;
  includeTargetDay: boolean;
  showTime: boolean;
  colorToken?: string;
  iconId?: string;
  coverAssetId?: string;
  pinnedToHome?: boolean;
}

export type CountdownMode = 'upcoming' | 'today' | 'elapsed';

export interface CountdownDisplay {
  mode: CountdownMode;
  /** Calendar-day delta from today to the resolved next/elapsed occurrence.
   *  Positive = future (until), negative = past (since).
   *  `0` for today. */
  dayCount: number;
  /** Resolved human label, e.g. "還有 5 天", "今天", "已經過 3 天", "已到期". */
  label: string;
  /** ISO `YYYY-MM-DD` of the resolved occurrence used for this display. */
  nextOccurrenceAt: string;
  /** Whether this is the "expired" state for `until` events past last occurrence. */
  expired?: boolean;
  /** Whether this is the "not yet started" state for `since` events before first occurrence. */
  notStarted?: boolean;
}

// ----------------------------------------------------------------
// Local calendar helpers
// ----------------------------------------------------------------

/** Local midnight on a given Date's calendar day. */
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-day delta (b − a). DST-safe: both sides converted to UTC midnight.
 *  The two UTC midnights are always exact 86400000ms multiples apart, so
 *  the division is *not* the disallowed timezone-shifted comparison. */
export function dayDelta(a: Date, b: Date): number {
  const aS = startOfLocalDay(a);
  const bS = startOfLocalDay(b);
  const aUtc = Date.UTC(aS.getFullYear(), aS.getMonth(), aS.getDate());
  const bUtc = Date.UTC(bS.getFullYear(), bS.getMonth(), bS.getDate());
  return Math.round((bUtc - aUtc) / 86400000);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseTargetDate(targetAt: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetAt);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, mIdx: number): number {
  // mIdx: 0-based
  return new Date(y, mIdx + 1, 0).getDate();
}

/** Resolve the next occurrence on/after `from` (local calendar). */
export function resolveNextOccurrence(targetAt: string, recurrence: CountdownRecurrence, from: Date): Date | null {
  const parsed = parseTargetDate(targetAt);
  if (!parsed) return null;
  const { y, m, d } = parsed;
  const fromKey = startOfLocalDay(from);
  const fromY = fromKey.getFullYear();
  const fromM = fromKey.getMonth(); // 0-based
  const fromD = fromKey.getDate();

  if (recurrence.type === 'none') {
    const occ = new Date(y, m - 1, d);
    return occ;
  }
  if (recurrence.type === 'yearly') {
    // 2.29 in non-leap year falls back to 2.28 (explicit decision).
    const dayFor = (year: number) => {
      if (m === 2 && d === 29 && !isLeapYear(year)) {
        return new Date(year, 1, 28);
      }
      return new Date(year, m - 1, d);
    };
    // Try this year
    let occ = dayFor(fromY);
    if (startOfLocalDay(occ) < fromKey) occ = dayFor(fromY + 1);
    return occ;
  }
  if (recurrence.type === 'monthly') {
    // 1.31 monthly → Feb = last day (28/29)
    const dayFor = (year: number, monthIdx: number) => {
      const last = daysInMonth(year, monthIdx);
      return new Date(year, monthIdx, Math.min(d, last));
    };
    let occ = dayFor(fromY, fromM);
    if (startOfLocalDay(occ) < fromKey) {
      const nextMonthIdx = fromM + 1;
      const nextYear = fromY + (nextMonthIdx > 11 ? 1 : 0);
      occ = dayFor(nextYear, nextMonthIdx % 12);
    }
    return occ;
  }
  return null;
}

/** Resolve the most recent occurrence on/before `from` (local calendar). */
export function resolvePreviousOccurrence(targetAt: string, recurrence: CountdownRecurrence, from: Date): Date | null {
  const parsed = parseTargetDate(targetAt);
  if (!parsed) return null;
  const { y, m, d } = parsed;
  const fromKey = startOfLocalDay(from);
  const fromY = fromKey.getFullYear();
  const fromM = fromKey.getMonth();
  const fromD = fromKey.getDate();

  if (recurrence.type === 'none') {
    const occ = new Date(y, m - 1, d);
    return occ;
  }
  if (recurrence.type === 'yearly') {
    const dayFor = (year: number) => {
      if (m === 2 && d === 29 && !isLeapYear(year)) {
        return new Date(year, 1, 28);
      }
      return new Date(year, m - 1, d);
    };
    let occ = dayFor(fromY);
    if (startOfLocalDay(occ) > fromKey) occ = dayFor(fromY - 1);
    return occ;
  }
  if (recurrence.type === 'monthly') {
    const dayFor = (year: number, monthIdx: number) => {
      const last = daysInMonth(year, monthIdx);
      return new Date(year, monthIdx, Math.min(d, last));
    };
    let occ = dayFor(fromY, fromM);
    if (startOfLocalDay(occ) > fromKey) {
      const prevMonthIdx = fromM - 1;
      const prevYear = fromY + (prevMonthIdx < 0 ? -1 : 0);
      occ = dayFor(prevYear, (prevMonthIdx + 12) % 12);
    }
    return occ;
  }
  return null;
}

// ----------------------------------------------------------------
// Labels
// ----------------------------------------------------------------

const ZH = {
  today: '就是今天',
  daysUntil: (n: number) => `還有 ${n} 天`,
  daysSince: (n: number) => `已經過 ${n} 天`,
  expired: '已到期',
  notStarted: '尚未開始',
};

function dayCountForMode(mode: CountdownMode, rawDays: number, includeTargetDay: boolean): number {
  // `rawDays` is the calendar-day delta (today→target). + future, − past, 0 today.
  if (mode === 'today') return 0;
  if (mode === 'upcoming') {
    if (includeTargetDay) {
      // includeTargetDay: today=0, tomorrow=1, ...
      return Math.max(0, rawDays);
    }
    // strict until: today=0, tomorrow=1
    return Math.max(0, rawDays);
  }
  // elapsed
  if (includeTargetDay) {
    // since: today=1, yesterday=2
    return Math.max(0, -rawDays + 1);
  }
  // strict since: today=1
  return Math.max(0, -rawDays);
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export function resolveCountdownDisplay(event: CountdownEvent, now: Date): CountdownDisplay {
  const today = startOfLocalDay(now);
  const todayKey = formatLocalDateKey(today);
  const targetParsed = parseTargetDate(event.targetAt);

  if (!targetParsed) {
    return { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: todayKey };
  }

  const rec = event.recurrence.type;

  if (rec === 'none') {
    const targetDate = new Date(targetParsed.y, targetParsed.m - 1, targetParsed.d);
    const targetKey = formatLocalDateKey(targetDate);
    const raw = dayDelta(today, targetDate);
    const direction = event.direction;

    if (raw === 0) {
      if (direction === 'since') {
        // For one-shot `since` on the target day itself, includeTargetDay
        // decides whether the day counts as the 1st elapsed day.
        const n = event.includeTargetDay ? 1 : 0;
        return n === 0
          ? { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: targetKey }
          : { mode: 'elapsed', dayCount: 1, label: ZH.daysSince(1), nextOccurrenceAt: targetKey };
      }
      return { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: targetKey };
    }

    if (raw > 0) {
      // target is in the future
      if (direction === 'since') {
        return { mode: 'upcoming', dayCount: 0, label: ZH.notStarted, nextOccurrenceAt: targetKey, notStarted: true };
      }
      // until | auto
      const n = dayCountForMode('upcoming', raw, event.includeTargetDay);
      return { mode: 'upcoming', dayCount: n, label: ZH.daysUntil(n), nextOccurrenceAt: targetKey };
    }

    // raw < 0 → target has passed
    if (direction === 'until') {
      return { mode: 'elapsed', dayCount: 0, label: ZH.expired, nextOccurrenceAt: targetKey, expired: true };
    }
    // since | auto
    const n = dayCountForMode('elapsed', raw, event.includeTargetDay);
    return { mode: 'elapsed', dayCount: n, label: ZH.daysSince(n), nextOccurrenceAt: targetKey };
  }

  // Recurring events
  const next = resolveNextOccurrence(event.targetAt, event.recurrence, today);
  if (!next) {
    return { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: todayKey };
  }
  const nextKey = formatLocalDateKey(next);
  const rawNext = dayDelta(today, next);
  const direction = event.direction;

  if (rawNext === 0) {
    return { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: nextKey };
  }

  if (rawNext > 0) {
    if (direction === 'since') {
      // For recurring `since`, if today's date matches a future occurrence window
      // (e.g. "X 周年紀念日" — wants the elapsed count from the original date),
      // resolve backwards to the original anchor and report elapsed.
      const prev = resolvePreviousOccurrence(event.targetAt, event.recurrence, today);
      if (prev) {
        const rawPrev = dayDelta(today, prev); // negative
        const n = dayCountForMode('elapsed', rawPrev, event.includeTargetDay);
        return { mode: 'elapsed', dayCount: n, label: ZH.daysSince(n), nextOccurrenceAt: nextKey };
      }
      return { mode: 'elapsed', dayCount: 0, label: ZH.daysSince(0), nextOccurrenceAt: nextKey };
    }
    // until | auto → report next occurrence
    const n = dayCountForMode('upcoming', rawNext, event.includeTargetDay);
    return { mode: 'upcoming', dayCount: n, label: ZH.daysUntil(n), nextOccurrenceAt: nextKey };
  }

  // rawNext < 0 (only possible if recurrence math is broken; guard)
  return { mode: 'today', dayCount: 0, label: ZH.today, nextOccurrenceAt: nextKey };
}

// ----------------------------------------------------------------
// Sorting helpers for calendar/home list rendering
// ----------------------------------------------------------------

export type CountdownSortKey = 'nearest' | 'recently-added' | 'manual';

export function sortCountdownEvents(events: CountdownEvent[], now: Date, key: CountdownSortKey = 'nearest'): CountdownEvent[] {
  const out = [...events];
  if (key === 'manual') return out;
  if (key === 'recently-added') {
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }
  // nearest: pinned first; then by absolute day-delta to next occurrence.
  return out.sort((a, b) => {
    if (a.pinnedToHome !== b.pinnedToHome) return a.pinnedToHome ? -1 : 1;
    const da = resolveCountdownDisplay(a, now);
    const db = resolveCountdownDisplay(b, now);
    const keyA = a.homeOrder ?? Number.MAX_SAFE_INTEGER;
    const keyB = b.homeOrder ?? Number.MAX_SAFE_INTEGER;
    if (keyA !== keyB) return keyA - keyB;
    // upcoming first (smallest positive dayCount), then today, then elapsed (smallest first)
    const scoreA = scoreForSort(da);
    const scoreB = scoreForSort(db);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.title.localeCompare(b.title);
  });
}

function scoreForSort(d: CountdownDisplay): number {
  if (d.mode === 'upcoming') return d.dayCount + 0.5;
  if (d.mode === 'today') return 0;
  return -d.dayCount - 0.5;
}

// ----------------------------------------------------------------
// ID + timezone helpers
// ----------------------------------------------------------------

export function newCountdownId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function detectLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch {
    return 'local';
  }
}

// ----------------------------------------------------------------
// Minimal stable snapshot for future iOS WidgetKit bridge.
//   Snapshot is derived from {events, now}; no Base64 inside.
// ----------------------------------------------------------------

export interface CountdownSnapshotEntry {
  id: string;
  title: string;
  dayCount: number;
  mode: CountdownMode;
  nextOccurrenceAt: string;
  recurrenceType: CountdownRecurrenceType;
  direction: CountdownDirection;
  colorToken?: string;
  iconId?: string;
  coverAssetId?: string;
}

export function buildCountdownSnapshot(
  events: CountdownEvent[],
  now: Date,
  options: { includeIds?: string[]; max?: number } = {},
): CountdownSnapshotEntry[] {
  const list = options.includeIds
    ? events.filter((e) => options.includeIds!.includes(e.id))
    : events;
  const sorted = sortCountdownEvents(list, now, 'nearest');
  const limit = options.max ?? sorted.length;
  return sorted.slice(0, limit).map((e) => {
    const d = resolveCountdownDisplay(e, now);
    const entry: CountdownSnapshotEntry = {
      id: e.id,
      title: e.title,
      dayCount: d.dayCount,
      mode: d.mode,
      nextOccurrenceAt: d.nextOccurrenceAt,
      recurrenceType: e.recurrence.type,
      direction: e.direction,
    };
    if (e.colorToken) entry.colorToken = e.colorToken;
    if (e.iconId) entry.iconId = e.iconId;
    if (e.coverAssetId) entry.coverAssetId = e.coverAssetId;
    return entry;
  });
}

// ----------------------------------------------------------------
// Home Widget — resolve which event to render
// ----------------------------------------------------------------

export interface HomeCountdownResult {
  /** The event to render as the primary slot, or null if none qualifies. */
  event: CountdownEvent | null;
  /** Resolved display for the UI (dayCount, label, mode). */
  display: CountdownDisplay | null;
  /** True when there are no events at all. False if there are events but none qualify. */
  isEmpty: boolean;
  /** True when the widget should show the "建立第一個倒數" CTA. */
  showEmptyState: boolean;
  /** Reason for diagnostic / testing. */
  reason: string;
}

export interface HomeCountdownConfig {
  /** Explicit event id to render. Takes priority over all heuristics. */
  pinnedEventId?: string;
  /** When true, elapsed events are hidden — except the explicitly pinned one. */
  hideElapsed: boolean;
}

/**
 * Resolve which countdown event the Home widget should display.
 *
 * Rules:
 *   1. If pinnedEventId points to a valid event → display it (never filtered by hideElapsed).
 *   2. Otherwise, prefer the nearest upcoming `until` event.
 *   3. If no upcoming, prefer today's event.
 *   4. If none of the above, pick the most recent elapsed event.
 *   5. Only when the events array is truly empty → show empty state.
 */
export function resolveHomeCountdown(
  events: CountdownEvent[],
  config: HomeCountdownConfig,
  now: Date,
): HomeCountdownResult {
  // No events at all — true empty.
  if (events.length === 0) {
    return {
      event: null,
      display: null,
      isEmpty: true,
      showEmptyState: true,
      reason: 'no-events',
    };
  }

  // 1. Explicit pinned — always visible regardless of hideElapsed.
  if (config.pinnedEventId) {
    const pinned = events.find((e) => e.id === config.pinnedEventId);
    if (pinned) {
      const display = resolveCountdownDisplay(pinned, now);
      return {
        event: pinned,
        display,
        isEmpty: false,
        showEmptyState: false,
        reason: 'pinned',
      };
    }
  }

  // 2-4. Heuristic selection — exclude elapsed if hideElapsed is on.
  const eligible = config.hideElapsed
    ? events.filter((e) => resolveCountdownDisplay(e, now).mode !== 'elapsed')
    : events;

  if (eligible.length === 0) {
    // All events are elapsed and hidden — fall back to showing the most recent overall.
    const sorted = sortCountdownEvents(events, now, 'nearest');
    const fallback = sorted[0] || null;
    if (fallback) {
      return {
        event: fallback,
        display: resolveCountdownDisplay(fallback, now),
        isEmpty: false,
        showEmptyState: false,
        reason: 'hide-elapsed-fallback',
      };
    }
    return {
      event: null,
      display: null,
      isEmpty: false,
      showEmptyState: false,
      reason: 'all-filtered',
    };
  }

  // Prefer upcoming until events
  const upcoming = eligible
    .filter((e) => resolveCountdownDisplay(e, now).mode === 'upcoming')
    .sort((a, b) => {
      const da = resolveCountdownDisplay(a, now).dayCount;
      const db = resolveCountdownDisplay(b, now).dayCount;
      return da - db;
    });

  if (upcoming.length > 0) {
    const top = upcoming[0];
    return {
      event: top,
      display: resolveCountdownDisplay(top, now),
      isEmpty: false,
      showEmptyState: false,
      reason: 'nearest-upcoming',
    };
  }

  // Next: today
  const todayEvent = eligible.find((e) => resolveCountdownDisplay(e, now).mode === 'today');
  if (todayEvent) {
    return {
      event: todayEvent,
      display: resolveCountdownDisplay(todayEvent, now),
      isEmpty: false,
      showEmptyState: false,
      reason: 'today',
    };
  }

  // Last: nearest elapsed
  const sorted = sortCountdownEvents(eligible, now, 'nearest');
  const top = sorted[0] || null;
  if (top) {
    return {
      event: top,
      display: resolveCountdownDisplay(top, now),
      isEmpty: false,
      showEmptyState: false,
      reason: 'fallback-elapsed',
    };
  }

  return {
    event: null,
    display: null,
    isEmpty: false,
    showEmptyState: false,
    reason: 'fallback-none',
  };
}
