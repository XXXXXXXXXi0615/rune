import { describe, expect, it } from 'vitest';
import type { LifeLedgerEntry, LifeLedgerItemLifecycleEvent } from '@/features/lifeLedger/domain';
import { deriveItemLifecycleCounts, deriveRecentLifecycleChanges, visibleItemEntries } from './lifeUtilityContent';

const source = { owner: 'life-ledger' as const, legacyId: 'test', migrationVersion: 2 };
const item = (id: string, lifecycleState: NonNullable<LifeLedgerEntry['item']>['lifecycleState'], deletedAt?: string): LifeLedgerEntry => ({
  id, type: 'item', title: `物品 ${id}`, occurredAt: '2026-09-01', createdAt: '2026-09-01T00:00:00Z', deletedAt, source,
  item: { category: '其他', lifecycleState, startDate: '2026-09-01', usageDays: 1 },
});
const event = (id: string, itemEntryId: string, createdAt: string, from: LifeLedgerItemLifecycleEvent['from'], to: LifeLedgerItemLifecycleEvent['to']): LifeLedgerItemLifecycleEvent => ({
  id, itemEntryId, sequence: 1, source, from, to, action: 'transitioned', reason: '', emotion: '', createdAt,
});

describe('Calendar Life utility projections', () => {
  it('derives all five current counts from visible item state and excludes deleted records', () => {
    const entries = [item('a', 'active'), item('b', 'idle'), item('c', 'aging'), item('d', 'farewell'), item('e', 'retired'), item('x', 'active', '2026-09-02')];
    expect(visibleItemEntries(entries)).toHaveLength(5);
    expect(deriveItemLifecycleCounts(entries)).toEqual({ active: 1, idle: 1, aging: 1, farewell: 1, retired: 1 });
  });

  it('sorts events newest first, limits rows, renders idle, and safely handles missing items', () => {
    const entries = [item('a', 'active')];
    const result = deriveRecentLifecycleChanges(entries, [
      event('old', 'a', '2026-09-08T09:00:00Z', 'active', 'idle'),
      event('new', 'missing', '2026-09-11T09:00:00Z', 'idle', 'active'),
      event('middle', 'a', '2026-09-09T09:00:00Z', 'idle', 'aging'),
    ], 2, new Date('2026-09-11T12:00:00Z'));
    expect(result).toEqual([
      { id: 'new', itemName: '物品記錄已移除', transition: '閒置 → 使用中', dateLabel: '今天' },
      { id: 'middle', itemName: '物品 a', transition: '閒置 → 漸老', dateLabel: '09/09' },
    ]);
  });
});
