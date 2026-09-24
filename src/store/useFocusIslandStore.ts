import { create } from 'zustand';

export type FocusIslandState = 'hidden' | 'compact' | 'expanded' | 'window';

interface FocusIslandStore {
  state: FocusIslandState;
  lastOutcome: string | null;
  showCompact: () => void;
  showExpanded: () => void;
  toggleExpanded: () => void;
  showWindow: () => void;
  hide: () => void;
  setOutcome: (text: string) => void;
  clearOutcome: () => void;
}

export const useFocusIslandStore = create<FocusIslandStore>((set) => ({
  state: 'compact',
  lastOutcome: null,
  showCompact: () => set({ state: 'compact' }),
  showExpanded: () => set({ state: 'expanded' }),
  toggleExpanded: () => set((s) => ({ state: s.state === 'expanded' ? 'compact' : 'expanded' })),
  showWindow: () => set({ state: 'window' }),
  hide: () => set({ state: 'hidden' }),
  setOutcome: (text) => set({ lastOutcome: text }),
  clearOutcome: () => set({ lastOutcome: null }),
}));
