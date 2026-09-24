import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StashItemType = 'color' | 'kaomoji' | 'symbol' | 'text' | 'palette' | 'color_collection';

export interface RuneStashColorSwatch {
  id: string;
  name: string;
  hex: string;
  note?: string;
}

interface RuneStashItemBase {
  id: string;
  type: StashItemType;
  title?: string;
  value: string;
  tags: string[];
  favorite: boolean;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RuneStashColorItem extends RuneStashItemBase {
  type: 'color';
  value: string;
}

export interface RuneStashPaletteItem extends RuneStashItemBase {
  type: 'palette';
  colorIds: string[];
}

export interface RuneStashColorCollectionItem extends RuneStashItemBase {
  type: 'color_collection';
  swatches: RuneStashColorSwatch[];
}

export type RuneStashItem =
  | RuneStashColorItem
  | RuneStashPaletteItem
  | RuneStashColorCollectionItem
  | (RuneStashItemBase & { type: 'kaomoji' | 'symbol' | 'text' });

export type RuneStashDraft = Pick<RuneStashItemBase, 'type' | 'value' | 'tags'> &
  Partial<Pick<RuneStashItemBase, 'title' | 'note' | 'favorite'>> & { colorIds?: string[]; swatches?: RuneStashColorSwatch[] };

interface RuneStashState {
  items: RuneStashItem[];
  addItem: (draft: RuneStashDraft) => string;
  updateItem: (id: string, patch: Partial<RuneStashDraft>) => void;
  deleteItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  reorderPalette: (id: string, fromIndex: number, toIndex: number) => void;
}

export const RUNE_STASH_STORAGE_KEY = 'lunartide-rune-stash-v1';

const tidyTags = (tags: string[]) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
const normalizeHex = (value: string) => value.trim().toUpperCase();
const normalizeSwatches = (swatches: RuneStashColorSwatch[]) => swatches.map((swatch) => ({
  id: swatch.id || crypto.randomUUID(),
  name: swatch.name.trim(),
  hex: normalizeHex(swatch.hex),
  note: swatch.note?.trim() || undefined,
}));

export const useRuneStashStore = create<RuneStashState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (draft) => {
        const now = Date.now();
        const id = crypto.randomUUID();
        const base = {
          id,
          type: draft.type,
          title: draft.title?.trim() || undefined,
          value: draft.type === 'color' ? normalizeHex(draft.value) : draft.value.trim(),
          tags: tidyTags(draft.tags),
          favorite: Boolean(draft.favorite),
          note: draft.note?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };
        const item: RuneStashItem = draft.type === 'palette'
          ? { ...base, type: 'palette', colorIds: Array.from(new Set(draft.colorIds || [])) }
          : draft.type === 'color_collection'
            ? { ...base, type: 'color_collection', swatches: normalizeSwatches(draft.swatches || []) }
            : base as RuneStashItem;
        set((state) => ({ items: [item, ...state.items] }));
        return id;
      },
      updateItem: (id, patch) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== id) return item;
          const next = {
            ...item,
            ...patch,
            title: patch.title === undefined ? item.title : patch.title.trim() || undefined,
            note: patch.note === undefined ? item.note : patch.note.trim() || undefined,
            value: patch.value === undefined ? item.value : item.type === 'color' ? normalizeHex(patch.value) : patch.value.trim(),
            tags: patch.tags === undefined ? item.tags : tidyTags(patch.tags),
            updatedAt: Date.now(),
          };
          return item.type === 'palette'
            ? { ...next, type: 'palette' as const, colorIds: Array.from(new Set(patch.colorIds ?? item.colorIds)) }
            : item.type === 'color_collection'
              ? { ...next, type: 'color_collection' as const, swatches: patch.swatches === undefined ? item.swatches : normalizeSwatches(patch.swatches) }
            : next as RuneStashItem;
        }),
      })),
      deleteItem: (id) => set((state) => ({
        items: state.items
          .filter((item) => item.id !== id)
          .map((item) => item.type === 'palette'
            ? { ...item, colorIds: item.colorIds.filter((colorId) => colorId !== id), updatedAt: item.colorIds.includes(id) ? Date.now() : item.updatedAt }
            : item),
      })),
      toggleFavorite: (id) => set((state) => ({
        items: state.items.map((item) => item.id === id ? { ...item, favorite: !item.favorite, updatedAt: Date.now() } : item),
      })),
      reorderPalette: (id, fromIndex, toIndex) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== id || item.type !== 'palette' || fromIndex === toIndex) return item;
          if (fromIndex < 0 || toIndex < 0 || fromIndex >= item.colorIds.length || toIndex >= item.colorIds.length) return item;
          const colorIds = [...item.colorIds];
          const [moved] = colorIds.splice(fromIndex, 1);
          colorIds.splice(toIndex, 0, moved);
          return { ...item, colorIds, updatedAt: Date.now() };
        }),
      })),
    }),
    { name: RUNE_STASH_STORAGE_KEY, version: 1 },
  ),
);

export function suggestStashType(value: string): StashItemType {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return 'color';
  if (trimmed.length <= 4 && /[^\p{L}\p{N}\s]/u.test(trimmed)) return 'symbol';
  return 'text';
}

export function mixHexColors(a: string, b: string, ratio: number): string {
  const parse = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const clamped = Math.min(1, Math.max(0, ratio));
  const left = parse(a);
  const right = parse(b);
  return `#${left.map((channel, index) => Math.round(channel * (1 - clamped) + right[index] * clamped).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
