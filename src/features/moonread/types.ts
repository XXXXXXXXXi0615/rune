/**
 * MoonRead Human-AI Co-reading — Domain Types
 */

export type MoonReadBookFormat = 'txt' | 'md' | 'epub' | 'cbz';
export type ReadingDocumentKind = 'reflowable' | 'comic';
export type ComicReadingMode = 'single' | 'continuous';
export type ComicReadingDirection = 'ltr' | 'rtl';
export interface ComicPage { id: string; index: number; assetId: string; width?: number; height?: number; isCover?: boolean; }
export interface ComicBookDocument { kind: 'comic'; id: string; title: string; author?: string; series?: string; volume?: string; coverAssetId?: string; pages: ComicPage[]; pageCount: number; direction: ComicReadingDirection; defaultReadingMode: ComicReadingMode; createdAt: number; updatedAt: number; }
export interface ComicReadingProgress { bookId: string; pageIndex: number; mode: ComicReadingMode; direction: ComicReadingDirection; updatedAt: number; }
export interface ComicPageAnnotation { id: string; bookId: string; pageIndex: number; authorType: 'user' | 'ai'; content: string; createdAt: number; updatedAt: number; }
export type ReadingDocument = { kind: 'reflowable'; bookId: string } | ComicBookDocument;

export type MoonReadImportStatus = 'idle' | 'reading' | 'parsing' | 'extracting-cover' | 'saving' | 'ready' | 'duplicate' | 'unsupported' | 'failed';

export type MoonReadSourceType = 'local' | 'epub';

export type MoonReadLibraryState = 'active' | 'removed';

export interface MoonReadBook {
  id: string;
  title: string;
  author: string;
  description: string;
  format: MoonReadBookFormat;
  /** assetId for the source file (EPUB blob or TXT/MD) */
  sourceAssetId: string;
  /** assetId in the unified asset store (legacy alias for sourceAssetId) */
  assetId: string;
  /** file name at import time */
  fileName: string;
  /** word / character count estimate */
  wordCount: number;
  /** imported timestamp */
  importedAt: number;
  /** last opened timestamp */
  lastOpenedAt: number;
  /** reading progress 0..1 */
  progress: number;
  /** cover assetId (optional, auto-generated from text or placeholder) */
  coverAssetId?: string;
  /** user-defined tags */
  tags: string[];
  /** current chapter/section index for formats that support it */
  currentSectionIndex?: number;
  /** EPUB metadata */
  language?: string;
  identifier?: string;
  publisher?: string;
  /** fingerprint for duplicate detection (SHA-256 of file content) */
  fingerprint?: string;
  /** import status for real-time UI updates */
  importStatus?: MoonReadImportStatus;
  /** source type */
  sourceType?: MoonReadSourceType;
  /** last reading position locator (chapter index + character offset) */
  lastLocator?: string;
  /** library visibility state */
  libraryState: MoonReadLibraryState;
  /** timestamp when book was soft-removed */
  removedAt?: number;
  /** Explicit shelf state; legacy books infer this from tags/progress. */
  favorite?: boolean;
  wishlist?: boolean;
  completedAt?: number;
  readingRuns?: MoonReadReadingRun[];
  completionHistory?: number[];
  documentKind?: ReadingDocumentKind;
  comic?: ComicBookDocument;
}

export type MoonReadAnnotationKind = 'highlight' | 'bookmark' | 'lunaris-note' | 'node-comment';

export interface MoonReadAnnotation {
  id: string;
  bookId: string;
  /** start character index in the book text */
  start: number;
  /** end character index in the book text */
  end: number;
  /** highlighted text snippet */
  quote: string;
  /** user note */
  note: string;
  /** created / updated timestamp */
  createdAt: number;
  updatedAt: number;
  /** color index 0..7 */
  colorIndex: number;
  kind?: MoonReadAnnotationKind;
  /** Stable page/chapter locator used by co-reading entry points. */
  locator?: string;
  anchor?: MoonReadAnnotationAnchor;
  orphaned?: boolean;
}

export interface MoonReadAnnotationAnchor {
  chapterId: string;
  stableBlockId: string;
  exactText: string;
  prefix: string;
  suffix: string;
  offsets: { start: number; end: number };
  parserVersion: number;
  contentHash: string;
}

export interface MoonReadReadingRun {
  id: string;
  startedAt: number;
  endedAt?: number;
  startReason: 'initial' | 'restart';
}

export interface MoonReadReadingSession {
  bookId: string;
  /** word index / character offset the reader is currently at */
  position: number;
  /** total length in characters */
  totalLength: number;
  /** section index for structured books */
  sectionIndex: number;
  /** updated at */
  updatedAt: number;
}

export interface MoonReadImportResult {
  book: MoonReadBook;
  /** first 500 chars of text preview */
  preview: string;
}

export interface MoonReadImportError {
  /** machine-friendly code */
  code: 'duplicate' | 'unsupported' | 'empty' | 'too_large' | 'parse_error';
  /** i18n-ready message */
  message: string;
  /** original title, if detected before failing */
  title?: string;
}

export const MOONREAD_HIGHLIGHT_COLORS = [
  '#FFD700', // gold
  '#FF6B6B', // coral
  '#4ECDC4', // teal
  '#95E1D3', // mint
  '#A8D8EA', // sky
  '#D4A5A5', // rose
  '#C9B1FF', // lavender
  '#F7DC6F', // yellow
] as const;

/** EPUB spine item */
export interface EpubSpineItem {
  id: string;
  href: string;
  mediaType: string;
  /** linear order in spine */
  order: number;
}

/** EPUB TOC item */
export interface EpubTocItem {
  title: string;
  href: string;
  children?: EpubTocItem[];
}

/** Parsed EPUB structure */
export interface EpubManifest {
  metadata: {
    title: string;
    creator: string;
    language: string;
    identifier: string;
    publisher: string;
    description: string;
  };
  spine: EpubSpineItem[];
  toc: EpubTocItem[];
  /** cover image href */
  coverHref: string | null;
  /** base path for resolving relative URLs */
  basePath: string;
}

/** EPUB chapter content */
export interface EpubChapter {
  id: string;
  title: string;
  /** sanitized HTML content */
  html: string;
  /** character count */
  charCount: number;
}
