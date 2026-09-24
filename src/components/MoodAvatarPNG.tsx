/* ── MoodAvatarPNG — PNG-based mood avatar for full-site use ── */

import happyPng from '@/assets/moods/happy.png';
import calmPng from '@/assets/moods/calm.png';
import anxietyPng from '@/assets/moods/anxiety.png';
import angryPng from '@/assets/moods/angry.png';
import gloomyPng from '@/assets/moods/gloomy.png';
import meltdownPng from '@/assets/moods/meltdown.png';

const MOOD_PNG: Record<string, string> = {
  // TodayMood keys
  happy: happyPng,
  calm: calmPng,
  anxiety: anxietyPng,
  gloomy: gloomyPng,
  angry: angryPng,
  meltdown: meltdownPng,
  // MemoryMood → TodayMood reverse mapping
  anxious: anxietyPng,
  dark: gloomyPng,
  panic: meltdownPng,
};

// from moodAvatarMap.ts
const MOOD_LABELS: Record<string, { zh: string; en: string }> = {
  happy: { zh: '開心', en: 'Happy' },
  calm: { zh: '平靜', en: 'Calm' },
  anxiety: { zh: '焦慮', en: 'Anxious' },
  gloomy: { zh: '低落', en: 'Gloomy' },
  angry: { zh: '生氣', en: 'Angry' },
  meltdown: { zh: '崩潰', en: 'Meltdown' },
  anxious: { zh: '焦慮', en: 'Anxious' },
  dark: { zh: '低落', en: 'Gloomy' },
  panic: { zh: '崩潰', en: 'Meltdown' },
};

/** Resolve the PNG source for any mood key (TodayMood or MemoryMood) */
export function resolveMoodPng(mood: string): string | undefined {
  return MOOD_PNG[mood];
}

/** Resolve the label for a mood key */
export function resolveMoodLabel(mood: string, isZh: boolean): string | undefined {
  const entry = MOOD_LABELS[mood];
  return entry ? (isZh ? entry.zh : entry.en) : undefined;
}

interface MoodAvatarPNGProps {
  mood: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** PNG-based mood avatar. Accepts both TodayMood and MemoryMood keys. */
export function MoodAvatarPNG({ mood, size = 32, className, style }: MoodAvatarPNGProps) {
  const src = MOOD_PNG[mood];
  if (!src) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--surface-2)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: size * 0.4,
          color: 'var(--text-3)',
          ...style,
        }}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={MOOD_LABELS[mood]?.en || mood}
      title={MOOD_LABELS[mood]?.en || mood}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        display: 'block',
        ...style,
      }}
      loading="lazy"
    />
  );
}

export default MoodAvatarPNG;
