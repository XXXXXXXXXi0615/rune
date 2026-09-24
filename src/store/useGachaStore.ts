import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GachaPool,
  GachaItem,
  GachaDrawRecord,
  GachaDrawMode,
  GachaProbabilityMode,
  GachaRevealMode,
  GachaMachineSkin,
} from '@/types';
import { markInteractiveAssetCandidates, runInteractiveAssetCleanup } from '@/storage/interactiveAssetLifecycle';
import { migrateLegacyGachaAsset } from '@/storage/gachaAssetStorage';
import type { DuplicateMode } from '@/algorithm/gachaBulkParser';

export interface UndoSnapshot {
  items: GachaItem[];
  poolId: string;
  poolItemIds: string[];
  timestamp: number;
}

interface GachaStoreState {
  pools: GachaPool[];
  items: GachaItem[];
  drawRecords: GachaDrawRecord[];
  excludedItemIds: Record<string, string[]>;
  migrationDone: boolean;

  createPool: (data: {
    name: string;
    description?: string;
    coverAssetId?: string;
    probabilityMode: GachaProbabilityMode;
    drawMode: GachaDrawMode;
    revealMode: GachaRevealMode;
    machineSkin: GachaMachineSkin;
  }) => string;

  updatePool: (poolId: string, data: Partial<{
    name: string;
    description: string;
    coverAssetId: string | null;
    probabilityMode: GachaProbabilityMode;
    drawMode: GachaDrawMode;
    revealMode: GachaRevealMode;
    machineSkin: GachaMachineSkin;
  }>) => void;

  deletePool: (poolId: string) => void;
  archivePool: (poolId: string, archived?: boolean) => void;
  duplicatePool: (poolId: string) => string;
  touchPool: (poolId: string) => void;
  resetPoolCycle: (poolId: string) => void;

  createItem: (data: {
    poolId: string;
    title: string;
    content?: string;
    imageAssetId?: string;
    accent?: string;
    weight: number;
    sortOrder?: number;
  }) => string;

  updateItem: (itemId: string, data: Partial<{
    title: string;
    content: string;
    imageAssetId: string | null;
    accent: string;
    weight: number;
    enabled: boolean;
    sortOrder: number;
  }>) => void;

  deleteItem: (itemId: string) => void;
  duplicateItem: (itemId: string) => string;

  batchAddItems: (items: Array<{
    poolId: string;
    title: string;
    weight: number;
    enabled?: boolean;
    sortOrder?: number;
  }>) => string[];

  bulkEnableItems: (itemIds: string[]) => void;
  bulkDisableItems: (itemIds: string[]) => void;
  bulkDeleteItems: (itemIds: string[]) => void;

  importWithMerge: (
    poolId: string,
    toAdd: Array<{ title: string; weight: number }>,
    toMerge: Array<{ title: string; weight: number; existingItemId: string }>,
    duplicateMode: DuplicateMode,
  ) => { added: number; merged: number };

  getImportSnapshot: () => UndoSnapshot | null;
  popImportSnapshot: () => UndoSnapshot | null;
  restoreImportSnapshot: (snap: UndoSnapshot) => void;

  getDeleteSnapshot: () => UndoSnapshot | null;
  popDeleteSnapshot: () => UndoSnapshot | null;
  restoreDeleteSnapshot: (snap: UndoSnapshot) => void;

  addExcludedItemId: (poolId: string, itemId: string) => void;
  clearExcludedItemIds: (poolId: string) => void;
  getExcludedIds: (poolId: string) => string[];

  addDrawRecord: (record: Omit<GachaDrawRecord, 'id'>) => string;
  toggleFavoriteRecord: (recordId: string) => void;
  markRecordSentToChat: (recordId: string, messageId: string) => void;
  deleteDrawRecord: (recordId: string) => void;
  clearDrawRecords: (poolId?: string) => void;

  runOrphanCleanup: () => Promise<number>;
  runMigration: () => void;
}

let _lastImportSnapshot: UndoSnapshot | null = null;
let _lastDeleteSnapshot: UndoSnapshot | null = null;

export const useGachaStore = create<GachaStoreState>()(
  persist(
    (set, get) => ({
      pools: [],
      items: [],
      drawRecords: [],
      excludedItemIds: {},
      migrationDone: false,

      createPool(data) {
        const id = crypto.randomUUID();
        const now = Date.now();
        const pool: GachaPool = {
          id,
          name: data.name,
          description: data.description,
          coverAssetId: data.coverAssetId,
          probabilityMode: data.probabilityMode,
          drawMode: data.drawMode,
          revealMode: data.revealMode,
          machineSkin: data.machineSkin,
          itemIds: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ pools: [...s.pools, pool] }));
        return id;
      },

      updatePool(poolId, data) {
        set((s) => ({
          pools: s.pools.map((p) => {
            if (p.id !== poolId) return p;
            const cleaned: Partial<GachaPool> = { updatedAt: Date.now() };
            for (const [k, v] of Object.entries(data)) {
              if (v === null) (cleaned as any)[k] = undefined;
              else (cleaned as any)[k] = v;
            }
            return { ...p, ...cleaned };
          }),
        }));
      },

      deletePool(poolId) {
        const state = get();
        const pool = state.pools.find((p) => p.id === poolId);
        if (!pool) return;
        const poolItemIds = new Set(
          state.items.filter((i) => i.poolId === poolId).map((i) => i.id),
        );
        const assetIdsToDelete = state.items
          .filter(
            (i) =>
              i.poolId === poolId &&
              i.imageAssetId,
          )
          .map((i) => i.imageAssetId!)
          .filter((aid) => {
            const otherRefs = state.items.filter(
              (i) => !poolItemIds.has(i.id) && i.imageAssetId === aid,
            ).length;
            const coverRefs = state.pools.filter(
              (p) => p.id !== poolId && p.coverAssetId === aid,
            ).length;
            return otherRefs === 0 && coverRefs === 0;
          });

        // Keep referenced image blobs recoverable for the 8-second pool undo window
        // and for immutable draw/message snapshots. Orphan cleanup can reclaim them later.
        void assetIdsToDelete;

        const remainingItems = state.items.filter(
          (i) => i.poolId !== poolId,
        );
        const remainingExcluded = { ...state.excludedItemIds };
        delete remainingExcluded[poolId];

        set({
          pools: state.pools.filter((p) => p.id !== poolId),
          items: remainingItems,
          // Draw records are immutable historical snapshots and outlive their pool.
          drawRecords: state.drawRecords,
          excludedItemIds: remainingExcluded,
        });
      },

      archivePool(poolId, archived = true) {
        set((state) => ({ pools: state.pools.map((pool) => pool.id === poolId ? { ...pool, archivedAt: archived ? Date.now() : undefined, updatedAt: Date.now() } : pool) }));
      },

      duplicatePool(poolId) {
        const state = get();
        const source = state.pools.find((p) => p.id === poolId);
        if (!source) return '';
        const now = Date.now();
        const newId = crypto.randomUUID();

        const newItems: GachaItem[] = [];
        for (const item of state.items.filter((i) => i.poolId === poolId)) {
          const newItemId = crypto.randomUUID();
          newItems.push({
            ...item,
            id: newItemId,
            poolId: newId,
            createdAt: now,
            updatedAt: now,
          });
        }

        const newPool: GachaPool = {
          ...source,
          id: newId,
          name: `${source.name} (複製)`,
          itemIds: newItems.map((i) => i.id),
          lastUsedAt: undefined,
          createdAt: now,
          updatedAt: now,
        };

        set({
          pools: [...state.pools, newPool],
          items: [...state.items, ...newItems],
        });
        return newId;
      },

      touchPool(poolId) {
        set((s) => ({
          pools: s.pools.map((p) =>
            p.id === poolId ? { ...p, lastUsedAt: Date.now() } : p,
          ),
        }));
      },

      resetPoolCycle(poolId) {
        get().clearExcludedItemIds(poolId);
      },

      createItem(data) {
        const id = crypto.randomUUID();
        const now = Date.now();
        const item: GachaItem = {
          id,
          poolId: data.poolId,
          title: data.title,
          content: data.content,
          imageAssetId: data.imageAssetId,
          accent: data.accent,
          weight: Math.max(1, Math.round(data.weight)),
          enabled: true,
          sortOrder: data.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          items: [...s.items, item],
          pools: s.pools.map((p) =>
            p.id === data.poolId
              ? { ...p, itemIds: [...p.itemIds, id], updatedAt: now }
              : p,
          ),
        }));
        return id;
      },

      updateItem(itemId, data) {
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== itemId) return i;
            const cleaned: Partial<GachaItem> = { updatedAt: Date.now() };
            for (const [k, v] of Object.entries(data)) {
              if (v === null) (cleaned as any)[k] = undefined;
              else if (k === 'weight') cleaned.weight = Math.max(1, Math.round(v as number));
              else (cleaned as any)[k] = v;
            }
            return { ...i, ...cleaned };
          }),
        }));
      },

      deleteItem(itemId) {
        const state = get();
        const item = state.items.find((i) => i.id === itemId);
        if (!item) return;
        if (item.imageAssetId) {
          const otherRefs = state.items.filter(
            (i) => i.id !== itemId && i.imageAssetId === item.imageAssetId,
          ).length;
          if (otherRefs === 0) {
            markInteractiveAssetCandidates([item.imageAssetId], `deleted-gacha-item:${itemId}`);
          }
        }
        set({
          items: state.items.filter((i) => i.id !== itemId),
          pools: state.pools.map((p) =>
            p.id === item.poolId
              ? { ...p, itemIds: p.itemIds.filter((id) => id !== itemId), updatedAt: Date.now() }
              : p,
          ),
        });
      },

      duplicateItem(itemId) {
        const state = get();
        const source = state.items.find((i) => i.id === itemId);
        if (!source) return '';
        const newId = crypto.randomUUID();
        const now = Date.now();
        const newItem: GachaItem = {
          ...source,
          id: newId,
          title: `${source.title} (複製)`,
          createdAt: now,
          updatedAt: now,
        };
        set({
          items: [...state.items, newItem],
          pools: state.pools.map((p) =>
            p.id === source.poolId
              ? { ...p, itemIds: [...p.itemIds, newId], updatedAt: now }
              : p,
          ),
        });
        return newId;
      },

      batchAddItems(batch) {
        const now = Date.now();
        const newItems: GachaItem[] = batch.map((b, idx) => ({
          id: crypto.randomUUID(),
          poolId: b.poolId,
          title: b.title,
          weight: Math.max(1, Math.round(b.weight)),
          enabled: b.enabled ?? true,
          sortOrder: b.sortOrder ?? idx,
          createdAt: now,
          updatedAt: now,
        }));

        const poolUpdates = new Map<string, string[]>();
        for (const item of newItems) {
          const arr = poolUpdates.get(item.poolId) || [];
          arr.push(item.id);
          poolUpdates.set(item.poolId, arr);
        }

        set((s) => ({
          items: [...s.items, ...newItems],
          pools: s.pools.map((p) => {
            const ids = poolUpdates.get(p.id);
            if (!ids) return p;
            return { ...p, itemIds: [...p.itemIds, ...ids], updatedAt: now };
          }),
        }));

        return newItems.map((i) => i.id);
      },

      bulkEnableItems(itemIds) {
        const setIds = new Set(itemIds);
        set((s) => ({
          items: s.items.map((i) =>
            setIds.has(i.id) ? { ...i, enabled: true, updatedAt: Date.now() } : i,
          ),
        }));
      },

      bulkDisableItems(itemIds) {
        const setIds = new Set(itemIds);
        set((s) => ({
          items: s.items.map((i) =>
            setIds.has(i.id) ? { ...i, enabled: false, updatedAt: Date.now() } : i,
          ),
        }));
      },

      bulkDeleteItems(itemIds) {
        const state = get();
        const idsToDelete = new Set(itemIds);
        const itemsToDelete = state.items.filter((i) => idsToDelete.has(i.id));

        // Snapshot before delete for undo
        _lastDeleteSnapshot = {
          items: itemsToDelete.map((i) => ({ ...i })),
          poolId: itemsToDelete[0]?.poolId || '',
          poolItemIds: itemsToDelete.map((i) => i.id),
          timestamp: Date.now(),
        };

        // Asset cleanup
        for (const item of itemsToDelete) {
          if (item.imageAssetId) {
            const otherRefs = state.items.filter(
              (i) => !idsToDelete.has(i.id) && i.imageAssetId === item.imageAssetId,
            ).length;
            if (otherRefs === 0) {
              markInteractiveAssetCandidates([item.imageAssetId], 'bulk-deleted-gacha-items');
            }
          }
        }

        // Clean excludedItemIds
        const newExcluded = { ...state.excludedItemIds };
        for (const poolId of new Set(itemsToDelete.map((i) => i.poolId))) {
          if (newExcluded[poolId]) {
            newExcluded[poolId] = newExcluded[poolId].filter((eid) => !idsToDelete.has(eid));
          }
        }

        set({
          items: state.items.filter((i) => !idsToDelete.has(i.id)),
          pools: state.pools.map((p) => {
            const hasDeleted = p.itemIds.some((id) => idsToDelete.has(id));
            if (!hasDeleted) return p;
            return {
              ...p,
              itemIds: p.itemIds.filter((id) => !idsToDelete.has(id)),
              updatedAt: Date.now(),
            };
          }),
          excludedItemIds: newExcluded,
        });
      },

      importWithMerge(poolId, toAdd, toMerge, duplicateMode) {
        const state = get();
        const now = Date.now();
        const pool = state.pools.find((p) => p.id === poolId);
        if (!pool) return { added: 0, merged: 0 };

        // Snapshot for undo
        const existingPoolItems = state.items.filter((i) => i.poolId === poolId);
        _lastImportSnapshot = {
          items: [],
          poolId,
          poolItemIds: pool.itemIds,
          timestamp: now,
        };

        let added = 0;
        let merged = 0;
        const newItems: GachaItem[] = [];

        if (duplicateMode === 'skip') {
          for (const a of toAdd) {
            newItems.push({
              id: crypto.randomUUID(),
              poolId,
              title: a.title,
              weight: Math.max(1, Math.round(a.weight)),
              enabled: true,
              sortOrder: pool.itemIds.length + newItems.length,
              createdAt: now,
              updatedAt: now,
            });
            added++;
          }
        } else if (duplicateMode === 'add') {
          for (const a of toAdd) {
            newItems.push({
              id: crypto.randomUUID(),
              poolId,
              title: a.title,
              weight: Math.max(1, Math.round(a.weight)),
              enabled: true,
              sortOrder: pool.itemIds.length + newItems.length,
              createdAt: now,
              updatedAt: now,
            });
            added++;
          }
          // Also add duplicates as new items
          for (const m of toMerge) {
            newItems.push({
              id: crypto.randomUUID(),
              poolId,
              title: m.title,
              weight: Math.max(1, Math.round(m.weight)),
              enabled: true,
              sortOrder: pool.itemIds.length + newItems.length,
              createdAt: now,
              updatedAt: now,
            });
            added++;
          }
        } else if (duplicateMode === 'merge') {
          for (const a of toAdd) {
            newItems.push({
              id: crypto.randomUUID(),
              poolId,
              title: a.title,
              weight: Math.max(1, Math.round(a.weight)),
              enabled: true,
              sortOrder: pool.itemIds.length + newItems.length,
              createdAt: now,
              updatedAt: now,
            });
            added++;
          }
          // Merge weights into existing items
          for (const m of toMerge) {
            const existing = state.items.find((i) => i.id === m.existingItemId);
            if (existing) {
              const newWeight = Math.max(1, Math.round(existing.weight + m.weight));
              set((s) => ({
                items: s.items.map((i) =>
                  i.id === m.existingItemId
                    ? { ...i, weight: newWeight, updatedAt: now }
                    : i,
                ),
              }));
              merged++;
            }
          }
        }

        if (newItems.length > 0) {
          set((s) => ({
            items: [...s.items, ...newItems],
            pools: s.pools.map((p) =>
              p.id === poolId
                ? {
                    ...p,
                    itemIds: [...p.itemIds, ...newItems.map((i) => i.id)],
                    updatedAt: now,
                  }
                : p,
            ),
          }));
        }

        return { added, merged };
      },

      getImportSnapshot() {
        return _lastImportSnapshot;
      },

      popImportSnapshot() {
        const snap = _lastImportSnapshot;
        _lastImportSnapshot = null;
        return snap;
      },

      restoreImportSnapshot(snap) {
        const state = get();
        const snapItemIds = new Set(snap.items.map((i) => i.id));

        // Remove items that were added during import
        const remainingItems = state.items.filter((i) => !snapItemIds.has(i.id));
        const remainingPoolItemIds = snap.poolItemIds.filter((id) => !snapItemIds.has(id));

        // Restore the pool's itemIds to pre-import state
        set({
          items: remainingItems,
          pools: state.pools.map((p) =>
            p.id === snap.poolId
              ? { ...p, itemIds: remainingPoolItemIds, updatedAt: Date.now() }
              : p,
          ),
        });
      },

      getDeleteSnapshot() {
        return _lastDeleteSnapshot;
      },

      popDeleteSnapshot() {
        const snap = _lastDeleteSnapshot;
        _lastDeleteSnapshot = null;
        return snap;
      },

      restoreDeleteSnapshot(snap) {
        const state = get();
        // Re-add deleted items
        set({
          items: [...state.items, ...snap.items],
          pools: state.pools.map((p) => {
            if (p.id !== snap.poolId) return p;
            const existingIds = new Set(p.itemIds);
            const idsToRestore = snap.items
              .map((i) => i.id)
              .filter((id) => !existingIds.has(id));
            return {
              ...p,
              itemIds: [...p.itemIds, ...idsToRestore],
              updatedAt: Date.now(),
            };
          }),
        });
      },

      addExcludedItemId(poolId, itemId) {
        set((s) => ({
          excludedItemIds: {
            ...s.excludedItemIds,
            [poolId]: [...(s.excludedItemIds[poolId] || []), itemId],
          },
        }));
      },

      clearExcludedItemIds(poolId) {
        set((s) => ({
          excludedItemIds: {
            ...s.excludedItemIds,
            [poolId]: [],
          },
        }));
      },

      getExcludedIds(poolId) {
        return get().excludedItemIds[poolId] || [];
      },

      addDrawRecord(data) {
        const id = crypto.randomUUID();
        const record: GachaDrawRecord = { id, ...data };
        set((s) => ({
          drawRecords: [record, ...s.drawRecords],
        }));
        return id;
      },

      toggleFavoriteRecord(recordId) {
        set((s) => ({
          drawRecords: s.drawRecords.map((r) =>
            r.id === recordId ? { ...r, favorited: !r.favorited } : r,
          ),
        }));
      },

      markRecordSentToChat(recordId, messageId) {
        set((s) => ({
          drawRecords: s.drawRecords.map((r) =>
            r.id === recordId
              ? { ...r, sentToChatAt: Date.now(), messageId }
              : r,
          ),
        }));
      },

      deleteDrawRecord(recordId) {
        set((s) => ({
          drawRecords: s.drawRecords.filter((r) => r.id !== recordId),
        }));
      },

      clearDrawRecords(poolId) {
        if (poolId) {
          set((s) => ({
            drawRecords: s.drawRecords.filter((r) => r.poolId !== poolId),
          }));
        } else {
          set({ drawRecords: [] });
        }
      },

      async runOrphanCleanup() {
        const state = get();
        try {
          const { useAppStore } = await import('./useAppStore');
          const messages = useAppStore.getState().conversations.flatMap((conversation) => conversation.messages || []);
          const result = await runInteractiveAssetCleanup({ pools: state.pools, items: state.items, drawRecords: state.drawRecords, undoSnapshots: [_lastDeleteSnapshot ? { items: _lastDeleteSnapshot.items } : {}], messages });
          return result.removed.length;
        } catch {
          return 0;
        }
      },

      runMigration() {
        const state = get();
        const referencedAssetIds = [
          ...state.pools.map((pool) => pool.coverAssetId),
          ...state.items.map((item) => item.imageAssetId),
          ...state.drawRecords.map((record) => record.imageAssetIdSnapshot),
        ].filter((id): id is string => Boolean(id));
        void Promise.allSettled([...new Set(referencedAssetIds)].map((id) => migrateLegacyGachaAsset(id)));
        if (state.migrationDone) return;
        if (state.pools.length > 0) {
          set({ migrationDone: true });
          return;
        }

        try {
          const oldWeightsRaw = localStorage.getItem('lunartide_chat_gacha_weights_v1');
          const oldObtainedRaw = localStorage.getItem('lunartide_chat_gacha_items_v1');

          if (oldWeightsRaw || oldObtainedRaw) {
            if (import.meta.env.DEV) {
              console.warn('[Gacha Migration] Old chat gacha data found, migrating to default pool');
            }
          }
        } catch {
          /* ignore */
        }

        set({ migrationDone: true });
      },
    }),
    {
      name: 'lunartide-gacha',
      version: 1,
      partialize: (state) => ({
        pools: state.pools,
        items: state.items,
        drawRecords: state.drawRecords,
        excludedItemIds: state.excludedItemIds,
        migrationDone: state.migrationDone,
      }),
    },
  ),
);
