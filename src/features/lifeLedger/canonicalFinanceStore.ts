/**
 * Canonical Finance Store — Phase 1D-B
 *
 * Bridges LifeLedgerMutationService with the MoneyTransaction surface.
 * All writes go through the canonical mutation service.
 * After each canonical write, the result is synced to the Zustand store.
 *
 * Phase B note: the Cashflow presentation layer was retired to
 * artifacts/retired/cashflow-ui/. This bridge and the store cache are canonical
 * finance infrastructure and stay.
 *
 * Canonical DB is the single source of truth.
 * The Zustand moneyTransactions array is a derived read cache.
 *
 * FINANCE SAFETY LOCK (Life Utility Phase A): this module is canonical finance
 * infrastructure, not Cashflow presentation. A planned Cashflow UI retirement
 * must not delete this file, `moneyTransactions`, the `entries` finance records,
 * or the chat expense ingestion path.
 * See docs/reports/life-utility-phase-a-ownership-closure.md.
 */

import { useAppStore } from '@/store/useAppStore';
import type { MoneyTransaction } from '@/types';
import { lifeLedgerRepository } from './repository';
import { LifeLedgerMutationService } from './mutations';
import type { MutationResult } from './mutations';
import type { LifeLedgerEntry } from './domain';

const mutationService = new LifeLedgerMutationService(lifeLedgerRepository);

/* ══════════════════════════════════════
   Canonical → MoneyTransaction Mapper
   ══════════════════════════════════════ */

/**
 * Map a canonical LifeLedgerEntry (financial) back to MoneyTransaction shape.
 * Used after canonical writes to sync the Zustand store.
 */
export function canonicalEntryToMoneyTx(entry: LifeLedgerEntry): MoneyTransaction {
  const legacyId = entry.source.legacyId.replace(/^money-transaction:/, '');
  return {
    id: legacyId || entry.id,
    type: entry.type as 'income' | 'expense',
    amountMinor: entry.monetary?.amountMinor ?? 0,
    currency: entry.monetary?.currency ?? 'TWD',
    accountId: entry.monetary?.accountId ?? 'default',
    categoryId: entry.monetary?.categoryId ?? '其他',
    source: (entry.monetary?.origin ?? 'manual') as MoneyTransaction['source'],
    title: entry.title,
    note: entry.notes,
    occurredAt: entry.occurredAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Map all canonical finance entries to MoneyTransaction shape.
 * Filters out soft-deleted entries.
 */
export function canonicalFinanceEntriesToMoneyTxs(
  entries: LifeLedgerEntry[],
): MoneyTransaction[] {
  return entries
    .filter((e) => !e.deletedAt && (e.type === 'expense' || e.type === 'income'))
    .map(canonicalEntryToMoneyTx);
}

/* ══════════════════════════════════════
   Store Sync
   ══════════════════════════════════════ */

/**
 * Load all canonical finance entries and sync to Zustand store.
 * Called on Finance writer mount to ensure store is populated.
 */
export async function syncCanonicalFinanceToStore(): Promise<void> {
  const entries = await lifeLedgerRepository.getEntriesByType('expense');
  const incomeEntries = await lifeLedgerRepository.getEntriesByType('income');
  const allFinance = [...entries, ...incomeEntries];
  const moneyTxs = canonicalFinanceEntriesToMoneyTxs(allFinance);
  useAppStore.setState({ moneyTransactions: moneyTxs });
}

/**
 * After a canonical write, re-fetch all finance entries and sync to store.
 * This ensures the store always reflects the canonical state.
 */
export async function resyncFinanceStoreAfterWrite(): Promise<void> {
  await syncCanonicalFinanceToStore();
}

/* ══════════════════════════════════════
   Canonical CRUD Operations
   ══════════════════════════════════════ */

/**
 * Create a new financial entry through the canonical mutation service.
 * On success, syncs the store and returns the mutation result.
 */
export async function createCanonicalFinance(params: {
  title: string;
  occurredAt: string;
  amountMinor: number;
  currency: string;
  accountId: string;
  categoryId: string;
  origin: 'manual' | 'chat' | 'import';
  note?: string;
}): Promise<MutationResult> {
  const commandId = `fin:ui:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'CreateFinancialEntry',
    commandId,
    payload: {
      title: params.title,
      occurredAt: params.occurredAt,
      notes: params.note,
      monetary: {
        amountMinor: params.amountMinor,
        currency: params.currency,
        accountId: params.accountId,
        categoryId: params.categoryId,
        origin: params.origin,
      },
    },
  });
  if (result.status === 'committed') {
    await resyncFinanceStoreAfterWrite();
  }
  return result;
}

/**
 * Update an existing financial entry through the canonical mutation service.
 * The canonicalEntryId is the LifeLedgerEntry.id (e.g. "fin:fin:ui:..." or "life-ledger:v1:money-transaction:...").
 */
export async function updateCanonicalFinance(
  canonicalEntryId: string,
  expectedRevision: number,
  params: {
    title?: string;
    occurredAt?: string;
    amountMinor?: number;
    currency?: string;
    accountId?: string;
    categoryId?: string;
    note?: string;
  },
): Promise<MutationResult> {
  const commandId = `fin:ui:update:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'UpdateFinancialEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
    payload: {
      title: params.title,
      occurredAt: params.occurredAt,
      notes: params.note,
      monetary: params.amountMinor !== undefined ? {
        amountMinor: params.amountMinor,
        currency: params.currency,
        accountId: params.accountId,
        categoryId: params.categoryId,
      } : undefined,
    },
  });
  if (result.status === 'committed') {
    await resyncFinanceStoreAfterWrite();
  }
  return result;
}

/**
 * Soft-delete a financial entry through the canonical mutation service.
 */
export async function deleteCanonicalFinance(
  canonicalEntryId: string,
  expectedRevision: number,
): Promise<MutationResult> {
  const commandId = `fin:ui:delete:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'DeleteFinancialEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
  });
  if (result.status === 'committed') {
    await resyncFinanceStoreAfterWrite();
  }
  return result;
}

/**
 * Restore a soft-deleted financial entry (undo delete).
 */
export async function restoreCanonicalFinance(
  canonicalEntryId: string,
  expectedRevision: number,
): Promise<MutationResult> {
  const commandId = `fin:ui:restore:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'UpdateFinancialEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
    payload: {},
  });
  if (result.status === 'committed') {
    await resyncFinanceStoreAfterWrite();
  }
  return result;
}

/* ══════════════════════════════════════
   Lookup Helpers
   ══════════════════════════════════════ */

/**
 * Find a canonical finance entry by its ID.
 * Used for edits/deletes where we need the current revision.
 */
export async function findCanonicalFinanceEntry(
  canonicalEntryId: string,
): Promise<LifeLedgerEntry | undefined> {
  return lifeLedgerRepository.getEntryById(canonicalEntryId);
}

/**
 * Find canonical entry by MoneyTransaction ID (for migrated entries).
 * Migrated entries have source.legacyId = "money-transaction:<mtId>".
 */
export async function findCanonicalByMoneyTxId(
  moneyTxId: string,
): Promise<LifeLedgerEntry | undefined> {
  const entries = await lifeLedgerRepository.getEntriesBySourceOwner('money-transaction');
  return entries.find((e) => e.source.legacyId === `money-transaction:${moneyTxId}`);
}

/**
 * Get the canonical entry ID for a MoneyTransaction.
 * For migrated entries: canonicalLifeLedgerId('money-transaction', mtId)
 * For new entries: the entry.id from create result
 */
export function getCanonicalIdForMoneyTx(moneyTxId: string): string {
  // Check if the MoneyTransaction ID looks like a canonical ID already
  if (moneyTxId.startsWith('fin:') || moneyTxId.startsWith('life-ledger:')) {
    return moneyTxId;
  }
  // For migrated entries, compute the canonical ID
  return `life-ledger:v1:money-transaction:${moneyTxId}`;
}
