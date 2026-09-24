import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MOONLEX_SEED_ENTRIES } from '@/features/moonlex/seedVocabulary';
import type {
  MoonLexLanguageFilter,
  VocabularyEntry,
  VocabularyLanguage,
  VocabularyMastery,
  VocabularyPracticeMode,
  VocabularyPracticeRecord,
  VocabularyPracticeResult,
} from '@/features/moonlex/types';

const STORAGE_KEY = 'lunartide-moonlex-v1';
const SCHEMA_VERSION = 2;
const MASTERIES: VocabularyMastery[] = ['new', 'learning', 'familiar', 'mastered'];
const PRACTICE_RESULTS: VocabularyPracticeResult[] = ['again', 'hard', 'good', 'easy'];
const PRACTICE_MODES: VocabularyPracticeMode[] = ['flip', 'choice'];

export interface MoonLexState {
  schemaVersion: number;
  entries: VocabularyEntry[];
  practiceRecords: VocabularyPracticeRecord[];
  selectedEntryId: string | null;
  languageFilter: MoonLexLanguageFilter;
  practiceDifficulty: 1 | 2 | 3 | 4 | 5;
  addEntry: (entry: Omit<VocabularyEntry, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<VocabularyEntry, 'id' | 'createdAt' | 'updatedAt'>>) => string;
  updateEntry: (id: string, updates: Partial<Omit<VocabularyEntry, 'id' | 'createdAt'>>) => void;
  /** Phase 1A boundary: returns false until a shared generic Trash owner exists. */
  deleteEntry: (id: string) => false;
  toggleFavorite: (id: string) => void;
  setSelectedEntry: (id: string | null) => void;
  setLanguageFilter: (language: MoonLexLanguageFilter) => void;
  setPracticeDifficulty: (difficulty: 1 | 2 | 3 | 4 | 5) => void;
  recordPractice: (input: Omit<VocabularyPracticeRecord, 'id' | 'reviewedAt'> & Partial<Pick<VocabularyPracticeRecord, 'id' | 'reviewedAt'>>) => void;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampDifficulty(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const numeric = Math.round(Number(value));
  return Math.min(5, Math.max(1, Number.isFinite(numeric) ? numeric : 1)) as 1 | 2 | 3 | 4 | 5;
}

export function normalizeVocabularyEntry(raw: unknown): VocabularyEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<VocabularyEntry>;
  const term = typeof value.term === 'string' ? value.term.trim() : '';
  const meanings = Array.isArray(value.meanings)
    ? value.meanings.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
  if (!term || meanings.length === 0 || (value.language !== 'en' && value.language !== 'ja')) return null;
  const now = Date.now();
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId('moonlex'),
    language: value.language,
    term,
    reading: typeof value.reading === 'string' && value.reading.trim() ? value.reading.trim() : undefined,
    phonetic: typeof value.phonetic === 'string' && value.phonetic.trim() ? value.phonetic.trim() : undefined,
    meanings,
    example: typeof value.example === 'string' && value.example.trim() ? value.example.trim() : undefined,
    exampleTranslation: typeof value.exampleTranslation === 'string' && value.exampleTranslation.trim() ? value.exampleTranslation.trim() : undefined,
    notes: typeof value.notes === 'string' && value.notes.trim() ? value.notes.trim() : undefined,
    tags: Array.isArray(value.tags) ? [...new Set(value.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim()))] : [],
    difficulty: clampDifficulty(value.difficulty),
    mastery: MASTERIES.includes(value.mastery as VocabularyMastery) ? value.mastery as VocabularyMastery : 'new',
    favorite: value.favorite === true,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : now,
    source: value.source && ['manual', 'moonread', 'chat', 'journal', 'import'].includes(value.source.type)
      ? { type: value.source.type, sourceId: typeof value.source.sourceId === 'string' ? value.source.sourceId : undefined }
      : undefined,
  };
}

function normalizeEntries(raw: unknown): VocabularyEntry[] {
  if (!Array.isArray(raw)) return MOONLEX_SEED_ENTRIES.map((entry) => ({ ...entry, meanings: [...entry.meanings], tags: [...entry.tags] }));
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const entry = normalizeVocabularyEntry(item);
    if (!entry || seen.has(entry.id)) return [];
    seen.add(entry.id);
    return [entry];
  });
}

export function normalizePracticeRecords(raw: unknown, legacyReviewHistory?: unknown): VocabularyPracticeRecord[] {
  const source = Array.isArray(raw) ? raw : Array.isArray(legacyReviewHistory) ? legacyReviewHistory : [];
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const vocabularyId = typeof value.vocabularyId === 'string' ? value.vocabularyId : typeof value.entryId === 'string' ? value.entryId : '';
    if (!vocabularyId) return [];
    const legacyRating = value.rating === 'remembered' ? 'good' : value.rating;
    const candidateResult = value.result ?? legacyRating;
    const result = PRACTICE_RESULTS.includes(candidateResult as VocabularyPracticeResult) ? candidateResult as VocabularyPracticeResult : 'again';
    const mode = PRACTICE_MODES.includes(value.mode as VocabularyPracticeMode) ? value.mode as VocabularyPracticeMode : 'flip';
    return [{
      id: typeof value.id === 'string' && value.id ? value.id : createId('moonlex-practice'),
      vocabularyId,
      reviewedAt: typeof value.reviewedAt === 'number' && Number.isFinite(value.reviewedAt) ? value.reviewedAt : Date.now(),
      result,
      mode,
      correct: typeof value.correct === 'boolean' ? value.correct : undefined,
    }];
  }).slice(0, 1000);
}

function nextMastery(current: VocabularyMastery, result: VocabularyPracticeResult): VocabularyMastery {
  if (result === 'again') return current === 'mastered' ? 'familiar' : current === 'familiar' ? 'learning' : current;
  if (result === 'hard') return current === 'new' ? 'learning' : current;
  if (result === 'good') return current === 'new' ? 'learning' : current === 'learning' ? 'familiar' : current;
  return current === 'new' || current === 'learning' ? 'familiar' : 'mastered';
}

export const useMoonLexStore = create<MoonLexState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      entries: normalizeEntries(undefined),
      practiceRecords: [],
      selectedEntryId: null,
      languageFilter: 'en',
      practiceDifficulty: 3,
      addEntry: (input) => {
        const now = Date.now();
        const entry = normalizeVocabularyEntry({ ...input, id: input.id ?? createId('moonlex'), createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now });
        if (!entry) throw new Error('MoonLex entry requires a language, term, and at least one meaning.');
        set((state) => ({ entries: [entry, ...state.entries.filter((item) => item.id !== entry.id)] }));
        return entry.id;
      },
      updateEntry: (id, updates) => set((state) => ({
        entries: state.entries.map((entry) => entry.id === id
          ? normalizeVocabularyEntry({ ...entry, ...updates, id: entry.id, createdAt: entry.createdAt, updatedAt: Date.now() }) ?? entry
          : entry),
      })),
      deleteEntry: () => false,
      toggleFavorite: (id) => set((state) => ({
        entries: state.entries.map((entry) => entry.id === id ? { ...entry, favorite: !entry.favorite, updatedAt: Date.now() } : entry),
      })),
      setSelectedEntry: (selectedEntryId) => set({ selectedEntryId }),
      setLanguageFilter: (languageFilter) => set({ languageFilter }),
      setPracticeDifficulty: (practiceDifficulty) => set({ practiceDifficulty: clampDifficulty(practiceDifficulty) }),
      recordPractice: (input) => {
        if (!get().entries.some((entry) => entry.id === input.vocabularyId)) return;
        const reviewedAt = input.reviewedAt ?? Date.now();
        const record = normalizePracticeRecords([{ ...input, id: input.id ?? createId('moonlex-practice'), reviewedAt }])[0];
        if (!record) return;
        set((state) => ({
          practiceRecords: [record, ...state.practiceRecords].slice(0, 1000),
          entries: state.entries.map((entry) => entry.id === record.vocabularyId
            ? { ...entry, mastery: nextMastery(entry.mastery, record.result), updatedAt: reviewedAt }
            : entry),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        entries: state.entries,
        practiceRecords: state.practiceRecords,
        selectedEntryId: state.selectedEntryId,
        languageFilter: state.languageFilter,
        practiceDifficulty: state.practiceDifficulty,
      }),
      merge: (persisted, current) => {
        const raw = persisted && typeof persisted === 'object' ? persisted as Record<string, unknown> : {};
        const legacyPreferences = raw.preferences && typeof raw.preferences === 'object' ? raw.preferences as Record<string, unknown> : {};
        const languageFilter = raw.languageFilter === 'all' || raw.languageFilter === 'ja' || raw.languageFilter === 'en'
          ? raw.languageFilter
          : legacyPreferences.language === 'ja' ? 'ja' : 'en';
        const entries = normalizeEntries(raw.entries);
        const selectedEntryId = typeof raw.selectedEntryId === 'string' && entries.some((entry) => entry.id === raw.selectedEntryId) ? raw.selectedEntryId : null;
        return {
          ...current,
          schemaVersion: SCHEMA_VERSION,
          entries,
          practiceRecords: normalizePracticeRecords(raw.practiceRecords, raw.reviewHistory),
          selectedEntryId,
          languageFilter,
          practiceDifficulty: clampDifficulty(raw.practiceDifficulty ?? legacyPreferences.difficulty),
        };
      },
    },
  ),
);

type MoonLexDataSlice = Pick<MoonLexState, 'entries' | 'practiceRecords' | 'languageFilter' | 'practiceDifficulty'>;

export function selectFilteredDeck(state: Pick<MoonLexState, 'entries' | 'languageFilter'>): VocabularyEntry[] {
  return state.entries.filter((entry) => state.languageFilter === 'all' || entry.language === state.languageFilter);
}

export function selectFavorites(state: Pick<MoonLexState, 'entries'>): VocabularyEntry[] {
  return state.entries.filter((entry) => entry.favorite);
}

export function selectMasteryCounts(state: Pick<MoonLexState, 'entries'>): Record<VocabularyMastery, number> {
  return state.entries.reduce<Record<VocabularyMastery, number>>((counts, entry) => {
    counts[entry.mastery] += 1;
    return counts;
  }, { new: 0, learning: 0, familiar: 0, mastered: 0 });
}

export function selectTodayVocabulary(state: Pick<MoonLexState, 'entries' | 'practiceRecords'>, now = Date.now()): VocabularyEntry[] {
  const start = new Date(now).setHours(0, 0, 0, 0);
  const practiced = new Set(state.practiceRecords.filter((record) => record.reviewedAt >= start && record.reviewedAt <= now).map((record) => record.vocabularyId));
  const prioritized = [...state.entries].sort((a, b) => Number(practiced.has(a.id)) - Number(practiced.has(b.id)) || a.updatedAt - b.updatedAt);
  return prioritized.slice(0, 5);
}

/** Phase 1A due semantics: active-learning entries not yet reviewed today. No SRS interval is implied. */
export function selectDueCount(state: Pick<MoonLexState, 'entries' | 'practiceRecords'>, now = Date.now()): number {
  const start = new Date(now).setHours(0, 0, 0, 0);
  const practiced = new Set(state.practiceRecords.filter((record) => record.reviewedAt >= start && record.reviewedAt <= now).map((record) => record.vocabularyId));
  return state.entries.filter((entry) => (entry.mastery === 'new' || entry.mastery === 'learning') && !practiced.has(entry.id)).length;
}

export function selectMoonLexPracticePool(state: MoonLexDataSlice): VocabularyEntry[] {
  const filtered = selectFilteredDeck(state);
  const exact = filtered.filter((entry) => entry.difficulty === state.practiceDifficulty);
  return exact.length > 0 ? exact : filtered;
}
