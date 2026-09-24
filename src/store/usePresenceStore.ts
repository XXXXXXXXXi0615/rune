import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParticipantPresence, PresenceStatus } from '@/types';

interface PresenceStore {
  presences: Record<string, ParticipantPresence>;
  autoStatusEnabled: boolean;
  setPresence: (participantId: string, status: PresenceStatus, customText?: string) => void;
  setCustomText: (participantId: string, customText: string) => void;
  setTemporaryPresence: (participantId: string, status: PresenceStatus, customText?: string) => void;
  clearManualPresence: (participantId: string) => void;
  setAutoStatusEnabled: (enabled: boolean) => void;
  getPresence: (participantId: string) => ParticipantPresence;
}

const fallbackPresenceCache = new Map<string, ParticipantPresence>();

function fallbackPresence(participantId: string): ParticipantPresence {
  const cached = fallbackPresenceCache.get(participantId);
  if (cached) return cached;

  const fallback: ParticipantPresence = {
    participantId,
    status: 'offline',
    actualPresenceStatus: 'offline',
    visiblePresenceStatus: 'offline',
    manuallySet: false,
    updatedAt: '',
  };
  fallbackPresenceCache.set(participantId, fallback);
  return fallback;
}

export const usePresenceStore = create<PresenceStore>()(
  persist(
    (set, get) => ({
      presences: {},
      autoStatusEnabled: true,
      setPresence: (participantId, status, customText) => set((state) => {
        const now = new Date().toISOString();
        return {
          presences: {
            ...state.presences,
            [participantId]: {
              ...(state.presences[participantId] || fallbackPresence(participantId)),
              participantId,
              status,
              actualPresenceStatus: status,
              visiblePresenceStatus: status === 'invisible' ? 'offline' : status,
              customText: customText?.trim() || undefined,
              lastActiveAt: status === 'offline'
                ? state.presences[participantId]?.lastActiveAt || now
                : now,
              manuallySet: true,
              updatedAt: now,
            },
          },
        };
      }),
      setCustomText: (participantId, customText) => set((state) => {
        const current = state.presences[participantId] || fallbackPresence(participantId);
        return {
          presences: {
            ...state.presences,
            [participantId]: { ...current, customText: customText.trim() || undefined, updatedAt: new Date().toISOString() },
          },
        };
      }),
      setTemporaryPresence: (participantId, status, customText) => set((state) => {
        const current = state.presences[participantId] || fallbackPresence(participantId);
        if (current.manuallySet || !state.autoStatusEnabled) return state;
        const now = new Date().toISOString();
        return {
          presences: {
            ...state.presences,
            [participantId]: {
              ...current,
              status,
              actualPresenceStatus: status,
              visiblePresenceStatus: status === 'invisible' ? 'offline' : status,
              customText: customText?.trim() || undefined,
              lastActiveAt: status === 'offline' ? current.lastActiveAt || now : now,
              updatedAt: now,
            },
          },
        };
      }),
      clearManualPresence: (participantId) => set((state) => {
        const current = state.presences[participantId] || fallbackPresence(participantId);
        return {
          presences: {
            ...state.presences,
            [participantId]: { ...current, manuallySet: false, updatedAt: new Date().toISOString() },
          },
        };
      }),
      setAutoStatusEnabled: (autoStatusEnabled) => set({ autoStatusEnabled }),
      getPresence: (participantId) => get().presences[participantId] || fallbackPresence(participantId),
    }),
    {
      name: 'lunartide-presence',
      version: 1,
      merge: (persisted, current) => {
        const value = persisted as Partial<PresenceStore> | undefined;
        return {
          ...current,
          ...value,
          presences: value?.presences && typeof value.presences === 'object' ? value.presences : {},
        };
      },
    },
  ),
);

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: '在線',
  away: '離開',
  invisible: '隱身',
  busy: '忙碌',
  offline: '離線',
};
