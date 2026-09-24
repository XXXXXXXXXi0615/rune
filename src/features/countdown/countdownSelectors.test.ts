import { describe, expect, it } from 'vitest';
import type { CountdownEvent, CountdownRecurrenceType } from './countdownEngine';
import { countdownOccursOnDate, selectCountdownEventsForDate } from './countdownSelectors';

/**
 * Phase C4 — the Calendar Day Inspector shows only the countdowns bound to the
 * selected date. These tests pin the occurrence predicate, which is the single
 * place that decides "does this event belong to this day?".
 */

function makeEvent(id: string, targetAt: string, recurrence: CountdownRecurrenceType = 'none'): CountdownEvent {
  return {
    id,
    title: id,
    targetAt,
    timezone: 'Asia/Taipei',
    direction: 'until',
    recurrence: { type: recurrence },
    includeTargetDay: false,
    showTime: false,
    pinnedToHome: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('countdownOccursOnDate — one-shot events', () => {
  const birthday = makeEvent('birthday', '2026-11-17');

  it('matches the target date exactly', () => {
    expect(countdownOccursOnDate(birthday, '2026-11-17')).toBe(true);
  });

  it('does not match the day before or the day after', () => {
    expect(countdownOccursOnDate(birthday, '2026-11-16')).toBe(false);
    expect(countdownOccursOnDate(birthday, '2026-11-18')).toBe(false);
  });

  it('does not match only on day-of-month (month and year are part of the identity)', () => {
    expect(countdownOccursOnDate(birthday, '2026-10-17')).toBe(false);
    expect(countdownOccursOnDate(birthday, '2027-11-17')).toBe(false);
    expect(countdownOccursOnDate(birthday, '2025-11-17')).toBe(false);
  });

  it('never resurfaces on an arbitrary later date', () => {
    const past = makeEvent('may', '2026-05-22');
    expect(countdownOccursOnDate(past, '2026-05-22')).toBe(true);
    expect(countdownOccursOnDate(past, '2026-09-23')).toBe(false);
    expect(countdownOccursOnDate(past, '2027-05-22')).toBe(false);
  });
});

describe('countdownOccursOnDate — yearly recurrence', () => {
  const anniversary = makeEvent('anniversary', '2020-11-17', 'yearly');

  it('matches the same month/day in any year', () => {
    expect(countdownOccursOnDate(anniversary, '2026-11-17')).toBe(true);
    expect(countdownOccursOnDate(anniversary, '2027-11-17')).toBe(true);
  });

  it('does not match adjacent days', () => {
    expect(countdownOccursOnDate(anniversary, '2026-11-16')).toBe(false);
    expect(countdownOccursOnDate(anniversary, '2026-11-18')).toBe(false);
  });

  it('falls back to 2/28 for a 2/29 anchor in a non-leap year', () => {
    const leapDay = makeEvent('leap', '2020-02-29', 'yearly');
    expect(countdownOccursOnDate(leapDay, '2026-02-28')).toBe(true);
    expect(countdownOccursOnDate(leapDay, '2026-03-01')).toBe(false);
    // The leap year itself still matches 2/29.
    expect(countdownOccursOnDate(leapDay, '2028-02-29')).toBe(true);
  });
});

describe('countdownOccursOnDate — monthly recurrence', () => {
  const rent = makeEvent('rent', '2026-01-15', 'monthly');

  it('matches the same day-of-month in a later month', () => {
    expect(countdownOccursOnDate(rent, '2026-11-15')).toBe(true);
    expect(countdownOccursOnDate(rent, '2027-03-15')).toBe(true);
  });

  it('does not match a different day-of-month', () => {
    expect(countdownOccursOnDate(rent, '2026-11-14')).toBe(false);
    expect(countdownOccursOnDate(rent, '2026-11-16')).toBe(false);
  });

  it('clamps a 1/31 anchor to the last day of a shorter month', () => {
    const monthEnd = makeEvent('monthEnd', '2026-01-31', 'monthly');
    expect(countdownOccursOnDate(monthEnd, '2026-02-28')).toBe(true);
    expect(countdownOccursOnDate(monthEnd, '2026-04-30')).toBe(true);
    expect(countdownOccursOnDate(monthEnd, '2026-02-27')).toBe(false);
  });
});

describe('countdownOccursOnDate — malformed input', () => {
  it('rejects malformed and non-existent date keys', () => {
    const event = makeEvent('birthday', '2026-11-17');
    expect(countdownOccursOnDate(event, '2026-11-17 ')).toBe(false);
    expect(countdownOccursOnDate(event, '2026/11/17')).toBe(false);
    expect(countdownOccursOnDate(event, '')).toBe(false);
    expect(countdownOccursOnDate(event, '2026-02-30')).toBe(false);
    expect(countdownOccursOnDate(event, '2026-13-01')).toBe(false);
  });

  it('rejects a malformed target date on the event side', () => {
    expect(countdownOccursOnDate(makeEvent('bad', 'not-a-date'), '2026-11-17')).toBe(false);
  });
});

describe('selectCountdownEventsForDate', () => {
  const events = [
    makeEvent('birthday', '2026-11-17'),
    makeEvent('may', '2026-05-22'),
    makeEvent('anniversary', '2020-11-17', 'yearly'),
    makeEvent('rent', '2026-01-15', 'monthly'),
  ];

  it('returns only the events bound to the requested day, in store order', () => {
    expect(selectCountdownEventsForDate(events, '2026-11-17').map((e) => e.id))
      .toEqual(['birthday', 'anniversary']);
  });

  it('returns an empty list for a day with no matching event', () => {
    expect(selectCountdownEventsForDate(events, '2026-11-16')).toEqual([]);
    expect(selectCountdownEventsForDate(events, '2026-09-23')).toEqual([]);
  });

  it('picks up a monthly occurrence on a later month', () => {
    expect(selectCountdownEventsForDate(events, '2026-12-15').map((e) => e.id)).toEqual(['rent']);
  });

  it('does not mutate the input list', () => {
    const copy = [...events];
    selectCountdownEventsForDate(events, '2026-11-17');
    expect(events).toEqual(copy);
  });
});
