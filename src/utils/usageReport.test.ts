import { describe, expect, it } from 'vitest';
import { aggregateUsageEvents, aggregateUsageReport } from '@/features/usage/usageReport';
import type { DailyUsageRecord, UsageEvent } from '@/types/usage';

const minute = 60_000;
const records: DailyUsageRecord[] = [
  { dateKey: '2026-08-12', moduleDurationsMs: { home: 30 * minute, chat: 20 * minute }, totalDurationMs: 50 * minute },
  { dateKey: '2026-08-13', moduleDurationsMs: { chat: 40 * minute, music: 10 * minute }, totalDurationMs: 50 * minute },
];

describe('aggregateUsageReport', () => {
  it('aggregates exact totals, modules and sorting', () => {
    const result = aggregateUsageReport(records, '7days', new Date(2026, 7, 13, 12));
    expect(result.totalMs).toBe(100 * minute);
    expect(result.modules).toEqual([
      { moduleId: 'chat', durationMs: 60 * minute },
      { moduleId: 'home', durationMs: 30 * minute },
      { moduleId: 'music', durationMs: 10 * minute },
    ]);
    expect(result.moduleBreakdownComplete).toBe(true);
  });

  it('slices today, 7 days and 30 days by local date key', () => {
    const now = new Date(2026, 7, 13, 12);
    expect(aggregateUsageReport(records, 'today', now).days).toHaveLength(1);
    expect(aggregateUsageReport(records, '7days', now).days).toHaveLength(7);
    expect(aggregateUsageReport(records, '30days', now).days).toHaveLength(30);
  });

  it('calculates comparison only when previous canonical records exist', () => {
    const result = aggregateUsageReport([
      ...records,
      { dateKey: '2026-08-06', moduleDurationsMs: { home: 50 * minute }, totalDurationMs: 50 * minute },
    ], '7days', new Date(2026, 7, 13, 12));
    expect(result.previousTotalMs).toBe(50 * minute);
    expect(result.comparisonPercent).toBe(100);
    expect(aggregateUsageReport(records, 'today', new Date(2026, 7, 20, 12)).comparisonPercent).toBeNull();
  });

  it('marks partial legacy module data without inventing a remainder', () => {
    const result = aggregateUsageReport([
      { dateKey: '2026-08-13', moduleDurationsMs: { chat: 10 * minute }, totalDurationMs: 50 * minute },
    ], 'today', new Date(2026, 7, 13, 12));
    expect(result.totalMs).toBe(50 * minute);
    expect(result.modules).toEqual([{ moduleId: 'chat', durationMs: 10 * minute }]);
    expect(result.moduleBreakdownComplete).toBe(false);
  });
});

describe('aggregateUsageEvents', () => {
  const now = new Date(2026, 7, 13, 12);
  const timestamp = (day: number, hour = 12) => new Date(2026, 7, day, hour).getTime();
  const events: UsageEvent[] = [
    { id: 'lock-1', type: 'lock_triggered', occurredAt: timestamp(12, 9), dateKey: '2026-08-12', dailyUsageMs: minute, dailyLimitMinutes: 1 },
    { id: 'extension-1', type: 'extension_granted', occurredAt: timestamp(12, 9), dateKey: '2026-08-12', extensionMinutes: 10 },
    { id: 'lock-2', type: 'lock_triggered', occurredAt: timestamp(12, 10), dateKey: '2026-08-12', dailyUsageMs: minute, dailyLimitMinutes: 1 },
    { id: 'lock-3', type: 'lock_triggered', occurredAt: timestamp(13, 9), dateKey: '2026-08-13', dailyUsageMs: minute, dailyLimitMinutes: 1 },
    { id: 'old-lock', type: 'lock_triggered', occurredAt: timestamp(1), dateKey: '2026-08-01', dailyUsageMs: minute, dailyLimitMinutes: 1 },
  ];

  it('counts only canonical events inside today, 7-day and 30-day ranges', () => {
    expect(aggregateUsageEvents(events, timestamp(1), 'today', now)).toMatchObject({ lockTriggers: 1, extensionGrants: 0 });
    expect(aggregateUsageEvents(events, timestamp(1), '7days', now)).toMatchObject({ lockTriggers: 3, extensionGrants: 1 });
    expect(aggregateUsageEvents(events, timestamp(1), '30days', now)).toMatchObject({ lockTriggers: 4, extensionGrants: 1 });
  });

  it('distinguishes a covered zero from partial historical coverage', () => {
    expect(aggregateUsageEvents([], timestamp(13, 0), 'today', now)).toMatchObject({
      lockTriggers: 0,
      extensionGrants: 0,
      coverageComplete: true,
    });
    expect(aggregateUsageEvents(events, timestamp(10), '7days', now).coverageComplete).toBe(false);
  });
});
