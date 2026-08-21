import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PhotoEntry } from '@/types';

const PHOTO_WALL_KEY = 'lunartide-photo-wall';

const PIN_COLORS = ['#d87c4c', '#8a7ab8', '#5a8a5a', '#b87038', '#8a6060', '#6080a8'];

interface PhotoWallState {
  photoEntries: PhotoEntry[];
  layoutByPhotoId: Record<string, PhotoWallLayout>;
}

export interface PhotoWallLayout {
  photoId: string;
  x: number;
  y: number;
  rotation: number;
  zOrder: number;
}

interface PhotoWallActions {
  addPhotoEntry: (entry: Omit<PhotoEntry, 'id' | 'createdAt'>) => string;
  updatePhotoEntry: (id: string, patch: Partial<PhotoEntry>) => void;
  deletePhotoEntry: (id: string) => void;
  clearOrphanFromNoteId: (noteId: string) => void;
  migrateOrphanedEntries: (draftId: string) => void;
  commitPhotoLayout: (layout: PhotoWallLayout) => void;
}

const DEFAULT_SLOTS = [
  { x: .05, y: .08, rotation: -2 }, { x: .28, y: .06, rotation: 2 },
  { x: .51, y: .10, rotation: -1 }, { x: .74, y: .07, rotation: 1.5 },
  { x: .14, y: .42, rotation: 1 }, { x: .40, y: .38, rotation: -2.5 },
  { x: .65, y: .44, rotation: 2.2 }, { x: .82, y: .36, rotation: -1.2 },
] as const;

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, typeof value === 'number' && Number.isFinite(value) ? value : 0));
}

function normalizeLayouts(value: unknown, photos: PhotoEntry[]): Record<string, PhotoWallLayout> {
  const raw = value && typeof value === 'object' ? value as Record<string, Partial<PhotoWallLayout>> : {};
  const ordered = [...photos].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return Object.fromEntries(ordered.map((photo, index) => {
    const persisted = raw[photo.id];
    const slot = DEFAULT_SLOTS[index % DEFAULT_SLOTS.length];
    const row = Math.floor(index / DEFAULT_SLOTS.length);
    return [photo.id, {
      photoId: photo.id,
      x: persisted ? clamp01(persisted.x) : slot.x,
      y: persisted ? clamp01(persisted.y) : Math.min(.92, slot.y + row * .34),
      rotation: typeof persisted?.rotation === 'number' ? persisted.rotation : (Number.isFinite(photo.rotation) ? photo.rotation : slot.rotation),
      zOrder: typeof persisted?.zOrder === 'number' ? Math.max(1, Math.round(persisted.zOrder)) : index + 1,
    }];
  }));
}

function normalizePhotoEntries(value: unknown): PhotoEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.imageData === 'string').map((p) => ({
    id: p.id,
    imageData: p.imageData,
    caption: typeof p.caption === 'string' ? p.caption : '',
    date: typeof p.date === 'string' ? p.date : '',
    time: typeof p.time === 'string' ? p.time : '',
    rotation: typeof p.rotation === 'number' ? p.rotation : 0,
    offsetX: typeof p.offsetX === 'number' ? p.offsetX : Math.round((Math.random() * 20 - 10) * 10) / 10,
    offsetY: typeof p.offsetY === 'number' ? p.offsetY : Math.round((Math.random() * 20 - 8) * 10) / 10,
    fromNoteId: typeof p.fromNoteId === 'string' ? p.fromNoteId : undefined,
    pinColor: typeof p.pinColor === 'string' ? p.pinColor : PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
    aspectRatio: p.aspectRatio === 'portrait' || p.aspectRatio === 'landscape' || p.aspectRatio === 'square' ? p.aspectRatio : 'square',
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
  }));
}

export const usePhotoWallStore = create<PhotoWallState & PhotoWallActions>()(
  persist(
    (set, get) => ({
      photoEntries: [],
      layoutByPhotoId: {},

      addPhotoEntry: (entry) => {
        const id = crypto.randomUUID();
        set((state) => {
          const nextPhoto = { ...entry, id, createdAt: Date.now() };
          const nextPhotos = [nextPhoto, ...state.photoEntries];
          return { photoEntries: nextPhotos, layoutByPhotoId: normalizeLayouts(state.layoutByPhotoId, nextPhotos) };
        });
        return id;
      },

      updatePhotoEntry: (id, patch) =>
        set((state) => ({
          photoEntries: state.photoEntries.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        })),

      deletePhotoEntry: (id) =>
        set((state) => {
          const { [id]: _removed, ...layoutByPhotoId } = state.layoutByPhotoId;
          return { photoEntries: state.photoEntries.filter((p) => p.id !== id), layoutByPhotoId };
        }),

      clearOrphanFromNoteId: (noteId) =>
        set((state) => ({
          photoEntries: state.photoEntries.map((p) =>
            p.fromNoteId === noteId ? { ...p, fromNoteId: undefined } : p
          ),
        })),

      migrateOrphanedEntries: (draftId) =>
        set((state) => ({
          photoEntries: state.photoEntries.map((p) =>
            p.fromNoteId === draftId ? { ...p, fromNoteId: undefined } : p
          ),
        })),

      commitPhotoLayout: (layout) => set((state) => {
        const existing = state.layoutByPhotoId;
        const maxZ = Math.max(0, ...Object.values(existing).map((item) => item.zOrder));
        let next = { ...existing, [layout.photoId]: { ...layout, x: clamp01(layout.x), y: clamp01(layout.y), zOrder: Math.max(1, Math.round(layout.zOrder)) } };
        if (maxZ > Math.max(100, state.photoEntries.length * 8)) {
          next = Object.fromEntries(Object.values(next).sort((a, b) => a.zOrder - b.zOrder).map((item, index) => [item.photoId, { ...item, zOrder: index + 1 }]));
        }
        return { layoutByPhotoId: next };
      }),
    }),
    {
      name: PHOTO_WALL_KEY,
      merge: (persisted, current) => {
        const raw = (persisted as Partial<PhotoWallState>)?.photoEntries;
        const photoEntries = normalizePhotoEntries(raw);
        return { ...current, photoEntries, layoutByPhotoId: normalizeLayouts((persisted as Partial<PhotoWallState>)?.layoutByPhotoId, photoEntries) };
      },
    }
  )
);

export function getPhotoEntriesSize(): number {
  try {
    const entries = usePhotoWallStore.getState().photoEntries;
    return new Blob([JSON.stringify(entries)]).size;
  } catch {
    return 0;
  }
}

export function isPhotoReferencedByJournal(photoId: string, journalEntries: Array<{ imageRefs?: Array<{ photoId: string }> }>): boolean {
  return journalEntries.some((entry) => entry.imageRefs?.some((ref) => ref.photoId === photoId));
}

export function resolvePhotoImageUrl(photo: PhotoEntry): string {
  return photo.imageData;
}
