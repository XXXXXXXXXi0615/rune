export const READING_BOARD_WIDTH = 750;
export const READING_BOARD_HEIGHT = 1334;

export interface ReadingMemoryBoard {
  id: string;
  bookId?: string;
  title: string;
  subtitle?: string;
  templateId: string;
  designWidth: number;
  designHeight: number;
  entries: ReadingTimelineEntry[];
  imageLayers: ReadingImageLayer[];
  createdAt: number;
  updatedAt: number;
}

export interface ReadingTimelineEntry {
  id: string;
  bookId?: string;
  date: number;
  title: string;
  author?: string;
  excerpt?: string;
  moodTag?: string;
  coverAssetId?: string;
  chapterTitle?: string;
  order: number;
}

export interface ReadingImageLayer {
  id: string;
  type: 'image';
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  flipX?: boolean;
  flipY?: boolean;
  aspectMode: 'contain' | 'free';
}

export type ReadingBoardDecoration = ReadingImageLayer;

export type ReadingBoardMode = 'edit' | 'preview' | 'reading';
