/**
 * Canonical Item Store — Phase 1D-B
 *
 * Bridges LifeLedgerMutationService with the existing ObjectMemory UI.
 * All writes go through the canonical mutation service.
 * After each canonical write, the result is synced to the Zustand store
 * so existing UI components continue reading unchanged.
 */

import { useObjectMemoryStore } from '@/store/objectMemoryStore';
import type { ObjectMemory } from '@/types';
import { lifeLedgerRepository } from './repository';
import { LifeLedgerMutationService } from './mutations';
import type { MutationResult } from './mutations';
import type { LifeLedgerEntry } from './domain';

const mutationService = new LifeLedgerMutationService(lifeLedgerRepository);

/* ══════════════════════════════════════
   Canonical → ObjectMemory Mapper
   ══════════════════════════════════════ */

type CanonicalLifecycleState = 'active' | 'idle' | 'aging' | 'farewell' | 'retired';

function mapCanonicalLifecycleToNative(state: CanonicalLifecycleState): ObjectMemory['lifecycleState'] {
  const map: Record<CanonicalLifecycleState, ObjectMemory['lifecycleState']> = {
    'active': 'active',
    'idle': 'active',
    'aging': 'aging',
    'farewell': 'farewell',
    'retired': 'retired',
  };
  return map[state] ?? 'active';
}

/**
 * Map a canonical LifeLedgerEntry (item) back to ObjectMemory shape.
 */
export function canonicalEntryToObjectMemory(entry: LifeLedgerEntry): ObjectMemory | undefined {
  if (entry.type !== 'item' || !entry.item) return undefined;
  const legacyId = entry.source.legacyId.replace(/^object-memory:/, '');
  return {
    id: legacyId || entry.id,
    name: entry.title,
    image: undefined,
    category: entry.item.category || '未分類',
    lifecycleState: mapCanonicalLifecycleToNative(entry.item.lifecycleState),
    startDate: entry.item.startDate,
    endDate: entry.item.endDate,
    notes: entry.notes ?? '',
    usageDays: entry.item.usageDays ?? 0,
    usageLogs: [],
    lifecycleEvents: [],
    createdAt: entry.createdAt ? new Date(entry.createdAt).getTime() : Date.now(),
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
  };
}

/* ══════════════════════════════════════
   Store Sync
   ══════════════════════════════════════ */

/**
 * Load all canonical item entries and sync to Zustand store.
 */
export async function syncCanonicalItemsToStore(): Promise<void> {
  const entries = await lifeLedgerRepository.getEntriesByType('item');
  const objects: ObjectMemory[] = [];
  for (const e of entries) {
    const obj = canonicalEntryToObjectMemory(e);
    if (obj) objects.push(obj);
  }
  useObjectMemoryStore.setState({ objects });
}

/**
 * Re-sync after a canonical write.
 */
export async function resyncItemsStoreAfterWrite(): Promise<void> {
  await syncCanonicalItemsToStore();
}

/* ══════════════════════════════════════
   Canonical CRUD Operations
   ══════════════════════════════════════ */

export async function createCanonicalItem(params: {
  name: string;
  category: string;
  startDate: string;
  endDate?: string;
  lifecycleState?: CanonicalLifecycleState;
  notes?: string;
}): Promise<MutationResult & { entryId?: string }> {
  const commandId = `item:ui:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'CreateItemEntry',
    commandId,
    payload: {
      title: params.name,
      occurredAt: params.startDate,
      notes: params.notes,
      item: {
        category: params.category,
        lifecycleState: params.lifecycleState ?? 'active',
        startDate: params.startDate,
        endDate: params.endDate,
        usageDays: 0,
      },
    },
  });
  if (result.status === 'committed') {
    await resyncItemsStoreAfterWrite();
  }
  return { ...result, entryId: result.status === 'committed' ? result.entityId : undefined };
}

export async function updateCanonicalItem(
  canonicalEntryId: string,
  expectedRevision: number,
  params: {
    name?: string;
    category?: string;
    lifecycleState?: CanonicalLifecycleState;
    startDate?: string;
    endDate?: string;
    notes?: string;
  },
): Promise<MutationResult> {
  const commandId = `item:ui:update:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'UpdateItemEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
    payload: {
      title: params.name,
      notes: params.notes,
      item: {
        category: params.category,
        lifecycleState: params.lifecycleState,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    },
  });
  if (result.status === 'committed') {
    await resyncItemsStoreAfterWrite();
  }
  return result;
}

export async function transitionCanonicalItemLifecycle(
  canonicalEntryId: string,
  expectedRevision: number,
  toState: CanonicalLifecycleState,
  note?: string,
): Promise<MutationResult> {
  const commandId = `item:ui:lifecycle:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'UpdateItemEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
    payload: {
      title: note,
      item: {
        lifecycleState: toState,
      },
    },
  });
  if (result.status === 'committed') {
    await resyncItemsStoreAfterWrite();
  }
  return result;
}

export async function deleteCanonicalItem(
  canonicalEntryId: string,
  expectedRevision: number,
): Promise<MutationResult> {
  const commandId = `item:ui:delete:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'DeleteItemEntry',
    commandId,
    entityId: canonicalEntryId,
    expectedRevision,
  });
  if (result.status === 'committed') {
    await resyncItemsStoreAfterWrite();
  }
  return result;
}

export async function addCanonicalUsageLog(
  canonicalEntryId: string,
  expectedRevision: number,
  log: { date: string; note: string; mood?: string },
): Promise<MutationResult> {
  const commandId = `item:ui:usage:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await mutationService.execute({
    type: 'AppendItemLifecycleEvent',
    commandId,
    itemEntryId: canonicalEntryId,
    expectedItemRevision: expectedRevision,
    payload: {
      from: 'active',
      to: 'active',
      action: 'edited',
      reason: `使用紀錄：${log.note}`,
      emotion: log.mood ?? 'neutral',
      note: log.note,
    },
  });
  if (result.status === 'committed') {
    await resyncItemsStoreAfterWrite();
  }
  return result;
}

/* ══════════════════════════════════════
   Lookup Helpers
   ══════════════════════════════════════ */

export async function findCanonicalItemEntry(
  canonicalEntryId: string,
): Promise<LifeLedgerEntry | undefined> {
  return lifeLedgerRepository.getEntryById(canonicalEntryId);
}

/**
 * Find canonical entry by ObjectMemory ID (for migrated entries).
 */
export async function findCanonicalByObjectMemoryId(
  objectMemoryId: string,
): Promise<LifeLedgerEntry | undefined> {
  const entries = await lifeLedgerRepository.getEntriesBySourceOwner('object-memory');
  return entries.find((e) => e.source.legacyId === `object-memory:${objectMemoryId}`);
}

export function getCanonicalIdForObjectMemory(objectMemoryId: string): string {
  if (objectMemoryId.startsWith('item:') || objectMemoryId.startsWith('life-ledger:')) {
    return objectMemoryId;
  }
  return `life-ledger:v1:object-memory:${objectMemoryId}`;
}
