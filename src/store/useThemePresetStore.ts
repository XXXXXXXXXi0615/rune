import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePresetId = 'lunar-tide' | 'amber-dusk' | 'verdant-tide' | 'eclipse' | 'rosy-mist';

interface ThemePresetState {
  presetId: ThemePresetId;
  accentOverride: string | null;
  draftPresetId: ThemePresetId | null;
  draftAccentOverride: string | null | undefined;
  beginDraft: () => void;
  previewPreset: (presetId: ThemePresetId) => void;
  previewAccent: (accent: string | null) => void;
  applyDraft: () => void;
  cancelDraft: () => void;
}

const PRESET_IDS: ThemePresetId[] = ['lunar-tide', 'amber-dusk', 'verdant-tide', 'eclipse', 'rosy-mist'];

export const useThemePresetStore = create<ThemePresetState>()(
  persist(
    (set) => ({
      presetId: 'lunar-tide',
      accentOverride: null,
      draftPresetId: null,
      draftAccentOverride: undefined,
      beginDraft: () => set((state) => ({ draftPresetId: state.presetId, draftAccentOverride: state.accentOverride })),
      previewPreset: (draftPresetId) => set({ draftPresetId }),
      previewAccent: (draftAccentOverride) => set({ draftAccentOverride }),
      applyDraft: () => set((state) => ({
        presetId: state.draftPresetId ?? state.presetId,
        accentOverride: state.draftAccentOverride === undefined ? state.accentOverride : state.draftAccentOverride,
        draftPresetId: null,
        draftAccentOverride: undefined,
      })),
      cancelDraft: () => set({ draftPresetId: null, draftAccentOverride: undefined }),
    }),
    {
      name: 'lunartide-theme-preset',
      partialize: (state) => ({ presetId: state.presetId, accentOverride: state.accentOverride }),
      merge: (persisted, current) => {
        const value = persisted as { presetId?: string; accentOverride?: unknown } | undefined;
        const candidate = value?.presetId;
        return {
          ...current,
          presetId: PRESET_IDS.includes(candidate as ThemePresetId)
            ? candidate as ThemePresetId
            : candidate === 'tide-island' || candidate === 'island-breeze' ? 'amber-dusk' : 'lunar-tide',
          accentOverride: typeof value?.accentOverride === 'string' ? value.accentOverride : null,
        };
      },
    },
  ),
);
