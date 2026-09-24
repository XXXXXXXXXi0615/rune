import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** @deprecated No longer drives any UI. Kept for backward-compatible persistence. */
export type HomeClockMode = 'digital' | 'glass' | 'capsule';
export type HomeClockAlign = 'left' | 'center' | 'right';
/** @deprecated No longer drives any UI. Kept for backward-compatible persistence. */
export type ClockDisplayMode = 'digital-primary' | 'flowday-primary' | 'hybrid';

export interface HomeClockSettings {
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  mode: HomeClockMode;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  showDate: boolean;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  showWeekday: boolean;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  showDayPeriod: boolean;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  showYear: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
  align: HomeClockAlign;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  opacity: number;
  draggable: boolean;
  /** @deprecated No UI consumer. Persists for migration compatibility. */
  displayMode: ClockDisplayMode;
  showSeconds: boolean;
  showSolarTerm: boolean;
  showShichen: boolean;
  showPillarOutline: boolean;
}

export const DEFAULT_HOME_CLOCK_SETTINGS: HomeClockSettings = {
  mode: 'digital', showDate: true, showWeekday: true, showDayPeriod: true, showYear: false,
  scale: 1, offsetX: 0, offsetY: 0, align: 'center', opacity: 0.72, draggable: false,
  displayMode: 'flowday-primary', showSeconds: true, showSolarTerm: true, showShichen: true, showPillarOutline: false,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

export function sanitizeHomeClockSettings(value?: Partial<HomeClockSettings>): HomeClockSettings {
  return {
    mode: value?.mode === 'glass' || value?.mode === 'capsule' ? value.mode : 'digital',
    showDate: value?.showDate ?? true,
    showWeekday: value?.showWeekday ?? true,
    showDayPeriod: value?.showDayPeriod ?? true,
    showYear: value?.showYear ?? false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    align: 'center',
    opacity: clamp(value?.opacity ?? 0.72, 0.35, 1),
    draggable: false,
    displayMode: value?.displayMode === 'digital-primary' || value?.displayMode === 'hybrid' ? value.displayMode : 'flowday-primary',
    showSeconds: value?.showSeconds ?? true,
    showSolarTerm: value?.showSolarTerm ?? true,
    showShichen: value?.showShichen ?? true,
    showPillarOutline: value?.showPillarOutline ?? false,
  };
}

interface HomeClockState {
  settings: HomeClockSettings;
  update: (patch: Partial<HomeClockSettings>) => void;
  reset: () => void;
}

export const useHomeClockStore = create<HomeClockState>()(persist(
  (set) => ({
    settings: DEFAULT_HOME_CLOCK_SETTINGS,
    update: (patch) => set((state) => ({ settings: sanitizeHomeClockSettings({ ...state.settings, ...patch }) })),
    reset: () => set({ settings: { ...DEFAULT_HOME_CLOCK_SETTINGS } }),
  }),
  {
    name: 'lunartide-home-clock-v1',
    partialize: (state) => ({ settings: {
      mode: state.settings.mode,
      showDate: state.settings.showDate,
      showWeekday: state.settings.showWeekday,
      showDayPeriod: state.settings.showDayPeriod,
      showYear: state.settings.showYear,
      opacity: state.settings.opacity,
      displayMode: state.settings.displayMode,
      showSeconds: state.settings.showSeconds,
      showSolarTerm: state.settings.showSolarTerm,
      showShichen: state.settings.showShichen,
      showPillarOutline: state.settings.showPillarOutline,
    } }),
    merge: (persisted, current) => ({ ...current, settings: sanitizeHomeClockSettings((persisted as Partial<HomeClockState> | undefined)?.settings) }),
  },
));
