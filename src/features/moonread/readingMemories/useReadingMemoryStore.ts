import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReadingBoardDecoration, ReadingMemoryBoard, ReadingTimelineEntry } from './types';
import { READING_BOARD_HEIGHT, READING_BOARD_WIDTH } from './types';
import { normalizeZIndices } from './geometry';

type Snapshot = ReadingMemoryBoard[];
interface Store {
  boards: ReadingMemoryBoard[];
  past: Snapshot[];
  future: Snapshot[];
  createBoard(bookId?: string): string;
  updateBoard(id: string, patch: Partial<ReadingMemoryBoard>, history?: boolean): void;
  addEntry(boardId: string, entry: Omit<ReadingTimelineEntry, 'id' | 'order'>): void;
  updateEntry(boardId: string, entryId: string, patch: Partial<ReadingTimelineEntry>): void;
  removeEntry(boardId: string, entryId: string): void;
  addDecoration(boardId: string, item: Omit<ReadingBoardDecoration, 'id' | 'zIndex'>): string;
  updateDecoration(boardId: string, itemId: string, patch: Partial<ReadingBoardDecoration>, history?: boolean): void;
  removeDecoration(boardId: string, itemId: string): void;
  reorderDecoration(boardId: string, itemId: string, direction: 'forward' | 'backward' | 'top' | 'bottom'): void;
  undo(): void;
  redo(): void;
  resetForTests(): void;
}

const clone = (boards: ReadingMemoryBoard[]): Snapshot => structuredClone(boards);
const withHistory = (state: Store, boards: ReadingMemoryBoard[]) => ({ boards, past: [...state.past, clone(state.boards)].slice(-50), future: [] });
const updateOne = (boards: ReadingMemoryBoard[], id: string, updater: (board: ReadingMemoryBoard) => ReadingMemoryBoard) => boards.map((board) => board.id === id ? { ...updater(board), updatedAt: Date.now() } : board);

export const useReadingMemoryStore = create<Store>()(persist((set, get) => ({
  boards: [], past: [], future: [],
  createBoard(bookId) {
    const id = crypto.randomUUID(); const now = Date.now();
    const board: ReadingMemoryBoard = { id, bookId, title: '共讀足跡', subtitle: 'Reading memories with LUNARIS', templateId: 'reading-timeline-v2', designWidth: READING_BOARD_WIDTH, designHeight: READING_BOARD_HEIGHT, entries: [], imageLayers: [], createdAt: now, updatedAt: now };
    set((state) => withHistory(state, [board, ...state.boards])); return id;
  },
  updateBoard(id, patch, history = true) { set((state) => { const boards = updateOne(state.boards, id, (board) => ({ ...board, ...patch })); return history ? withHistory(state, boards) : { boards }; }); },
  addEntry(boardId, entry) { set((state) => withHistory(state, updateOne(state.boards, boardId, (board) => ({ ...board, entries: [...board.entries, { ...entry, id: crypto.randomUUID(), order: board.entries.length }] })))); },
  updateEntry(boardId, entryId, patch) { set((state) => withHistory(state, updateOne(state.boards, boardId, (board) => ({ ...board, entries: board.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) })))); },
  removeEntry(boardId, entryId) { set((state) => withHistory(state, updateOne(state.boards, boardId, (board) => ({ ...board, entries: board.entries.filter((entry) => entry.id !== entryId).sort((a,b)=>a.order-b.order).map((entry, order) => ({ ...entry, order })) })))); },
  addDecoration(boardId, item) { const id = crypto.randomUUID(); set((state) => withHistory(state, updateOne(state.boards, boardId, (board) => ({ ...board, imageLayers: [...board.imageLayers, { ...item, id, zIndex: Math.max(0, ...board.imageLayers.map((layer) => layer.zIndex)) + 1 }] })))); return id; },
  updateDecoration(boardId, itemId, patch, history = true) { set((state) => { const boards = updateOne(state.boards, boardId, (board) => ({ ...board, imageLayers: board.imageLayers.map((item) => item.id === itemId ? { ...item, ...patch } : item) })); return history ? withHistory(state, boards) : { boards }; }); },
  removeDecoration(boardId, itemId) { set((state) => withHistory(state, updateOne(state.boards, boardId, (board) => ({ ...board, imageLayers: board.imageLayers.filter((item) => item.id !== itemId) })))); },
  reorderDecoration(boardId, itemId, direction) {
    set((state) => {
      const boards = updateOne(state.boards, boardId, (board) => {
        const ordered = normalizeZIndices(board.imageLayers);
        const index = ordered.findIndex((item) => item.id === itemId);
        if (index < 0) return board;
        const [item] = ordered.splice(index, 1);
        const target = direction === 'top' ? ordered.length
          : direction === 'bottom' ? 0
          : direction === 'forward' ? Math.min(ordered.length, index + 1)
          : Math.max(0, index - 1);
        ordered.splice(target, 0, item);
        return { ...board, imageLayers: ordered.map((layer, zIndex) => ({ ...layer, zIndex: zIndex + 1 })) };
      });
      return withHistory(state, boards);
    });
  },
  undo() { set((state) => { const previous = state.past.at(-1); if (!previous) return state; return { boards: clone(previous), past: state.past.slice(0, -1), future: [clone(state.boards), ...state.future].slice(0, 50) }; }); },
  redo() { set((state) => { const next = state.future[0]; if (!next) return state; return { boards: clone(next), past: [...state.past, clone(state.boards)].slice(-50), future: state.future.slice(1) }; }); },
  resetForTests() { set({ boards: [], past: [], future: [] }); },
}), {
  name: 'lunartide-reading-memories-v1',
  version: 2,
  partialize: (state) => ({ boards: state.boards }),
  migrate: (persisted: unknown) => {
    const value = (persisted || {}) as { boards?: Array<Record<string, unknown>> };
    const boards = (value.boards || []).map((raw) => {
      const legacyLayers = Array.isArray(raw.decorations) ? raw.decorations : [];
      const imageLayers = (Array.isArray(raw.imageLayers) ? raw.imageLayers : legacyLayers).map((layer) => ({
        ...(layer as object),
        aspectMode: (layer as { aspectMode?: string }).aspectMode === 'free' ? 'free' : 'contain',
      }));
      const entries = (Array.isArray(raw.entries) ? raw.entries : []).map((entry) => {
        const old = entry as Record<string, unknown>;
        return {
          ...old,
          date: typeof old.date === 'number' ? old.date : typeof old.readAt === 'number' ? old.readAt : Date.now(),
          excerpt: typeof old.excerpt === 'string' ? old.excerpt : old.note,
          moodTag: typeof old.moodTag === 'string' ? old.moodTag : old.moodLabel,
        };
      });
      const { decorations: _decorations, ...board } = raw;
      return { ...board, templateId: 'reading-timeline-v2', designWidth: READING_BOARD_WIDTH, designHeight: READING_BOARD_HEIGHT, entries, imageLayers };
    });
    return { boards: boards as unknown as ReadingMemoryBoard[] };
  },
  merge: (persisted, current) => ({ ...current, ...(persisted as Partial<Store>), past: [], future: [] }),
}));
