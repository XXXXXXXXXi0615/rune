import { beforeEach, describe, expect, it } from 'vitest';
import { createDailySettlementReceipt, DAILY_SETTLEMENT_STORAGE_KEY, deriveDailySettlement, loadDailySettlementReceipts } from './dailySettlement';
import type { DailySettlementSources } from './dailySettlement';

const empty = (): DailySettlementSources => ({ quests: [], checkIns: [], focusSessions: [], hydrationEntries: [], hydrationTargetMl: 2000, moonlexEntries: [], moonlexPracticeRecords: [] });

describe('Calendar Daily Settlement artifact', () => {
  beforeEach(() => localStorage.removeItem(DAILY_SETTLEMENT_STORAGE_KEY));

  it('derives deterministic canonical task counts and omits missing sources', () => {
    const sources = empty();
    sources.quests = [
      { id: 'a', title: 'A', status: 'completed', dueAt: '2026-09-15T08:00:00Z' },
      { id: 'b', title: 'B', status: 'available', dueAt: '2026-09-15T09:00:00Z' },
    ] as DailySettlementSources['quests'];
    const first = deriveDailySettlement('2026-09-15', sources);
    const second = deriveDailySettlement('2026-09-15', structuredClone(sources));
    expect(first).toEqual(second);
    expect(first.snapshot.lines).toEqual([{ key: 'tasks', label: 'TIDEQUEST', value: '完成 1 · 未完成 1' }]);
  });

  it('creates immutable linked revisions and retains the original receipt', () => {
    const original = deriveDailySettlement('2026-09-15', empty());
    const first = createDailySettlementReceipt('2026-09-15', original, new Date('2026-09-15T10:00:00Z'));
    const changedSources = empty();
    changedSources.hydrationEntries = [{ id: 'water', dateKey: '2026-09-15', amountMl: 500, recordedAt: 1, source: 'custom' }];
    const second = createDailySettlementReceipt('2026-09-15', deriveDailySettlement('2026-09-15', changedSources), new Date('2026-09-15T11:00:00Z'));
    const receipts = loadDailySettlementReceipts();
    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toEqual(first);
    expect(first.snapshot.emptyMessage).toBe('今天沒有留下可結算的紀錄。');
    expect(second).toMatchObject({ revision: 2, previousReceiptId: first.id });
    expect(first.snapshot.lines).toEqual([]);
  });
});
