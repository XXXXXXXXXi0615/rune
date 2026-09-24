import { create } from 'zustand';

interface UndoToastState {
  entryId: string | null;
  message: string;
  expiresAt: number;
  show: (entryId: string) => void;
  clear: () => void;
}

export const useUndoToastStore = create<UndoToastState>((set) => ({
  entryId: null,
  message: '',
  expiresAt: 0,
  show: (entryId) => set({ entryId, message: '已從總覽隱藏這則手記', expiresAt: Date.now() + 6000 }),
  clear: () => set({ entryId: null, message: '', expiresAt: 0 }),
}));
