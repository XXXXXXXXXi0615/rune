import { create } from 'zustand';

interface RuneUtilityState {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

export const useRuneUtilityStore = create<RuneUtilityState>((set) => ({
  mobileOpen: false,
  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
}));
