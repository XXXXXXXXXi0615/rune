import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RuneStashColorViewMode = 'tile' | 'compact';

interface RuneStashUiState {
  colorViewMode: RuneStashColorViewMode;
  setColorViewMode: (mode: RuneStashColorViewMode) => void;
}

export const useRuneStashUiStore = create<RuneStashUiState>()(persist((set) => ({
  colorViewMode: 'tile',
  setColorViewMode: (colorViewMode) => set({ colorViewMode }),
}), { name: 'lunartide-rune-stash-ui-v1', version: 1 }));
