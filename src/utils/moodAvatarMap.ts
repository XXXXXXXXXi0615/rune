/* ── MoodAvatarMap — unified todayMood avatar definitions ── */

import type { TodayMood } from '@/types';

export interface TodayMoodDef {
  id: TodayMood;
  label: string;
  labelEn: string;
  color: string;
  /** CSS background gradient for avatars */
  gradient: string;
}

export const TODAY_MOODS: TodayMoodDef[] = [
  { id: 'happy',    label: '開心',     labelEn: 'Happy',    color: '#E4B840', gradient: 'linear-gradient(135deg, #FDE68A, #F0C75E)' },
  { id: 'calm',     label: '平靜',     labelEn: 'Calm',     color: '#5DB8A6', gradient: 'linear-gradient(135deg, #A8E6CF, #5DB8A6)' },
  { id: 'anxiety',  label: '焦慮',     labelEn: 'Anxious',  color: '#D88F6B', gradient: 'linear-gradient(135deg, #F5C6AA, #D88F6B)' },
  { id: 'gloomy',   label: '低落',     labelEn: 'Gloomy',   color: '#8B82A6', gradient: 'linear-gradient(135deg, #C4B5D6, #8B82A6)' },
  { id: 'angry',    label: '生氣',     labelEn: 'Angry',    color: '#D45D5D', gradient: 'linear-gradient(135deg, #F5A8A8, #D45D5D)' },
  { id: 'meltdown', label: '崩潰',     labelEn: 'Meltdown', color: '#E87979', gradient: 'linear-gradient(135deg, #FCCACA, #E87979)' },
];

export const TODAY_MOOD_BY_ID: Record<TodayMood, TodayMoodDef> = Object.fromEntries(
  TODAY_MOODS.map(m => [m.id, m])
) as Record<TodayMood, TodayMoodDef>;

/** Per-session: check if todayMood was set today */
export function isMoodFromToday(): boolean {
  try {
    const raw = localStorage.getItem('lunartide_today_mood_ts');
    if (!raw) return false;
    const ts = Number(raw);
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    return ts >= todayStart;
  } catch { return false; }
}

export function markTodayMoodTimestamp(): void {
  localStorage.setItem('lunartide_today_mood_ts', String(Date.now()));
}

/** Map PeriodPage mood to TodayMood */
import type { PeriodMood } from '@/utils/periodStorage';

const PERIOD_TO_TODAY: Record<PeriodMood, TodayMood> = {
  calm: 'calm',
  gentle: 'calm',
  radiant: 'happy',
  turbulent: 'anxiety',
  stormy: 'angry',
};

export function periodMoodToTodayMood(pm: PeriodMood): TodayMood {
  return PERIOD_TO_TODAY[pm];
}

/** Map TodayMood to MemoryMood for Second Brain sync */
import type { MemoryMood } from '@/types';

const TODAY_TO_MEMORY: Record<TodayMood, MemoryMood> = {
  happy: 'happy',
  calm: 'calm',
  anxiety: 'anxious',
  gloomy: 'dark',
  angry: 'angry',
  meltdown: 'panic',
};

export function todayMoodToMemoryMood(tm: TodayMood): MemoryMood {
  return TODAY_TO_MEMORY[tm];
}
