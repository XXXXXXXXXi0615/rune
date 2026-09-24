import { beforeEach, describe, expect, it } from 'vitest';
import { MOONLEX_SEED_ENTRIES } from '@/features/moonlex/seedVocabulary';
import { getDesktopSecondaryModules, getMobileMoreModules, getModuleById } from '@/features/navigation/appModuleRegistry';
import { normalizePracticeRecords, normalizeVocabularyEntry, selectDueCount, selectMasteryCounts, selectMoonLexPracticePool, useMoonLexStore } from '@/store/useMoonLexStore';

describe('MoonLex domain integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useMoonLexStore.setState({
      schemaVersion: 2,
      entries: MOONLEX_SEED_ENTRIES.map((entry) => ({ ...entry, meanings: [...entry.meanings], tags: [...entry.tags] })),
      practiceRecords: [],
      selectedEntryId: null,
      languageFilter: 'en',
      practiceDifficulty: 3,
    });
  });

  it('normalizes the canonical entry contract and rejects unusable records', () => {
    expect(normalizeVocabularyEntry({ language: 'en', term: '  tide  ', meanings: [' 潮汐 '], tags: ['sea', 'sea'], difficulty: 9 }))
      .toMatchObject({ language: 'en', term: 'tide', meanings: ['潮汐'], tags: ['sea'], difficulty: 5, mastery: 'new' });
    expect(normalizeVocabularyEntry({ language: 'en', term: '', meanings: [] })).toBeNull();
    expect(normalizeVocabularyEntry({ language: 'zh', term: '月', meanings: ['moon'] })).toBeNull();
  });

  it('keeps practice records separate from vocabulary entries', () => {
    const first = useMoonLexStore.getState().entries[0];
    useMoonLexStore.getState().recordPractice({ vocabularyId: first.id, result: 'good', mode: 'flip' });
    useMoonLexStore.getState().recordPractice({ vocabularyId: first.id, result: 'hard', mode: 'choice', correct: false });
    const state = useMoonLexStore.getState();
    expect(state.practiceRecords.map((record) => record.result)).toEqual(['hard', 'good']);
    expect(state.practiceRecords[0]).toMatchObject({ vocabularyId: first.id, mode: 'choice', correct: false });
    expect('practiceRecords' in state.entries[0]).toBe(false);
    expect(state.entries.find((entry) => entry.id === first.id)?.mastery).toBe('familiar');
  });

  it('migrates v1 review history into the v2 practice boundary', () => {
    expect(normalizePracticeRecords(undefined, [{ id: 'legacy-1', entryId: 'word-1', rating: 'remembered', reviewedAt: 123 }]))
      .toEqual([{ id: 'legacy-1', vocabularyId: 'word-1', reviewedAt: 123, result: 'good', mode: 'flip', correct: undefined }]);
  });

  it('falls back to the selected language when a difficulty pool is empty', () => {
    const pool = selectMoonLexPracticePool({ entries: MOONLEX_SEED_ENTRIES, practiceRecords: [], languageFilter: 'ja', practiceDifficulty: 5 });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((entry) => entry.language === 'ja')).toBe(true);
  });

  it('derives mastery and due totals instead of persisting duplicate counters', () => {
    const state = useMoonLexStore.getState();
    expect(selectMasteryCounts(state)).toEqual({ new: 4, learning: 2, familiar: 2, mastered: 0 });
    expect(selectDueCount(state)).toBe(6);
    expect('masteryCounts' in state).toBe(false);
    expect('dueCount' in state).toBe(false);
  });

  it('keeps deletion non-destructive until a shared Trash owner exists', () => {
    const first = useMoonLexStore.getState().entries[0];
    expect(useMoonLexStore.getState().deleteEntry(first.id)).toBe(false);
    expect(useMoonLexStore.getState().entries.some((entry) => entry.id === first.id)).toBe(true);
  });

  it('registers one canonical MoonLex navigation module for desktop and Mobile More', () => {
    expect(getModuleById('moonlex')).toMatchObject({ label: 'Lexicon', route: '/moonlex', showInModuleSettings: true });
    expect(getDesktopSecondaryModules().filter((module) => module.id === 'moonlex')).toHaveLength(1);
    expect(getMobileMoreModules().filter((module) => module.id === 'moonlex')).toHaveLength(1);
  });
});
