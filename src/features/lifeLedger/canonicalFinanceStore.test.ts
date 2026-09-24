import { describe, expect, it } from 'vitest';
import {
  canonicalEntryToMoneyTx,
  canonicalFinanceEntriesToMoneyTxs,
  getCanonicalIdForMoneyTx,
} from './canonicalFinanceStore';
import type { LifeLedgerEntry } from './domain';

function makeFinanceEntry(overrides: Partial<LifeLedgerEntry> = {}): LifeLedgerEntry {
  return {
    id: 'fin:test:1',
    type: 'expense',
    title: '午餐',
    occurredAt: '2026-08-25T12:00:00Z',
    createdAt: '2026-08-25T12:00:00Z',
    source: { owner: 'money-transaction', legacyId: 'money-transaction:mt-001', migrationVersion: 2 },
    monetary: { amountMinor: -15000, currency: 'TWD', accountId: 'cash', categoryId: '餐飲', origin: 'manual' },
    ...overrides,
  };
}

describe('canonicalFinanceStore — pure adapters', () => {
  describe('canonicalEntryToMoneyTx', () => {
    it('maps a canonical expense entry to MoneyTransaction shape', () => {
      const entry = makeFinanceEntry();
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.type).toBe('expense');
      expect(mt.amountMinor).toBe(-15000);
      expect(mt.currency).toBe('TWD');
      expect(mt.accountId).toBe('cash');
      expect(mt.categoryId).toBe('餐飲');
      expect(mt.source).toBe('manual');
      expect(mt.title).toBe('午餐');
      expect(mt.occurredAt).toBe('2026-08-25T12:00:00Z');
    });

    it('strips "money-transaction:" prefix from legacyId to get MT id', () => {
      const entry = makeFinanceEntry();
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.id).toBe('mt-001');
    });

    it('falls back to entry.id when legacyId is empty', () => {
      const entry = makeFinanceEntry({
        id: 'fin:new:1',
        source: { owner: 'life-ledger', legacyId: '', migrationVersion: 2 },
      });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.id).toBe('fin:new:1');
    });

    it('maps income entries correctly', () => {
      const entry = makeFinanceEntry({
        type: 'income',
        monetary: { amountMinor: 50000, currency: 'TWD', accountId: 'bank', categoryId: '薪資', origin: 'manual' },
      });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.type).toBe('income');
      expect(mt.amountMinor).toBe(50000);
    });

    it('maps chat-origin entries correctly', () => {
      const entry = makeFinanceEntry({
        monetary: { amountMinor: -3000, currency: 'TWD', accountId: 'default', categoryId: '交通', origin: 'chat' },
      });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.source).toBe('chat');
    });

    it('handles missing monetary fields gracefully', () => {
      const entry = makeFinanceEntry({ monetary: undefined });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.amountMinor).toBe(0);
      expect(mt.currency).toBe('TWD');
      expect(mt.accountId).toBe('default');
      expect(mt.categoryId).toBe('其他');
      expect(mt.source).toBe('manual');
    });

    it('preserves note from entry.notes', () => {
      const entry = makeFinanceEntry({ notes: '記得報帳' });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.note).toBe('記得報帳');
    });

    it('preserves createdAt and updatedAt', () => {
      const entry = makeFinanceEntry({
        createdAt: '2026-08-25T10:00:00Z',
        updatedAt: '2026-08-25T11:00:00Z',
      });
      const mt = canonicalEntryToMoneyTx(entry);
      expect(mt.createdAt).toBe('2026-08-25T10:00:00Z');
      expect(mt.updatedAt).toBe('2026-08-25T11:00:00Z');
    });
  });

  describe('canonicalFinanceEntriesToMoneyTxs', () => {
    it('filters out non-financial entries', () => {
      const entries: LifeLedgerEntry[] = [
        makeFinanceEntry({ id: 'fin:1' }),
        makeFinanceEntry({ id: 'fin:2', type: 'income' }),
        makeFinanceEntry({ id: 'item:1', type: 'item' }) as LifeLedgerEntry,
        makeFinanceEntry({ id: 'food:1', type: 'food' }) as LifeLedgerEntry,
      ];
      const result = canonicalFinanceEntriesToMoneyTxs(entries);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('mt-001'); // both use same legacyId, so both map to same
    });

    it('filters out soft-deleted entries', () => {
      const entries: LifeLedgerEntry[] = [
        makeFinanceEntry({ id: 'fin:1', deletedAt: '2026-08-25T12:00:00Z' }),
        makeFinanceEntry({ id: 'fin:2' }),
      ];
      const result = canonicalFinanceEntriesToMoneyTxs(entries);
      expect(result).toHaveLength(1);
    });

    it('maps multiple entries to correct shapes', () => {
      const entries: LifeLedgerEntry[] = [
        makeFinanceEntry({
          id: 'fin:1',
          source: { owner: 'money-transaction', legacyId: 'money-transaction:mt-a', migrationVersion: 2 },
          monetary: { amountMinor: -100, currency: 'TWD', accountId: 'cash', categoryId: '餐飲', origin: 'manual' },
        }),
        makeFinanceEntry({
          id: 'fin:2',
          source: { owner: 'money-transaction', legacyId: 'money-transaction:mt-b', migrationVersion: 2 },
          type: 'income',
          monetary: { amountMinor: 200, currency: 'USD', accountId: 'bank', categoryId: '薪資', origin: 'manual' },
        }),
      ];
      const result = canonicalFinanceEntriesToMoneyTxs(entries);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('mt-a');
      expect(result[0].amountMinor).toBe(-100);
      expect(result[1].id).toBe('mt-b');
      expect(result[1].type).toBe('income');
      expect(result[1].currency).toBe('USD');
    });

    it('returns empty array for empty input', () => {
      expect(canonicalFinanceEntriesToMoneyTxs([])).toEqual([]);
    });
  });

  describe('getCanonicalIdForMoneyTx', () => {
    it('returns the ID as-is when it starts with "fin:"', () => {
      expect(getCanonicalIdForMoneyTx('fin:ui:123:abc')).toBe('fin:ui:123:abc');
    });

    it('returns the ID as-is when it starts with "life-ledger:"', () => {
      expect(getCanonicalIdForMoneyTx('life-ledger:v1:money-transaction:mt-001')).toBe(
        'life-ledger:v1:money-transaction:mt-001',
      );
    });

    it('computes canonical ID for a plain MoneyTransaction ID', () => {
      expect(getCanonicalIdForMoneyTx('mt-001')).toBe('life-ledger:v1:money-transaction:mt-001');
    });

    it('computes canonical ID for a UUID MoneyTransaction ID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(getCanonicalIdForMoneyTx(uuid)).toBe(`life-ledger:v1:money-transaction:${uuid}`);
    });
  });
});
