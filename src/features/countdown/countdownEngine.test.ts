import { describe, it, expect } from 'vitest';
import {
  resolveHomeCountdown,
  resolveCountdownDisplay,
  resolveNextOccurrence,
  resolvePreviousOccurrence,
  dayDelta,
  sortCountdownEvents,
  detectLocalTimezone,
  formatLocalDateKey,
  type CountdownEvent,
} from './countdownEngine';

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return formatLocalDateKey(d);
}

function today(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function makeEvent(overrides: Partial<CountdownEvent> & { id?: string }): CountdownEvent {
  const id = overrides.id ?? 'test-' + Math.random().toString(36).slice(2);
  return {
    id,
    title: overrides.title ?? '测试',
    targetAt: overrides.targetAt ?? daysFromNow(5),
    timezone: overrides.timezone ?? 'Asia/Shanghai',
    direction: overrides.direction ?? 'auto',
    recurrence: overrides.recurrence ?? { type: 'none' },
    includeTargetDay: overrides.includeTargetDay ?? false,
    showTime: overrides.showTime ?? false,
    pinnedToHome: overrides.pinnedToHome ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ═══════════════════════════════════════════
   dayDelta — Calendar Day arithmetic (DST safe)
   ═══════════════════════════════════════════ */
describe('dayDelta', () => {
  it('tomorrow = 1', () => {
    expect(dayDelta(localDate(2026, 7, 31), localDate(2026, 8, 1))).toBe(1);
  });
  it('today = 0', () => {
    expect(dayDelta(localDate(2026, 7, 31), localDate(2026, 7, 31))).toBe(0);
  });
  it('yesterday = -1', () => {
    expect(dayDelta(localDate(2026, 7, 31), localDate(2026, 7, 30))).toBe(-1);
  });
  it('cross-month', () => {
    expect(dayDelta(localDate(2026, 7, 31), localDate(2026, 8, 5))).toBe(5);
  });
  it('cross-year', () => {
    expect(dayDelta(localDate(2026, 12, 30), localDate(2027, 1, 2))).toBe(3);
  });
});

/* ═══════════════════════════════════════════
   resolveNextOccurrence
   ═══════════════════════════════════════════ */
describe('resolveNextOccurrence', () => {
  it('none recurrence returns the single target', () => {
    const d = resolveNextOccurrence('2026-09-15', { type: 'none' }, localDate(2026, 7, 31));
    expect(formatLocalDateKey(d!)).toBe('2026-09-15');
  });
  it('yearly: ahead', () => {
    const d = resolveNextOccurrence('2026-12-01', { type: 'yearly' }, localDate(2026, 11, 1));
    expect(formatLocalDateKey(d!)).toBe('2026-12-01');
  });
  it('yearly: passed, rolls to next year', () => {
    const d = resolveNextOccurrence('2026-01-01', { type: 'yearly' }, localDate(2026, 7, 31));
    expect(formatLocalDateKey(d!)).toBe('2027-01-01');
  });
  it('yearly: 2.29 falls back to 2.28 in non-leap', () => {
    const d = resolveNextOccurrence('2024-02-29', { type: 'yearly' }, localDate(2025, 2, 15));
    expect(formatLocalDateKey(d!)).toBe('2025-02-28');
  });
  it('monthly: ahead', () => {
    const d = resolveNextOccurrence('2026-07-15', { type: 'monthly' }, localDate(2026, 7, 10));
    expect(formatLocalDateKey(d!)).toBe('2026-07-15');
  });
  it('monthly: passed, next month', () => {
    const d = resolveNextOccurrence('2026-07-15', { type: 'monthly' }, localDate(2026, 7, 20));
    expect(formatLocalDateKey(d!)).toBe('2026-08-15');
  });
  it('monthly: 1.31 → Feb = 2.28/29 end-of-month', () => {
    const d = resolveNextOccurrence('2026-01-31', { type: 'monthly' }, localDate(2026, 2, 1));
    expect(formatLocalDateKey(d!)).toBe('2026-02-28');
  });
});

/* ═══════════════════════════════════════════
   resolveCountdownDisplay — none recurrence
   ═══════════════════════════════════════════ */
describe('resolveCountdownDisplay — none recurrence', () => {
  const now = localDate(2026, 7, 31);

  it('tomorrow with auto: 還有 1 天', () => {
    const ev = makeEvent({ targetAt: '2026-08-01', direction: 'auto' });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.mode).toBe('upcoming');
    expect(d.dayCount).toBe(1);
    expect(d.label).toBe('還有 1 天');
  });

  it('today with auto: 就是今天', () => {
    const ev = makeEvent({ targetAt: '2026-07-31', direction: 'auto' });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.mode).toBe('today');
    expect(d.dayCount).toBe(0);
    expect(d.label).toBe('就是今天');
  });

  it('yesterday with auto: 已經過 1 天', () => {
    const ev = makeEvent({ targetAt: '2026-07-30', direction: 'auto' });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.mode).toBe('elapsed');
    expect(d.dayCount).toBe(1);
    expect(d.label).toBe('已經過 1 天');
  });

  it('until: expired → 已到期 (no negative)', () => {
    const ev = makeEvent({ targetAt: '2026-07-30', direction: 'until' });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.mode).toBe('elapsed');
    expect(d.expired).toBe(true);
    expect(d.label).toBe('已到期');
  });

  it('since: future → 尚未開始', () => {
    const ev = makeEvent({ targetAt: '2026-08-05', direction: 'since' });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.notStarted).toBe(true);
    expect(d.label).toBe('尚未開始');
  });

  it('since: includeTargetDay makes today=1', () => {
    const ev = makeEvent({ targetAt: '2026-07-31', direction: 'since', includeTargetDay: true });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.mode).toBe('elapsed');
    expect(d.dayCount).toBe(1);
    expect(d.label).toBe('已經過 1 天');
  });

  it('includeTargetDay: tomorrow with until = 1', () => {
    const ev = makeEvent({ targetAt: '2026-08-01', direction: 'until', includeTargetDay: true });
    const d = resolveCountdownDisplay(ev, now);
    expect(d.dayCount).toBe(1);
  });
});

/* ═══════════════════════════════════════════
   resolveCountdownDisplay — yearly recurrence
   ═══════════════════════════════════════════ */
describe('resolveCountdownDisplay — yearly recurrence', () => {
  it('yearly: upcoming this year', () => {
    const ev = makeEvent({ targetAt: '2025-12-25', recurrence: { type: 'yearly' }, direction: 'until' });
    const d = resolveCountdownDisplay(ev, localDate(2026, 11, 1));
    expect(d.mode).toBe('upcoming');
    expect(d.nextOccurrenceAt).toBe('2026-12-25');
  });

  it('yearly: passed, rolls to next year', () => {
    const ev = makeEvent({ targetAt: '2025-01-01', recurrence: { type: 'yearly' }, direction: 'auto' });
    const d = resolveCountdownDisplay(ev, localDate(2026, 7, 31));
    expect(d.nextOccurrenceAt).toBe('2027-01-01');
  });
});

/* ═══════════════════════════════════════════
   timezone fallback
   ═══════════════════════════════════════════ */
describe('timezone fallback', () => {
  it('detected local timezone is non-empty', () => {
    expect(detectLocalTimezone().length).toBeGreaterThan(0);
  });
  it('missing timezone via store normalize falls back to local', async () => {
    const { useCountdownStore } = await import('./useCountdownStore');
    useCountdownStore.setState({ events: [], schemaVersion: 1, widgetConfig: { size: 'medium', secondaryCount: 1, showBackgroundImage: false, hideElapsed: false } });
    const id = useCountdownStore.getState().addEvent({
      title: 'no-tz',
      targetAt: '2026-08-01',
      direction: 'auto',
      recurrence: { type: 'none' },
      includeTargetDay: false,
      showTime: false,
    });
    const ev = useCountdownStore.getState().events.find((e) => e.id === id)!;
    expect(ev.timezone).toBe(detectLocalTimezone());
  });
});

/* ═══════════════════════════════════════════
   resolveHomeCountdown — Phase 1.1
   ═══════════════════════════════════════════ */
describe('resolveHomeCountdown', () => {
  const now = today();

  it('empty events → showEmptyState', () => {
    const r = resolveHomeCountdown([], { hideElapsed: false }, now);
    expect(r.showEmptyState).toBe(true);
    expect(r.event).toBeNull();
    expect(r.reason).toBe('no-events');
  });

  it('pinned since event shows even with hideElapsed=true', () => {
    const ev = makeEvent({ targetAt: daysFromNow(-3), direction: 'since' });
    const r = resolveHomeCountdown([ev], { pinnedEventId: ev.id, hideElapsed: true }, now);
    expect(r.event?.id).toBe(ev.id);
    expect(r.reason).toBe('pinned');
    expect(r.showEmptyState).toBe(false);
  });

  it('pinned event takes priority over upcoming', () => {
    const pinned = makeEvent({ id: 'pinned', targetAt: daysFromNow(10), direction: 'auto' });
    const upcoming = makeEvent({ id: 'upcoming', targetAt: daysFromNow(2), direction: 'auto' });
    const r = resolveHomeCountdown([pinned, upcoming], { pinnedEventId: 'pinned', hideElapsed: false }, now);
    expect(r.event?.id).toBe('pinned');
    expect(r.reason).toBe('pinned');
  });

  it('prefers nearest upcoming when no pinned', () => {
    const far = makeEvent({ id: 'far', targetAt: daysFromNow(10), direction: 'auto' });
    const near = makeEvent({ id: 'near', targetAt: daysFromNow(2), direction: 'auto' });
    const r = resolveHomeCountdown([far, near], { hideElapsed: false }, now);
    expect(r.event?.id).toBe('near');
    expect(r.reason).toBe('nearest-upcoming');
  });

  it('falls back to elapsed when no upcoming', () => {
    const past = makeEvent({ targetAt: daysFromNow(-5), direction: 'auto' });
    const r = resolveHomeCountdown([past], { hideElapsed: false }, now);
    expect(r.event).toBeTruthy();
    expect(r.display?.mode).toBe('elapsed');
    expect(r.reason).toBe('fallback-elapsed');
  });

  it('falls back to today event', () => {
    const t = makeEvent({ targetAt: daysFromNow(0), direction: 'auto' });
    const r = resolveHomeCountdown([t], { hideElapsed: false }, now);
    expect(r.event).toBeTruthy();
    expect(r.reason).toBe('today');
  });

  it('hideElapsed filters past events but pinned survives', () => {
    const pinned = makeEvent({ id: 'p', targetAt: daysFromNow(-5), direction: 'since' });
    const r = resolveHomeCountdown([pinned], { pinnedEventId: 'p', hideElapsed: true }, now);
    expect(r.event?.id).toBe('p');
    expect(r.reason).toBe('pinned');
  });

  it('invalid pinnedEventId falls back to heuristic', () => {
    const ev = makeEvent({ targetAt: daysFromNow(5), direction: 'auto' });
    const r = resolveHomeCountdown([ev], { pinnedEventId: 'nonexistent', hideElapsed: false }, now);
    expect(r.event?.id).toBe(ev.id);
    expect(r.reason).toBe('nearest-upcoming');
  });

  it('hideElapsed with all past → fallback to most recent', () => {
    const past = makeEvent({ targetAt: daysFromNow(-3), direction: 'auto' });
    const r = resolveHomeCountdown([past], { hideElapsed: true }, now);
    expect(r.event?.id).toBe(past.id);
    expect(r.reason).toBe('hide-elapsed-fallback');
  });
});
