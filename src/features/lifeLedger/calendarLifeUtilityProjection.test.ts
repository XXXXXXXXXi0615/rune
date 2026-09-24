import { describe, expect, it } from 'vitest';
import type { LifeLedgerDietReceipt, LifeLedgerEntry } from './domain';
import { deriveDailyFinanceTotals, deriveDailyReceiptSummaries } from '@/components/calendar/lifeUtilityContent';

const source = { owner: 'life-ledger' as const, legacyId: 'test', migrationVersion: 2 };

describe('Calendar ledger and receipt read-only projections', () => {
  it('groups selected-day finance by canonical currency and performs no mutation', () => {
    const finance = (id: string, type: 'income' | 'expense', amountMinor: number, currency = 'TWD', occurredAt = '2026-09-12T08:00:00+08:00'): LifeLedgerEntry => ({
      id, type, title: id, occurredAt, createdAt: occurredAt, source,
      monetary: { amountMinor, currency, accountId: 'cash', categoryId: 'test', origin: 'manual' },
    });
    const entries = [finance('income', 'income', 50000), finance('expense', 'expense', 12500), finance('usd', 'expense', 900, 'usd'), finance('old', 'income', 999, 'TWD', '2026-09-11T12:00:00Z')];
    const before = structuredClone(entries);
    expect(deriveDailyFinanceTotals(entries, '2026-09-12')).toEqual([
      { currency: 'TWD', incomeMinor: 50000, expenseMinor: 12500, netMinor: 37500 },
      { currency: 'USD', incomeMinor: 0, expenseMinor: 900, netMinor: -900 },
    ]);
    expect(entries).toEqual(before);
  });

  it('reads canonical Life Ledger receipts newest-first and caps the panel at three', () => {
    const receipt = (id: string, date: string, createdAt: number, hasMeal?: boolean): LifeLedgerDietReceipt => ({
      id, source, date,
      mealEntryIds: hasMeal ? [`meal-${id}`] : [],
      totals: { calories: 420, protein: 0, carbs: 0, fat: 0, water: 0 },
      viewed: id === 'b', createdAt: new Date(createdAt).toISOString(), updatedAt: new Date(createdAt).toISOString(),
    });
    const result = deriveDailyReceiptSummaries([receipt('a', '2026-09-12', 1, true), receipt('b', '2026-09-12', 4), receipt('c', '2026-09-12', 3, true), receipt('d', '2026-09-12', 2, true), receipt('old', '2026-09-11', 9)], '2026-09-12');
    expect(result.map(({ id }) => id)).toEqual(['b', 'c', 'd']);
    expect(result[0]).toMatchObject({ title: '生活收據', mealCount: 0, viewed: true });
  });
});
