import { describe, expect, it, vi } from 'vitest';
import { migrateUsageState } from '@/store/useUsageStore';
import type { UsageEvent } from '@/types/usage';

describe('usage event history persistence migration', () => {
  it('initializes legacy data without fabricating historical events', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12));
    const migrated = migrateUsageState({ sessions: [], dailyRecords: [] });
    expect(migrated.usageEvents).toEqual([]);
    expect(migrated.eventHistoryStartedAt).toBe(new Date(2026, 7, 13, 12).getTime());
    expect(migrated.lockEpisodeActive).toBe(false);
    expect(migrateUsageState(migrated)).toEqual(migrated);
    vi.useRealTimers();
  });

  it('retains only today plus the previous 89 local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12));
    const event = (id: string, date: Date): UsageEvent => ({
      id,
      type: 'lock_triggered',
      occurredAt: date.getTime(),
      dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    });
    const retained = event('retained', new Date(2026, 4, 16, 23, 59));
    const expired = event('expired', new Date(2026, 4, 15, 23, 59));
    const migrated = migrateUsageState({ usageEvents: [expired, retained], eventHistoryStartedAt: expired.occurredAt });
    expect(migrated.usageEvents).toEqual([retained]);
    vi.useRealTimers();
  });
});
