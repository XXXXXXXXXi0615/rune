import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const BOARD_STORAGE_KEY = 'lunartide-photo-wall';

export type BoardItemType = 'image' | 'note' | 'mixed';

export interface BoardItem {
  id: string;
  type: BoardItemType;
  title: string;
  note: string;
  imageUrl?: string;
  mimeType?: string;
  hasAlpha?: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  order: number;
}

interface CompanionBoardState {
  boardItems: BoardItem[];
}

interface CompanionBoardActions {
  addBoardItem: (item: Omit<BoardItem, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'pinned'> & { pinned?: boolean }) => string;
  updateBoardItem: (id: string, patch: Partial<Pick<BoardItem, 'type' | 'title' | 'note' | 'imageUrl' | 'mimeType' | 'hasAlpha'>>) => void;
  deleteBoardItem: (id: string) => void;
  toggleBoardItemPinned: (id: string) => void;
  moveBoardItem: (id: string, direction: -1 | 1) => void;
}

function isBoardType(value: unknown): value is BoardItemType {
  return value === 'image' || value === 'note' || value === 'mixed';
}

function normalizeBoardItems(value: unknown): BoardItem[] {
  if (!Array.isArray(value)) return [];
  const now = Date.now();
  return value
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
    .map((item, index) => ({
      id: item.id,
      type: isBoardType(item.type) ? item.type : (typeof item.imageUrl === 'string' ? 'image' : 'note'),
      title: typeof item.title === 'string' ? item.title : '',
      note: typeof item.note === 'string' ? item.note : '',
      imageUrl: typeof item.imageUrl === 'string' && item.imageUrl ? item.imageUrl : undefined,
      mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
      hasAlpha: typeof item.hasAlpha === 'boolean' ? item.hasAlpha : undefined,
      pinned: Boolean(item.pinned),
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : now + index,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : (typeof item.createdAt === 'number' ? item.createdAt : now + index),
      order: typeof item.order === 'number' ? item.order : index,
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order || b.createdAt - a.createdAt)
    .map((item, order) => ({ ...item, order }));
}

function migrateLegacyPhotos(value: unknown): BoardItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((photo) => photo && typeof photo === 'object' && typeof photo.id === 'string' && typeof photo.imageData === 'string')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .map((photo, order) => ({
      id: photo.id,
      type: 'image' as const,
      title: typeof photo.caption === 'string' ? photo.caption : '',
      note: '',
      imageUrl: photo.imageData,
      mimeType: typeof photo.imageData === 'string' && photo.imageData.startsWith('data:image/png') ? 'image/png' : undefined,
      hasAlpha: undefined,
      pinned: false,
      createdAt: typeof photo.createdAt === 'number' ? photo.createdAt : Date.now() + order,
      updatedAt: typeof photo.createdAt === 'number' ? photo.createdAt : Date.now() + order,
      order,
    }));
}

function normalizeOrder(items: BoardItem[]): BoardItem[] {
  return items.map((item, order) => ({ ...item, order }));
}

export const useCompanionBoardStore = create<CompanionBoardState & CompanionBoardActions>()(
  persist(
    (set) => ({
      boardItems: [],

      addBoardItem: (draft) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => ({
          boardItems: normalizeOrder([
            { ...draft, id, pinned: Boolean(draft.pinned), createdAt: now, updatedAt: now, order: 0 },
            ...state.boardItems,
          ]),
        }));
        return id;
      },

      updateBoardItem: (id, patch) => set((state) => ({
        boardItems: state.boardItems.map((item) => item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item),
      })),

      deleteBoardItem: (id) => set((state) => ({
        boardItems: normalizeOrder(state.boardItems.filter((item) => item.id !== id)),
      })),

      toggleBoardItemPinned: (id) => set((state) => ({
        boardItems: normalizeOrder(state.boardItems
          .map((item) => item.id === id ? { ...item, pinned: !item.pinned, updatedAt: Date.now() } : item)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order)),
      })),

      moveBoardItem: (id, direction) => set((state) => {
        const items = [...state.boardItems];
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) return state;
        const target = Math.max(0, Math.min(items.length - 1, index + direction));
        if (target === index || items[target].pinned !== items[index].pinned) return state;
        [items[index], items[target]] = [items[target], items[index]];
        return { boardItems: normalizeOrder(items) };
      }),
    }),
    {
      name: BOARD_STORAGE_KEY,
      version: 1,
      migrate: (persisted) => persisted as CompanionBoardState,
      merge: (persisted, current) => {
        const raw = persisted as { boardItems?: unknown; photoEntries?: unknown } | undefined;
        const boardItems = raw?.boardItems ? normalizeBoardItems(raw.boardItems) : migrateLegacyPhotos(raw?.photoEntries);
        return { ...current, boardItems };
      },
    },
  ),
);

export function getBoardStorageSize(): number {
  try {
    return new Blob([JSON.stringify(useCompanionBoardStore.getState().boardItems)]).size;
  } catch {
    return 0;
  }
}
