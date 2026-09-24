export type VocabularyLanguage = 'en' | 'ja';

export type VocabularyMastery = 'new' | 'learning' | 'familiar' | 'mastered';

export type VocabularySourceType = 'manual' | 'moonread' | 'chat' | 'journal' | 'import';

export interface VocabularyEntry {
  id: string;
  language: VocabularyLanguage;
  term: string;
  reading?: string;
  phonetic?: string;
  meanings: string[];
  example?: string;
  exampleTranslation?: string;
  notes?: string;
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  mastery: VocabularyMastery;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  source?: {
    type: VocabularySourceType;
    sourceId?: string;
  };
}

export type VocabularyPracticeResult = 'again' | 'hard' | 'good' | 'easy';

export type VocabularyPracticeMode = 'flip' | 'choice';

export interface VocabularyPracticeRecord {
  id: string;
  vocabularyId: string;
  reviewedAt: number;
  result: VocabularyPracticeResult;
  mode: VocabularyPracticeMode;
  correct?: boolean;
}

export type MoonLexLanguageFilter = VocabularyLanguage | 'all';

export type MoonLexLibraryFilter = 'today' | 'all' | 'favorites' | 'learning';
