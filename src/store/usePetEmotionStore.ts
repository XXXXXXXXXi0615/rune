import { create } from 'zustand';
import { NEUTRAL_EMOTION, type AIEmotionSignal } from '@/features/desktopPet/emotionDomain';

export type PetInteractionState = 'idle' | 'pressed' | 'grabbed' | 'struggling' | 'released' | 'recovering';
interface EmotionEvent { id: string; primary: AIEmotionSignal['primary']; source: AIEmotionSignal['source']; publicCue?: string; createdAt: number }
interface PetEmotionRuntimeState {
  signal: AIEmotionSignal; interactionState: PetInteractionState; history: EmotionEvent[]; recoverAt: number | null; lastSwitches: number[];
  applySignal: (signal: AIEmotionSignal, bypass?: boolean) => boolean; setInteractionState: (state: PetInteractionState, recoverAt?: number | null) => void; expire: (now?: number) => void; resetTransient: () => void;
}

export const usePetEmotionStore = create<PetEmotionRuntimeState>((set, get) => ({
  signal: NEUTRAL_EMOTION(), interactionState: 'idle', history: [], recoverAt: null, lastSwitches: [],
  applySignal: (signal, bypass = false) => {
    const state = get(); const now = signal.createdAt; const switches = state.lastSwitches.filter((time) => now - time < 1_000);
    const same = state.signal.primary === signal.primary;
    if (!bypass && !same && ((now - state.signal.createdAt < 1_500) || switches.length >= 2 || (signal.confidence + .15 < state.signal.confidence && now < state.signal.createdAt + state.signal.ttlMs))) return false;
    const next = same ? { ...state.signal, ...signal, createdAt: state.signal.createdAt } : signal;
    set({ signal: next, lastSwitches: same ? switches : [...switches, now], history: [{ id: crypto.randomUUID(), primary: signal.primary, source: signal.source, publicCue: signal.publicCue, createdAt: now }, ...state.history].slice(0, 10) }); return true;
  },
  setInteractionState: (interactionState, recoverAt = null) => set({ interactionState, recoverAt }),
  expire: (now = Date.now()) => { const current = get().signal; if (now >= current.createdAt + current.ttlMs && current.primary !== 'neutral') set({ signal: { ...NEUTRAL_EMOTION('system', now), intensity: Math.max(0, current.intensity - .35), publicCue: '逐漸回到平靜' } }); },
  resetTransient: () => set({ signal: NEUTRAL_EMOTION(), interactionState: 'idle', recoverAt: null, lastSwitches: [] }),
}));

export const publishPetEmotion = (signal: AIEmotionSignal, bypass = false) => usePetEmotionStore.getState().applySignal(signal, bypass);
