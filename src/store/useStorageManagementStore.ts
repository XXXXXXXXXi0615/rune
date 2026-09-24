import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cacheRegistry, type CacheCategoryId } from '@/features/storage/cacheRegistry';
import type { CacheClearResult } from '@/features/storage/cacheService';

interface StorageManagementState {
  selectedIds: CacheCategoryId[];
  lastCleanedAt: number | null;
  lastResult: CacheClearResult | null;
  running: boolean;
  currentCategory: CacheCategoryId | null;
  toggleCategory(id: CacheCategoryId): void;
  setSelectedIds(ids: CacheCategoryId[]): void;
  setRunState(running: boolean, currentCategory?: CacheCategoryId | null): void;
  complete(result: CacheClearResult): void;
}

export const useStorageManagementStore = create<StorageManagementState>()(persist((set) => ({
  selectedIds: cacheRegistry.map((item) => item.id),
  lastCleanedAt: null,
  lastResult: null,
  running: false,
  currentCategory: null,
  toggleCategory: (id) => set((state) => ({ selectedIds: state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id] })),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  setRunState: (running, currentCategory = null) => set({ running, currentCategory }),
  complete: (lastResult) => set({ lastResult, lastCleanedAt: Date.now(), running: false, currentCategory: null }),
}), {
  name: 'lunartide-storage-management',
  partialize: (state) => ({ selectedIds: state.selectedIds, lastCleanedAt: state.lastCleanedAt }),
}));
