import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FocusRoomType } from '@/components/focus/types';

export interface TideboundDraft {
  task: string;
  modeId: string;
  selectedRoom: FocusRoomType;
  durationMinutes: number;
  breakMinutes: number;
  rounds: number;
  loopMode: boolean;
  witnessEnabled: boolean;
  allowAiReference: boolean;
  autoSaveMemory: boolean;
  completionReminder: boolean;
  focusSoundEnabled: boolean;
}

const defaultDraft: TideboundDraft = {
  task: '',
  modeId: '',
  selectedRoom: 'computer',
  durationMinutes: 25,
  breakMinutes: 5,
  rounds: 1,
  loopMode: false,
  witnessEnabled: true,
  allowAiReference: true,
  autoSaveMemory: true,
  completionReminder: true,
  focusSoundEnabled: false,
};

interface TideboundDraftActions {
  setDraft: (patch: Partial<TideboundDraft>) => void;
  resetDraft: () => void;
}

export const useTideboundDraftStore = create<TideboundDraft & TideboundDraftActions>()(
  persist(
    (set) => ({
      ...defaultDraft,
      setDraft: (patch) => set(patch),
      resetDraft: () => set(defaultDraft),
    }),
    {
      name: 'tidebound-draft',
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<TideboundDraft>;
        const selectedRoom: FocusRoomType = saved.selectedRoom
          || (saved.modeId === 'espresso' ? 'coffee'
            : saved.modeId === 'night' ? 'bed'
              : 'computer');
        return { ...current, ...saved, selectedRoom };
      },
    },
  ),
);
