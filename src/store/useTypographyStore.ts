import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TypographyProfile, CustomFontRecord } from '@/features/typography/types';
import { getDefaultPreset } from '@/features/typography/typographyPresets';
import { getDefaultFontIdForRole } from '@/features/typography/fontManifest';

const STORAGE_KEY = 'lunartide-typography';

const defaultPreset = getDefaultPreset();

function createInitialState() {
  return {
    activeProfileId: defaultPreset.id,
    customProfiles: [] as TypographyProfile[],

    displayFontId: defaultPreset.displayFontId,
    bodyFontId: defaultPreset.bodyFontId,
    monoFontId: defaultPreset.monoFontId,

    displayWeight: defaultPreset.displayWeight,
    bodyWeight: defaultPreset.bodyWeight,
    monoWeight: 400,
    baseSize: defaultPreset.baseSize,
    lineHeight: defaultPreset.lineHeight,
    letterSpacing: defaultPreset.letterSpacing,

    downloadedFontIds: [] as string[],
    customFonts: [] as CustomFontRecord[],
  };
}

interface TypographyActions {
  setDisplayFont: (id: string) => void;
  setBodyFont: (id: string) => void;
  setMonoFont: (id: string) => void;
  setDisplayWeight: (w: number) => void;
  setBodyWeight: (w: number) => void;
  setMonoWeight: (w: number) => void;
  setBaseSize: (s: number) => void;
  setLineHeight: (h: number) => void;
  setLetterSpacing: (s: number) => void;
  setActiveProfileId: (id: string) => void;
  addCustomProfile: (p: TypographyProfile) => void;
  removeCustomProfile: (id: string) => void;
  markFontDownloaded: (id: string) => void;
  markFontRemoved: (id: string) => void;
  addCustomFont: (f: CustomFontRecord) => void;
  removeCustomFont: (id: string) => void;
  applyProfile: (p: TypographyProfile) => void;
  resetToDefaults: () => void;
}

type TypographyStore = ReturnType<typeof createInitialState> & TypographyActions;

export const useTypographyStore = create<TypographyStore>()(
  persist(
    (set) => ({
      ...createInitialState(),

      setDisplayFont: (id) => set({ displayFontId: id }),
      setBodyFont: (id) => set({ bodyFontId: id }),
      setMonoFont: (id) => set({ monoFontId: id }),
      setDisplayWeight: (w) => set({ displayWeight: w }),
      setBodyWeight: (w) => set({ bodyWeight: w }),
      setMonoWeight: (w) => set({ monoWeight: w }),
      setBaseSize: (s) => set({ baseSize: s }),
      setLineHeight: (h) => set({ lineHeight: h }),
      setLetterSpacing: (s) => set({ letterSpacing: s }),
      setActiveProfileId: (id) => set({ activeProfileId: id }),

      addCustomProfile: (p) =>
        set((s) => ({ customProfiles: [...s.customProfiles.filter((cp) => cp.id !== p.id), p] })),

      removeCustomProfile: (id) =>
        set((s) => ({ customProfiles: s.customProfiles.filter((cp) => cp.id !== id) })),

      markFontDownloaded: (id) =>
        set((s) => ({
          downloadedFontIds: s.downloadedFontIds.includes(id)
            ? s.downloadedFontIds
            : [...s.downloadedFontIds, id],
        })),

      markFontRemoved: (id) =>
        set((s) => ({
          downloadedFontIds: s.downloadedFontIds.filter((fid) => fid !== id),
        })),

      addCustomFont: (f) =>
        set((s) => ({
          customFonts: [...s.customFonts.filter((cf) => cf.id !== f.id), f],
        })),

      removeCustomFont: (id) =>
        set((s) => {
          const font = s.customFonts.find((cf) => cf.id === id);
          const next = s.customFonts.filter((cf) => cf.id !== id);
          const state: Partial<ReturnType<typeof createInitialState>> = { customFonts: next };
          if (font) {
            if (s.displayFontId === id) state.displayFontId = getDefaultFontIdForRole('display');
            if (s.bodyFontId === id) state.bodyFontId = getDefaultFontIdForRole('body');
            if (s.monoFontId === id) state.monoFontId = getDefaultFontIdForRole('mono');
          }
          return state;
        }),

      applyProfile: (p) =>
        set({
          displayFontId: p.displayFontId,
          bodyFontId: p.bodyFontId,
          monoFontId: p.monoFontId,
          displayWeight: p.displayWeight,
          bodyWeight: p.bodyWeight,
          monoWeight: (p as TypographyProfile).monoWeight || 400,
          baseSize: p.baseSize,
          lineHeight: p.lineHeight,
          letterSpacing: p.letterSpacing,
          activeProfileId: p.id,
        }),

      resetToDefaults: () => set((state) => ({
        ...createInitialState(),
        customFonts: state.customFonts,
        downloadedFontIds: state.downloadedFontIds,
      })),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        activeProfileId: state.activeProfileId,
        customProfiles: state.customProfiles,
        displayFontId: state.displayFontId,
        bodyFontId: state.bodyFontId,
        monoFontId: state.monoFontId,
        displayWeight: state.displayWeight,
        bodyWeight: state.bodyWeight,
        monoWeight: state.monoWeight,
        baseSize: state.baseSize,
        lineHeight: state.lineHeight,
        letterSpacing: state.letterSpacing,
        downloadedFontIds: state.downloadedFontIds,
        customFonts: state.customFonts,
      }),
    },
  ),
);
