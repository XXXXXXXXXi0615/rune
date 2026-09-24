import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  HOME_LAYOUT_VERSION,
  commitHomeLayout,
  createDefaultHomeLayout,
  migrateHomeLayout,
  reorderHomeWidgets,
  supportsHomeWidgetPreset,
  type HomeLayoutState,
  type HomeWidgetId,
  type HomeWidgetPreset,
} from './homeLayout';

export const HOME_LAYOUT_STORAGE_KEY = 'lunartide-home-widget-layout-v1';
export const LEGACY_PRESENCE_LAYOUT_STORAGE_KEY = 'lunartide-home-presence-layout-v1';

interface HomeLayoutActions {
  reorderWidget: (id: HomeWidgetId, targetIndex: number) => void;
  setWidgetPreset: (id: HomeWidgetId, preset: HomeWidgetPreset) => void;
  setWidgetVisible: (id: HomeWidgetId, visible: boolean) => void;
  resetHomeLayout: () => void;
  moveWidgetUp: (id: HomeWidgetId) => void;
  moveWidgetDown: (id: HomeWidgetId) => void;
  /** Phase 2B — the single atomic write seam for Edit Home commit. */
  commitLayout: (draft: HomeLayoutState) => void;
}

export type HomeWidgetLayoutStore = HomeLayoutState & HomeLayoutActions;

export const useHomeWidgetLayoutStore = create<HomeWidgetLayoutStore>()(
  persist(
    (set) => ({
      ...createDefaultHomeLayout(),
      reorderWidget: (id, targetIndex) => set((state) => ({ widgets: reorderHomeWidgets(state.widgets, id, targetIndex) })),
      setWidgetPreset: (id, preset) => set((state) => {
        if (!supportsHomeWidgetPreset(id, preset)) return state;
        return { widgets: state.widgets.map((widget) => widget.id === id ? { ...widget, preset } : widget) };
      }),
      setWidgetVisible: (id, visible) => set((state) => ({
        widgets: state.widgets.map((widget) => widget.id === id ? { ...widget, visible } : widget),
      })),
      resetHomeLayout: () => set(createDefaultHomeLayout()),
      moveWidgetUp: (id) => set((state) => {
        const index = state.widgets.findIndex((widget) => widget.id === id);
        return { widgets: reorderHomeWidgets(state.widgets, id, index - 1) };
      }),
      moveWidgetDown: (id) => set((state) => {
        const index = state.widgets.findIndex((widget) => widget.id === id);
        return { widgets: reorderHomeWidgets(state.widgets, id, index + 1) };
      }),
      commitLayout: (draft) => set(() => commitHomeLayout(draft)),
    }),
    {
      name: HOME_LAYOUT_STORAGE_KEY,
      version: HOME_LAYOUT_VERSION,
      partialize: (state) => ({ version: state.version, widgets: state.widgets }),
      merge: (persisted, current) => {
        const legacyPresence = typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(LEGACY_PRESENCE_LAYOUT_STORAGE_KEY);
        return { ...current, ...migrateHomeLayout(persisted, legacyPresence) };
      },
      migrate: (persisted) => {
        const legacyPresence = typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(LEGACY_PRESENCE_LAYOUT_STORAGE_KEY);
        return migrateHomeLayout(persisted, legacyPresence);
      },
      onRehydrateStorage: () => (state, error) => {
        if (error || state?.version !== HOME_LAYOUT_VERSION || typeof localStorage === 'undefined') return;
        if (localStorage.getItem(LEGACY_PRESENCE_LAYOUT_STORAGE_KEY) !== null) {
          localStorage.removeItem(LEGACY_PRESENCE_LAYOUT_STORAGE_KEY);
        }
      },
    },
  ),
);
