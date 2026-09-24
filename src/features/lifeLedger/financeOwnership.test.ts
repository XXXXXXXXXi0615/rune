/**
 * Life Utility Phase A — finance safety lock.
 *
 * Canonical finance owner: Life Ledger IndexedDB `entries` (expense / income) written
 * through `canonicalFinanceStore`; `useAppStore.moneyTransactions` is a derived read
 * cache for presentation. A planned Cashflow UI retirement must not delete this layer.
 * See docs/reports/life-utility-phase-a-ownership-closure.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import * as canonicalFinanceStore from './canonicalFinanceStore';
import type { LifeLedgerEntry } from './domain';
import { deriveDailyFinanceTotals } from '@/components/calendar/lifeUtilityContent';

const CASHFLOW_ONLY_FIELDS = ['subscriptions', 'ledgerBudgets', 'ledgerAccounts', 'paymentSources'];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

const source = { owner: 'money-transaction' as const, legacyId: 'tx:1', migrationVersion: 2 };

const financeEntry = (overrides: Partial<LifeLedgerEntry> = {}): LifeLedgerEntry => ({
  id: 'entry-1',
  type: 'expense',
  title: '底片',
  occurredAt: '2026-09-15T10:00:00.000Z',
  createdAt: '2026-09-15T10:00:00.000Z',
  source,
  monetary: { amountMinor: 12345, currency: 'TWD', accountId: 'cash', categoryId: 'photo', origin: 'manual' },
  ...overrides,
});

describe('Life Utility Phase A — canonical finance layer boundary', () => {
  it('keeps the chat expense ingestion path writing canonical finance', () => {
    // ChatPage confirms a parsed expense through addLedgerEntry (compat adapter → moneyTransactions).
    // Phase B retired the cashflow UI; this path must keep working.
    const before = useAppStore.getState().moneyTransactions.length;
    useAppStore.getState().addLedgerEntry({
      type: 'expense', amount: 42, currency: 'TWD', category: '生活', source: 'chat',
      title: '聊天記帳', date: '2026-09-15',
    });
    const entries = useAppStore.getState().moneyTransactions;
    expect(entries.length).toBe(before + 1);
    expect(entries.some((entry) => entry.type === 'expense' && entry.source === 'chat' && entry.amountMinor === 4200)).toBe(true);
  });

  it('keeps the retired cashflow presentation out of the source tree', () => {
    const retired = readFileSync('artifacts/retired/cashflow-ui/README.md', 'utf8');
    expect(retired).toContain('moneyTransactions');
    for (const file of ['src/components/ledger/MoneyHeroCard.tsx', 'src/components/ledger/LedgerWorkspace.tsx', 'src/store/useLedgerWindowStore.ts', 'src/pages/Subscriptions.tsx']) {
      expect(() => readFileSync(file, 'utf8')).toThrow();
    }
  });

  it('keeps the app-store finance cache and its CRUD contract', () => {
    const state = useAppStore.getState();
    expect(Array.isArray(state.moneyTransactions)).toBe(true);
    for (const action of ['addMoneyTransaction', 'updateMoneyTransaction', 'deleteMoneyTransaction']) {
      expect(typeof (state as unknown as Record<string, unknown>)[action]).toBe('function');
    }
  });

  it('keeps the canonical finance bridge API surface', () => {
    for (const fn of [
      'canonicalEntryToMoneyTx', 'canonicalFinanceEntriesToMoneyTxs', 'syncCanonicalFinanceToStore',
      'resyncFinanceStoreAfterWrite', 'createCanonicalFinance', 'updateCanonicalFinance',
      'deleteCanonicalFinance', 'restoreCanonicalFinance', 'findCanonicalFinanceEntry',
      'findCanonicalByMoneyTxId', 'getCanonicalIdForMoneyTx',
    ]) {
      expect(typeof (canonicalFinanceStore as unknown as Record<string, unknown>)[fn]).toBe('function');
    }
  });

  it('projects canonical finance entries without any cashflow presentation state', () => {
    const entry = financeEntry();
    expect(deriveDailyFinanceTotals([entry], '2026-09-15')).toEqual([
      { currency: 'TWD', incomeMinor: 0, expenseMinor: 12345, netMinor: -12345 },
    ]);
    expect(canonicalFinanceStore.canonicalEntryToMoneyTx(entry)).toMatchObject({
      id: 'tx:1', type: 'expense', amountMinor: 12345, currency: 'TWD', accountId: 'cash',
    });
  });

  it('keeps the canonical finance layer independent of cashflow-only state', () => {
    const offenders = collectSourceFiles('src/features/lifeLedger')
      .filter((file) => CASHFLOW_ONLY_FIELDS.some((field) => new RegExp(`\\b${field}\\b`).test(readFileSync(file, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('keeps the Life finance projection independent of cashflow presentation', () => {
    const projection = readFileSync('src/components/calendar/lifeUtilityContent.ts', 'utf8');
    for (const field of CASHFLOW_ONLY_FIELDS) {
      expect(projection).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });
});
