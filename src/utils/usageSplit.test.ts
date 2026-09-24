import { describe, expect, it } from 'vitest';
import { splitSessionAcrossMidnight } from '@/utils/usageSplit';
import { toLocalDateString } from '@/utils/date';
import type { UsageSession } from '@/types/usage';

function makeSession(startMs: number, moduleId = 'journal' as const): UsageSession {
  return {
    id: 'orig-id',
    moduleId,
    startedAt: startMs,
    dateKey: toLocalDateString(new Date(startMs)),
  };
}

// Local midnight of a given "end day" start-of-day timestamp helper
const dayStart = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 0, 0, 0, 0).getTime();

describe('splitSessionAcrossMidnight', () => {
  it('keeps same-day session as a single closed session', () => {
    const start = dayStart(2026, 8, 11) + 10 * 60 * 60 * 1000; // 10:00
    const end = start + 30 * 60 * 1000; // 10:30
    const s = makeSession(start);
    const out = splitSessionAcrossMidnight([], s, start, end);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('orig-id');
    expect(out[0].startedAt).toBe(start);
    expect(out[0].endedAt).toBe(end);
    expect(out[0].dateKey).toBe('2026-08-11');
  });

  it('splits 23:58 -> 00:07 into 2min day A + 7min day B', () => {
    const start = new Date(2026, 7, 10, 23, 58, 0, 0).getTime();
    const end = new Date(2026, 7, 11, 0, 7, 0, 0).getTime();
    const s = makeSession(start);
    const out = splitSessionAcrossMidnight([], s, start, end);

    expect(out).toHaveLength(2);
    const [a, b] = out;

    expect(a.dateKey).toBe('2026-08-10');
    expect(a.startedAt).toBe(start);
    expect(a.endedAt).toBe(dayStart(2026, 8, 11));
    expect((a.endedAt ?? 0) - a.startedAt).toBe(2 * 60 * 1000);
    expect(a.id).not.toBe('orig-id');

    expect(b.dateKey).toBe('2026-08-11');
    expect(b.startedAt).toBe(dayStart(2026, 8, 11));
    expect(b.endedAt).toBe(end);
    expect((b.endedAt ?? 0) - b.startedAt).toBe(7 * 60 * 1000);
    expect(b.id).not.toBe('orig-id');
  });

  it('splits a ms-level cross-boundary session (23:59:59.999 -> 00:00:00.001)', () => {
    const start = new Date(2026, 7, 10, 23, 59, 59, 999).getTime();
    const end = new Date(2026, 7, 11, 0, 0, 0, 1).getTime();
    const out = splitSessionAcrossMidnight([], makeSession(start), start, end);
    expect(out).toHaveLength(2);
    expect((out[0].endedAt ?? 0) - out[0].startedAt).toBe(1);
    expect((out[1].endedAt ?? 0) - out[1].startedAt).toBe(1);
    expect(out[0].dateKey).toBe('2026-08-10');
    expect(out[1].dateKey).toBe('2026-08-11');
  });

  it('treats a session starting exactly at midnight but ending same day as single', () => {
    const start = dayStart(2026, 8, 11); // 00:00
    const end = start + 5 * 60 * 1000; // 00:05 same day
    const out = splitSessionAcrossMidnight([], makeSession(start), start, end);
    expect(out).toHaveLength(1);
    expect(out[0].dateKey).toBe('2026-08-11');
    expect((out[0].endedAt ?? 0) - out[0].startedAt).toBe(5 * 60 * 1000);
  });

  it('appends split parts to existing sessions without mutating input', () => {
    const existing: UsageSession[] = [
      {
        id: 'old',
        moduleId: 'chat',
        startedAt: dayStart(2026, 8, 1),
        endedAt: dayStart(2026, 8, 1) + 1000,
        dateKey: '2026-08-01',
      },
    ];
    const start = new Date(2026, 7, 10, 23, 58, 0, 0).getTime();
    const end = new Date(2026, 7, 11, 0, 7, 0, 0).getTime();
    const out = splitSessionAcrossMidnight(existing, makeSession(start), start, end);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(existing[0]);
    expect(existing).toHaveLength(1);
  });
});