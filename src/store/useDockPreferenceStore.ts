import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DockPreferenceState {
  manuallyCollapsed: boolean;
  dockScale: 'small' | 'medium' | 'large';
  setDockScale: (scale: 'small' | 'medium' | 'large') => void;
  collapseDock: () => void;
  expandDock: () => void;
  toggleDock: () => void;
}

export const useDockPreferenceStore = create<DockPreferenceState>()(
  persist(
    (set) => ({
      manuallyCollapsed: false,
      dockScale: 'medium',
      setDockScale: (dockScale) => set({ dockScale }),
      collapseDock: () => set({ manuallyCollapsed: true }),
      expandDock: () => set({ manuallyCollapsed: false }),
      toggleDock: () => set((s) => ({ manuallyCollapsed: !s.manuallyCollapsed })),
    }),
    {
      name: 'lunartide-dock-preferences',
    },
  ),
);
