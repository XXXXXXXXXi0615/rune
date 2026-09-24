import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_WALLPAPER_SETTINGS, sanitizeWallpaperSettings, type WallpaperSettings } from '@/features/wallpaper/wallpaperTypes';

interface WallpaperState {
  applied: WallpaperSettings;
  draft: WallpaperSettings | null;
  beginDraft: () => void;
  updateDraft: (patch: Partial<WallpaperSettings>) => void;
  applyDraft: () => void;
  cancelDraft: () => void;
  restoreDefault: () => void;
  fallbackToDefault: () => void;
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    (set) => ({
      applied: DEFAULT_WALLPAPER_SETTINGS,
      draft: null,
      beginDraft: () => set((state) => ({ draft: { ...state.applied } })),
      updateDraft: (patch) => set((state) => ({ draft: sanitizeWallpaperSettings({ ...(state.draft ?? state.applied), ...patch }) })),
      applyDraft: () => set((state) => state.draft ? ({ applied: sanitizeWallpaperSettings(state.draft), draft: null }) : state),
      cancelDraft: () => set({ draft: null }),
      restoreDefault: () => set({ draft: { ...DEFAULT_WALLPAPER_SETTINGS } }),
      fallbackToDefault: () => set({ applied: { ...DEFAULT_WALLPAPER_SETTINGS }, draft: null }),
    }),
    {
      name: 'lunartide-wallpaper-settings-v1',
      partialize: (state) => ({ applied: state.applied }),
      merge: (persisted, current) => ({
        ...current,
        applied: sanitizeWallpaperSettings((persisted as Partial<WallpaperState> | undefined)?.applied),
        draft: null,
      }),
    },
  ),
);
