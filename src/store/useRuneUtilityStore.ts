import { create } from 'zustand';

interface RuneUtilityState {
  open: boolean;
  openLauncher: () => void;
  closeLauncher: () => void;
  toggleLauncher: () => void;
}

export const useRuneUtilityStore = create<RuneUtilityState>((set) => ({
  open: false,
  openLauncher: () => set({ open: true }),
  closeLauncher: () => set({ open: false }),
  toggleLauncher: () => set((state) => ({ open: !state.open })),
}));
