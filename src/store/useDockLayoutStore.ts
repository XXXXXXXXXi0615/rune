import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_DOCK_WIDTH = 360;
export const DEFAULT_DOCK_HEIGHT = 72;
export const MIN_DOCK_WIDTH = 320;
export const MIN_DOCK_HEIGHT = 64;
export const MAX_DOCK_HEIGHT = 96;

export function getDockMaxWidth(viewportWidth = typeof window === 'undefined' ? 592 : window.innerWidth) {
  return Math.max(MIN_DOCK_WIDTH, Math.min(560, viewportWidth - 32));
}

export function clampDockSize(width: number, height: number, viewportWidth?: number) {
  return {
    width: Math.min(getDockMaxWidth(viewportWidth), Math.max(MIN_DOCK_WIDTH, Number.isFinite(width) ? width : DEFAULT_DOCK_WIDTH)),
    height: Math.min(MAX_DOCK_HEIGHT, Math.max(MIN_DOCK_HEIGHT, Number.isFinite(height) ? height : DEFAULT_DOCK_HEIGHT)),
  };
}

interface DockLayoutState {
  width: number;
  height: number;
  setSize: (width: number, height: number) => void;
  resetSize: () => void;
}

export const useDockLayoutStore = create<DockLayoutState>()(
  persist(
    (set) => ({
      width: DEFAULT_DOCK_WIDTH,
      height: DEFAULT_DOCK_HEIGHT,
      setSize: (width, height) => set((state) => {
        const next = clampDockSize(width, height);
        return state.width === next.width && state.height === next.height ? state : next;
      }),
      resetSize: () => set((state) => (
        state.width === DEFAULT_DOCK_WIDTH && state.height === DEFAULT_DOCK_HEIGHT
          ? state
          : { width: DEFAULT_DOCK_WIDTH, height: DEFAULT_DOCK_HEIGHT }
      )),
    }),
    {
      name: 'lunartide-dock-layout',
      merge: (persisted, current) => {
        const stored = persisted as Partial<DockLayoutState> | undefined;
        return { ...current, ...clampDockSize(stored?.width ?? current.width, stored?.height ?? current.height) };
      },
      partialize: (state) => ({ width: state.width, height: state.height }),
    },
  ),
);
