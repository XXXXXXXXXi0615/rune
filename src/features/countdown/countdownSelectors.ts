// ================================================================
// TIDECOUNT — Countdown Selectors (stable, single source of truth)
//
// All consumers (Calendar list, tab count, Home Capsule) derive
// from these selectors. No inline Object.values().sort() in JSX.
//
// Phase C4 — date-scoped projection. The Calendar Day Inspector must
// show the countdowns bound to the *selected* date, not the global
// dashboard. `countdownOccursOnDate` answers "does this event have an
// occurrence on this calendar day?" and is built entirely on the
// canonical `resolveNextOccurrence`, so the recurrence semantics
// (yearly 2/29 → 2/28, monthly 1/31 → that month's last day) stay the
// engine's and are not re-implemented anywhere.
// ================================================================

import type { CountdownEvent, CountdownDisplay } from './countdownEngine';
import { formatLocalDateKey, resolveCountdownDisplay, resolveHomeCountdown, resolveNextOccurrence, sortCountdownEvents } from './countdownEngine';
import type { CountdownState, CountdownWidgetConfig } from './useCountdownStore';

// ── Raw state accessors (stable reference) ──
export const selectCountdownEvents = (s: CountdownState): CountdownEvent[] => s.events;
export const selectCountdownWidgetConfig = (s: CountdownState): CountdownWidgetConfig => s.widgetConfig;
export const selectCountdownCount = (s: CountdownState): number => s.events.length;
export const selectHydrationState = (s: CountdownState): 'idle' | 'hydrating' | 'ready' => s._hydrated ? 'ready' : 'hydrating';

export function selectEventById(id: string) {
  return (s: CountdownState): CountdownEvent | undefined =>
    s.events.find((e: CountdownEvent) => e.id === id);
}

// ── Home Capsule result ──
// Uses resolveHomeCountdown from engine; derives display from
// widgetConfig.pinnedEventId priority chain.
export function selectHomeCountdownResult(now: Date) {
  return (s: CountdownState): ReturnType<typeof resolveHomeCountdown> =>
    resolveHomeCountdown(s.events, s.widgetConfig, now);
}

// ── Pinned event (single source: widgetConfig.pinnedEventId) ──
export function selectPinnedEvent(s: CountdownState): CountdownEvent | undefined {
  const id = s.widgetConfig.pinnedEventId;
  if (!id) return undefined;
  return s.events.find((e: CountdownEvent) => e.id === id);
}

// ── Calendar list items (sorted, unfiltered) ──
// Consumers apply their own filter on top.
export function selectSortedEvents(now: Date) {
  return (s: CountdownState): CountdownEvent[] =>
    sortCountdownEvents(s.events, now, 'nearest');
}

// ── Date-scoped projection (Phase C4) ──

/** Parse a canonical `YYYY-MM-DD` key into a local-midnight Date.
 *  Returns null for malformed keys and for non-existent days (e.g. `2026-02-30`),
 *  which `Date` would otherwise silently roll forward. */
function localDateFromKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  // Round-trip guard: rejects rolled-over keys such as 2026-02-30.
  return formatLocalDateKey(date) === dateKey ? date : null;
}

/**
 * Does `event` have an occurrence on the given canonical calendar day?
 *
 * Delegates to the canonical `resolveNextOccurrence`: if the day is an
 * occurrence, the engine's "next occurrence on/after this day" is that very day.
 * One-shot events therefore match only their own date — a past event never
 * reappears on an arbitrary later day.
 */
export function countdownOccursOnDate(event: CountdownEvent, dateKey: string): boolean {
  const day = localDateFromKey(dateKey);
  if (!day) return false;
  const occurrence = resolveNextOccurrence(event.targetAt, event.recurrence, day);
  if (!occurrence) return false;
  return formatLocalDateKey(occurrence) === dateKey;
}

/**
 * The CountdownEvents bound to one canonical calendar day, in store order.
 *
 * No clock is needed and none is taken: every match occurs on `dateKey` itself,
 * so a "nearest first" sort would be a tie across the whole list. Store order is
 * stable and therefore deterministic for callers and tests alike.
 * Used by the Calendar Day Inspector; the global list (Home widget,
 * `/calendar/countdowns`) does not use this.
 */
export function selectCountdownEventsForDate(
  events: CountdownEvent[],
  dateKey: string,
): CountdownEvent[] {
  return events.filter((event) => countdownOccursOnDate(event, dateKey));
}
