import { create } from 'zustand';
import { isLocalDateKey } from '@/utils/date';

export const DAILY_MOOD_STORAGE_KEY = 'lunartide-daily-mood-v1';

export const DAILY_MOOD_IDS = ['calm', 'good', 'neutral', 'sad', 'angry', 'overwhelmed'] as const;

export type MoodId = (typeof DAILY_MOOD_IDS)[number];
export type DailyMoodRecords = Record<string, MoodId>;

export function isMoodId(value: unknown): value is MoodId {
  return typeof value === 'string' && DAILY_MOOD_IDS.some((mood) => mood === value);
}

export function normalizeDailyMoods(value: unknown): DailyMoodRecords {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([dateKey, mood]) => isLocalDateKey(dateKey) && isMoodId(mood)),
  ) as DailyMoodRecords;
}

function loadRecords(): DailyMoodRecords {
  try {
    return normalizeDailyMoods(JSON.parse(localStorage.getItem(DAILY_MOOD_STORAGE_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

function saveRecords(records: DailyMoodRecords): void {
  try { localStorage.setItem(DAILY_MOOD_STORAGE_KEY, JSON.stringify(records)); } catch { /* storage unavailable */ }
}

interface DailyMoodStore {
  moods: DailyMoodRecords;
  getMood: (dateKey: string) => MoodId | null;
  setMood: (dateKey: string, moodId: MoodId) => void;
  clearMood: (dateKey: string) => void;
  toggleMood: (dateKey: string, moodId: MoodId) => void;
}

export const useDailyMoodStore = create<DailyMoodStore>((set, get) => ({
  moods: loadRecords(),
  getMood: (dateKey) => isLocalDateKey(dateKey) ? get().moods[dateKey] ?? null : null,
  setMood: (dateKey, moodId) => {
    if (!isLocalDateKey(dateKey) || !isMoodId(moodId) || get().moods[dateKey] === moodId) return;
    const moods = { ...get().moods, [dateKey]: moodId };
    saveRecords(moods);
    set({ moods });
  },
  clearMood: (dateKey) => {
    if (!isLocalDateKey(dateKey) || !get().moods[dateKey]) return;
    const moods = { ...get().moods };
    delete moods[dateKey];
    saveRecords(moods);
    set({ moods });
  },
  toggleMood: (dateKey, moodId) => {
    if (!isLocalDateKey(dateKey) || !isMoodId(moodId)) return;
    if (get().moods[dateKey] === moodId) get().clearMood(dateKey);
    else get().setMood(dateKey, moodId);
  },
}));
