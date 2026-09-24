// ================================================================
// Life Kernel Mode System
//
// Unified state layer that controls UI semantics across modules.
// Does NOT render UI — consumers read `mode` and adapt.
//
// notion   → calendar / almanac visible, journal-style layout
// reminder → todo / countdown prioritized, list-style layout
// focus    → minimal UI, timer dominant, low noise
// ================================================================

import { create } from 'zustand';

export type LifeKernelMode = 'notion' | 'reminder' | 'focus';

interface LifeKernelState {
  mode: LifeKernelMode;
  setMode: (mode: LifeKernelMode) => void;
}

export const useLifeKernelStore = create<LifeKernelState>((set) => ({
  mode: 'notion',
  setMode: (mode) => set({ mode }),
}));
