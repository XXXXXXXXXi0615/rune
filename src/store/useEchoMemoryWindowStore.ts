import { create } from 'zustand';
import type { MemoryEntry, VoiceMessage } from '@/types';

const POSITION_KEY = 'lunartide_echo_memory_window_position_v1';

export type EchoMemoryOwner = 'user' | 'shared';

export interface EchoMemoryDraft {
  messageId: string;
  memoryEntryId?: string;
  title: string;
  transcript: string;
  tags: string[];
  owner: EchoMemoryOwner;
  allowAiRecall: boolean;
  fileName?: string;
  durationMs?: number;
  transcriptSource: 'mock' | 'stt' | 'manual';
  transcriptEdited: boolean;
  audioPersistence: 'session' | 'saved' | 'remote';
  persistenceMode: 'transcript-only' | 'audio-and-transcript';
}

interface Position {
  x: number;
  y: number;
}

interface EchoMemoryWindowState {
  isOpen: boolean;
  draft: EchoMemoryDraft | null;
  position: Position;
  openFromVoiceMessage: (message: VoiceMessage, existing?: MemoryEntry | null) => void;
  close: () => void;
  updateDraft: (patch: Partial<EchoMemoryDraft>) => void;
  setPosition: (position: Position) => void;
}

function loadPosition(): Position {
  if (typeof window === 'undefined') return { x: 96, y: 112 };
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) || '') as Position;
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return parsed;
  } catch {
    // keep default
  }
  return { x: Math.max(20, window.innerWidth - 440), y: 112 };
}

function savePosition(position: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // localStorage unavailable
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  const base = tags?.length ? tags : ['undertone', 'voice'];
  return Array.from(new Set(base.map((tag) => tag.trim()).filter(Boolean))).slice(0, 6);
}

export const useEchoMemoryWindowStore = create<EchoMemoryWindowState>((set) => ({
  isOpen: false,
  draft: null,
  position: loadPosition(),
  openFromVoiceMessage: (message, existing) => {
    const existingMetadata = existing?.metadata || {};
    set({
      isOpen: true,
      draft: {
        messageId: message.id,
        memoryEntryId: existing?.id || message.memoryEntryId,
        title: existing?.title || 'Undertone · 音訊轉錄',
        transcript: existing?.content || message.transcript || '',
        tags: normalizeTags(existing?.tags || ['undertone', 'voice']),
        owner: existing?.owner === 'shared' ? 'shared' : 'user',
        allowAiRecall: existing?.allowAiRecall === true,
        fileName: message.fileName || (typeof existingMetadata.fileName === 'string' ? existingMetadata.fileName : undefined),
        durationMs: message.durationMs || (typeof existingMetadata.durationMs === 'number' ? existingMetadata.durationMs : undefined),
        transcriptSource: message.transcriptSource || (existingMetadata.transcriptSource as EchoMemoryDraft['transcriptSource']) || 'mock',
        transcriptEdited: false,
        audioPersistence: message.audioPersistence || (existingMetadata.audioPersistence as EchoMemoryDraft['audioPersistence']) || 'session',
        persistenceMode: (existingMetadata.persistenceMode as EchoMemoryDraft['persistenceMode']) || 'transcript-only',
      },
    });
  },
  close: () => set({ isOpen: false }),
  updateDraft: (patch) => set((state) => ({
    draft: state.draft ? { ...state.draft, ...patch } : state.draft,
  })),
  setPosition: (position) => {
    savePosition(position);
    set({ position });
  },
}));
