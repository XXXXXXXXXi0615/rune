import { create } from 'zustand';

/**
 * UI-only state for the "語音轉文本" inline block under voice bubbles.
 * Not persisted — expansion resets on reload. No real ASR: the shown text
 * is always the message's existing textSnapshot / transcript.
 */
interface VoiceTextState {
  expanded: Record<string, boolean>;
  toggle: (messageId: string) => void;
  collapse: (messageId: string) => void;
}

export const useVoiceTextStore = create<VoiceTextState>()((set) => ({
  expanded: {},
  toggle: (messageId) => set((state) => ({
    expanded: { ...state.expanded, [messageId]: !state.expanded[messageId] },
  })),
  collapse: (messageId) => set((state) => ({
    expanded: { ...state.expanded, [messageId]: false },
  })),
}));
