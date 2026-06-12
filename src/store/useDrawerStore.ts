import { create } from 'zustand';
import type { DrawerId } from '@/types';

interface DrawerState {
  activeDrawer: DrawerId | null;
  openDrawer: (id: DrawerId) => void;
  closeDrawer: () => void;
  closeAllDrawers: () => void;
}

export const useDrawerStore = create<DrawerState>((set) => ({
  activeDrawer: null,
  openDrawer: (id) => set({ activeDrawer: id }),
  closeDrawer: () => set({ activeDrawer: null }),
  closeAllDrawers: () => set({ activeDrawer: null }),
}));
