import { create } from 'zustand';

interface MoonFocusState {
  open: boolean;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  toggleWorkspace: () => void;
}

export const useMoonFocusStore = create<MoonFocusState>((set) => ({
  open: false,
  openWorkspace: () => set({ open: true }),
  closeWorkspace: () => set({ open: false }),
  toggleWorkspace: () => set((state) => ({ open: !state.open })),
}));
