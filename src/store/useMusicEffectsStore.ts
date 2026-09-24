import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyAudioEffects, type AudioEffectParameters } from '@/features/music/audioEffectsGraph';

export type MusicEffectPreset = 'flat' | 'deep-sea' | 'night' | 'warm' | 'vocal' | 'custom';
export type MusicEffectScope = 'session' | 'track' | 'playlist' | 'global';

export const MUSIC_EFFECT_PRESETS: Record<Exclude<MusicEffectPreset, 'custom'>, AudioEffectParameters> = {
  flat: { preamp: 0, low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, warmth: 0, spatial: 0, loudness: false, balance: 0 },
  'deep-sea': { preamp: -1, low: 3, lowMid: 1.5, mid: 0, highMid: -1.5, high: -2, warmth: 18, spatial: 28, loudness: false, balance: 0 },
  night: { preamp: -2, low: -1.5, lowMid: 0, mid: 1, highMid: 0, high: -1, warmth: 10, spatial: 8, loudness: true, balance: 0 },
  warm: { preamp: -1, low: 1, lowMid: 3, mid: 1, highMid: -0.5, high: -2, warmth: 42, spatial: 8, loudness: false, balance: 0 },
  vocal: { preamp: -1, low: -2, lowMid: 0, mid: 3, highMid: 2, high: -1.5, warmth: 8, spatial: 12, loudness: false, balance: 0 },
};

type State = AudioEffectParameters & {
  preset: MusicEffectPreset;
  scope: MusicEffectScope;
  supported: boolean;
  customPreset?: AudioEffectParameters;
  globalDefault?: AudioEffectParameters;
  trackOverrides: Record<string, AudioEffectParameters>;
  playlistOverrides: Record<string, AudioEffectParameters>;
  setParameter: <K extends keyof AudioEffectParameters>(key: K, value: AudioEffectParameters[K]) => void;
  applyPreset: (preset: Exclude<MusicEffectPreset, 'custom'>) => void;
  applyCustomPreset: () => void;
  setScope: (scope: MusicEffectScope) => void;
  saveCurrent: (trackId: string, playlistId?: string) => void;
  loadResolvedForContext: (trackId: string, playlistId?: string) => void;
  syncGraph: () => boolean;
};

const initial = MUSIC_EFFECT_PRESETS.flat;
export const useMusicEffectsStore = create<State>()(persist((set, get) => ({
  ...initial,
  preset: 'flat',
  scope: 'session',
  trackOverrides: {},
  playlistOverrides: {},
  supported: typeof window !== 'undefined' && (
    typeof window.AudioContext === 'function'
    || typeof (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === 'function'
  ),
  setParameter: (key, value) => set((state) => {
    const next = { ...state, [key]: value, preset: 'custom' as const };
    queueMicrotask(() => applyAudioEffects(next));
    return next;
  }),
  applyPreset: (preset) => set(() => {
    const next = { ...MUSIC_EFFECT_PRESETS[preset], preset };
    queueMicrotask(() => applyAudioEffects(next));
    return next;
  }),
  applyCustomPreset: () => set((state) => {
    if (!state.customPreset) return state;
    const next = { ...state.customPreset, preset: 'custom' as const };
    queueMicrotask(() => applyAudioEffects(next));
    return next;
  }),
  setScope: (scope) => set({ scope }),
  saveCurrent: (trackId, playlistId) => set((state) => {
    const parameters = pickParameters(state);
    if (state.scope === 'track') {
      return { customPreset: parameters, trackOverrides: { ...state.trackOverrides, [trackId]: parameters } };
    }
    if (state.scope === 'playlist' && playlistId) {
      return { customPreset: parameters, playlistOverrides: { ...state.playlistOverrides, [playlistId]: parameters } };
    }
    if (state.scope === 'global') return { customPreset: parameters, globalDefault: parameters };
    return { customPreset: parameters };
  }),
  loadResolvedForContext: (trackId, playlistId) => set((state) => {
    const parameters = state.trackOverrides[trackId]
      ?? (playlistId ? state.playlistOverrides[playlistId] : undefined)
      ?? state.globalDefault
      ?? MUSIC_EFFECT_PRESETS.flat;
    const next = { ...parameters, preset: presetForParameters(parameters, state.customPreset) };
    queueMicrotask(() => applyAudioEffects(next));
    return next;
  }),
  syncGraph: () => applyAudioEffects(get()),
}), {
  name: 'lunartide-music-effects',
  partialize: (state) => ({
    preamp: state.preamp, low: state.low, lowMid: state.lowMid, mid: state.mid,
    highMid: state.highMid, high: state.high, warmth: state.warmth, spatial: state.spatial,
    loudness: state.loudness, balance: state.balance, preset: state.preset, scope: state.scope,
    customPreset: state.customPreset, globalDefault: state.globalDefault,
    trackOverrides: state.trackOverrides, playlistOverrides: state.playlistOverrides,
  }),
}));

function pickParameters(state: AudioEffectParameters): AudioEffectParameters {
  return {
    preamp: state.preamp, low: state.low, lowMid: state.lowMid, mid: state.mid,
    highMid: state.highMid, high: state.high, warmth: state.warmth, spatial: state.spatial,
    loudness: state.loudness, balance: state.balance,
  };
}

function presetForParameters(parameters: AudioEffectParameters, customPreset?: AudioEffectParameters): MusicEffectPreset {
  for (const [id, preset] of Object.entries(MUSIC_EFFECT_PRESETS)) {
    if (sameParameters(parameters, preset)) return id as Exclude<MusicEffectPreset, 'custom'>;
  }
  return customPreset && sameParameters(parameters, customPreset) ? 'custom' : 'custom';
}

function sameParameters(left: AudioEffectParameters, right: AudioEffectParameters): boolean {
  return (Object.keys(MUSIC_EFFECT_PRESETS.flat) as (keyof AudioEffectParameters)[])
    .every((key) => left[key] === right[key]);
}
