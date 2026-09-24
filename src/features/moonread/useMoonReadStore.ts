import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MoonReadBook, MoonReadAnnotation, MoonReadReadingSession, MoonReadImportStatus, ComicPageAnnotation, ComicReadingProgress } from './types';
import { importComicArchive, importComicImages, type ComicImportOptions, type ComicImportProgress } from './comic/importComic';
import { normalizeComicPage } from './comic/runtime';
import { parseMoonReadFile } from './importBook';
import type { MoonReadImportError, MoonReadImportResult } from './types';
import { deleteAsset } from '@/store/assets';

interface MoonReadState {
  books: MoonReadBook[];
  annotations: MoonReadAnnotation[];
  sessions: Record<string, MoonReadReadingSession>;
  sessionHistory: Record<string, MoonReadReadingSession[]>;
  /** Current import status for real-time UI */
  importStatus: MoonReadImportStatus;
  /** Currently importing book (for processing card) */
  importingBook: MoonReadBook | null;
  comicProgress: Record<string, ComicReadingProgress>;
  comicAnnotations: ComicPageAnnotation[];
}

interface MoonReadActions {
  importBook(file: File): Promise<MoonReadImportResult | MoonReadImportError>;
  removeBook(bookId: string): Promise<void>;
  softRemoveBook(bookId: string): void;
  restoreBook(bookId: string): void;
  permanentDeleteBook(bookId: string): Promise<void>;
  updateBook(bookId: string, patch: Partial<MoonReadBook>): void;
  openBook(bookId: string): void;
  updateSession(bookId: string, position: number, totalLength: number, sectionIndex?: number): void;
  addAnnotation(annotation: Omit<MoonReadAnnotation, 'id' | 'createdAt' | 'updatedAt'>): void;
  updateAnnotation(annotationId: string, patch: Partial<MoonReadAnnotation>): void;
  removeAnnotation(annotationId: string): void;
  setBookTags(bookId: string, tags: string[]): void;
  setImportStatus(status: MoonReadImportStatus): void;
  setImportingBook(book: MoonReadBook | null): void;
  restartBook(bookId: string): void;
  markUnread(bookId: string): void;
  markComplete(bookId: string): void;
  reanchorAnnotations(bookId: string, blocks: import('./contentModel').MoonReadBlock[]): void;
  importComic(file: File, options?: Partial<ComicImportOptions>, onProgress?: (progress: ComicImportProgress) => void, signal?: AbortSignal): Promise<MoonReadBook>;
  importComicImages(files: File[], options: ComicImportOptions, onProgress?: (progress: ComicImportProgress) => void, signal?: AbortSignal): Promise<MoonReadBook>;
  updateComicProgress(progress: ComicReadingProgress): void;
  addComicAnnotation(annotation: Omit<ComicPageAnnotation, 'id' | 'createdAt' | 'updatedAt'>): void;
  removeComicAnnotation(id: string): void;
}

const STORAGE_KEY = 'lunartide-moonread-v1';

export const useMoonReadStore = create<MoonReadState & MoonReadActions>()(
  persist(
    (set, get) => ({
      books: [],
      annotations: [],
      sessions: {},
      sessionHistory: {},
      importStatus: 'idle',
      importingBook: null,
      comicProgress: {},
      comicAnnotations: [],

      async importComic(file, options, onProgress, signal) {
        const book = await importComicArchive(file, options, onProgress, signal);
        set((state) => ({ books: [book, ...state.books] }));
        return book;
      },
      async importComicImages(files, options, onProgress, signal) {
        const book = await importComicImages(files, options, onProgress, signal);
        set((state) => ({ books: [book, ...state.books] }));
        return book;
      },
      updateComicProgress(progress) {
        const pageCount = get().books.find((book) => book.id === progress.bookId)?.comic?.pageCount || 1;
        const normalized = { ...progress, pageIndex: normalizeComicPage(progress.pageIndex, pageCount), updatedAt: Date.now() };
        set((state) => ({ comicProgress: { ...state.comicProgress, [progress.bookId]: normalized }, books: state.books.map((book) => book.id === progress.bookId ? { ...book, progress: pageCount > 1 ? normalized.pageIndex / (pageCount - 1) : 1, lastOpenedAt: Date.now() } : book) }));
      },
      addComicAnnotation(annotation) { const now=Date.now(); set((state)=>({comicAnnotations:[...state.comicAnnotations,{...annotation,id:crypto.randomUUID(),createdAt:now,updatedAt:now}]})); },
      removeComicAnnotation(id) { set((state)=>({comicAnnotations:state.comicAnnotations.filter((item)=>item.id!==id)})); },

      async importBook(file) {
        set({ importStatus: 'reading', importingBook: null });

        const result = await parseMoonReadFile(file, get().books, (status) => {
          set({ importStatus: status });
        });

        if ('code' in result) {
          set({ importStatus: result.code as MoonReadImportStatus, importingBook: null });
          return result;
        }

        // Add processing card immediately
        set({ importingBook: result.book });

        // Add to books list
        set((state) => ({
          books: [result.book, ...state.books],
          importStatus: 'ready',
          importingBook: null,
        }));

        return result;
      },

      async removeBook(bookId) {
        // Soft remove by default - mark as removed but keep data
        get().softRemoveBook(bookId);
      },

      softRemoveBook(bookId) {
        const now = Date.now();
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId
              ? { ...b, libraryState: 'removed' as const, removedAt: now }
              : b
          ),
        }));
      },

      restoreBook(bookId) {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId
              ? { ...b, libraryState: 'active' as const, removedAt: undefined }
              : b
          ),
        }));
      },

      async permanentDeleteBook(bookId) {
        const book = get().books.find((b) => b.id === bookId);
        if (!book) return;
        const snapshot = get();
        set((state) => ({
          books: state.books.filter((b) => b.id !== bookId),
          annotations: state.annotations.filter((a) => a.bookId !== bookId),
          sessions: Object.fromEntries(Object.entries(state.sessions).filter(([key]) => key !== bookId)),
          sessionHistory: Object.fromEntries(Object.entries(state.sessionHistory).filter(([key]) => key !== bookId)),
          comicProgress: Object.fromEntries(Object.entries(state.comicProgress).filter(([key]) => key !== bookId)),
          comicAnnotations: state.comicAnnotations.filter((item) => item.bookId !== bookId),
        }));
        try {
          if (book.documentKind === 'comic' && book.comic) await Promise.all(book.comic.pages.map((page) => deleteAsset(page.assetId)));
          else await deleteAsset(book.sourceAssetId || book.assetId);
          if (book.coverAssetId) {
            await deleteAsset(book.coverAssetId);
          }
        } catch (error) {
          set({ books: snapshot.books, annotations: snapshot.annotations, sessions: snapshot.sessions, sessionHistory: snapshot.sessionHistory });
          throw error;
        }
      },

      updateBook(bookId, patch) {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId ? { ...b, ...patch } : b
          ),
        }));
      },

      openBook(bookId) {
        const now = Date.now();
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId ? { ...b, lastOpenedAt: now } : b
          ),
        }));
      },

      updateSession(bookId, position, totalLength, sectionIndex = 0) {
        const progress = totalLength > 0 ? Math.min(1, Math.max(0, position / totalLength)) : 0;
        set((state) => {
          const prior = state.sessions[bookId];
          const history = prior && (prior.position !== position || prior.sectionIndex !== sectionIndex)
            ? [...(state.sessionHistory?.[bookId] || []), prior].slice(-500)
            : state.sessionHistory?.[bookId] || [];
          return ({
          sessions: {
            ...state.sessions,
            [bookId]: {
              bookId,
              position,
              totalLength,
              sectionIndex,
              updatedAt: Date.now(),
            },
          },
          sessionHistory: { ...(state.sessionHistory || {}), [bookId]: history },
          books: state.books.map((b) =>
            b.id === bookId
              ? { ...b, progress, currentSectionIndex: sectionIndex }
              : b
          ),
        }); });
      },

      restartBook(bookId) {
        set((state) => ({
          sessionHistory: { ...(state.sessionHistory || {}), [bookId]: [...(state.sessionHistory?.[bookId] || []), ...(state.sessions[bookId] ? [state.sessions[bookId]] : [])] },
          sessions: { ...state.sessions, [bookId]: { bookId, position: 0, totalLength: state.sessions[bookId]?.totalLength || 0, sectionIndex: 0, updatedAt: Date.now() } },
          books: state.books.map((b) => b.id === bookId ? { ...b, progress: 0, currentSectionIndex: 0, lastOpenedAt: Date.now(), readingRuns: [...(b.readingRuns || []), { id: crypto.randomUUID(), startedAt: Date.now(), startReason: 'restart' as const }] } : b),
        }));
      },

      markUnread(bookId) {
        set((state) => ({
          sessionHistory: { ...(state.sessionHistory || {}), [bookId]: [...(state.sessionHistory?.[bookId] || []), ...(state.sessions[bookId] ? [state.sessions[bookId]] : [])] },
          sessions: { ...state.sessions, [bookId]: { bookId, position: 0, totalLength: state.sessions[bookId]?.totalLength || 0, sectionIndex: 0, updatedAt: Date.now() } },
          books: state.books.map((b) => b.id === bookId ? { ...b, progress: 0, currentSectionIndex: 0, completedAt: undefined } : b),
        }));
      },

      markComplete(bookId) {
        const now = Date.now();
        set((state) => ({ books: state.books.map((book) => book.id === bookId ? { ...book, progress:1, completedAt:now, completionHistory:[...(book.completionHistory || []), now] } : book) }));
      },

      reanchorAnnotations(bookId, blocks) {
        import('./contentModel').then(({ reanchorMoonReadAnnotation, hashMoonReadText }) => set((state) => ({
          annotations: state.annotations.map((annotation) => {
            if (annotation.bookId !== bookId || !annotation.anchor) return annotation;
            const result = reanchorMoonReadAnnotation(annotation.anchor, blocks);
            if (result.strategy === 'orphaned' || !result.block) return { ...annotation, orphaned: true };
            return { ...annotation, orphaned: false, start: result.offsets.start, end: result.offsets.end, anchor: { ...annotation.anchor, stableBlockId: result.block.stableBlockId, offsets: result.offsets, contentHash: hashMoonReadText(result.block.text) } };
          }),
        })));
      },

      addAnnotation(annotation) {
        const now = Date.now();
        set((state) => ({
          annotations: [
            ...state.annotations,
            {
              ...annotation,
              id: crypto.randomUUID(),
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
      },

      updateAnnotation(annotationId, patch) {
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === annotationId
              ? { ...a, ...patch, updatedAt: Date.now() }
              : a
          ),
        }));
      },

      removeAnnotation(annotationId) {
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== annotationId),
        }));
      },

      setBookTags(bookId, tags) {
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId ? { ...b, tags } : b
          ),
        }));
      },

      setImportStatus(status) {
        set({ importStatus: status });
      },

      setImportingBook(book) {
        set({ importingBook: book });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        books: state.books,
        annotations: state.annotations,
        sessions: state.sessions,
        sessionHistory: state.sessionHistory,
        comicProgress: state.comicProgress,
        comicAnnotations: state.comicAnnotations,
      }),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<MoonReadState>), sessionHistory: (persisted as Partial<MoonReadState>)?.sessionHistory || {}, comicProgress: (persisted as Partial<MoonReadState>)?.comicProgress || {}, comicAnnotations: (persisted as Partial<MoonReadState>)?.comicAnnotations || [] }),
    }
  )
);
