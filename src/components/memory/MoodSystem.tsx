import type { MemoryMood } from '@/types';

/* ═══════════════════════════════════════════════
   Shared Mood System — used across the entire app
   ═══════════════════════════════════════════════ */

export interface MoodDef {
  id: MemoryMood;
  label: string;
  color: string;
}

export const MOODS: MoodDef[] = [
  { id: 'calm',    label: '平淡釋然', color: '#7CB7A3' },
  { id: 'happy',   label: '開心',     color: '#E4C76A' },
  { id: 'anxious', label: '焦慮緊張', color: '#D88F6B' },
  { id: 'angry',   label: '生氣紅溫', color: '#D45D5D' },
  { id: 'dark',    label: '陰暗爬行', color: '#8B82A6' },
  { id: 'panic',   label: '抓狂發瘋', color: '#E87979' },
];

export const MOOD_BY_ID = Object.fromEntries(MOODS.map(m => [m.id, m])) as Record<MemoryMood, MoodDef>;

/* ── Mood SVG Icons ── */

interface MoodIconProps {
  size?: number;
  className?: string;
}

const svgAttrs = (size: number) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function IconMoodCalm({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Gentle wave — peaceful sea */}
      <path d="M5 12 Q8 8 12 12 Q16 16 19 12" />
      <line x1={5} y1={18} x2={19} y2={18} opacity={0.5} />
    </svg>
  );
}

export function IconMoodHappy({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Smile */}
      <path d="M7 14 Q12 19 17 14" />
      <circle cx={8} cy={9} r={1.5} />
      <circle cx={16} cy={9} r={1.5} />
    </svg>
  );
}

export function IconMoodAnxious({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Nervous zigzag lines */}
      <path d="M9 5 L7 9 L9 13 L7 17" />
      <path d="M12 5 L10 9 L12 13 L10 17" />
      <path d="M15 5 L13 9 L15 13 L13 17" />
    </svg>
  );
}

export function IconMoodAngry({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Sharp angry peaks */}
      <path d="M7 13 L10 7 L13 13 L16 7 L17 13" />
      <circle cx={7.5} cy={9} r={1} />
      <circle cx={16.5} cy={9} r={1} />
    </svg>
  );
}

export function IconMoodDark({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Crescent moon shadow */}
      <circle cx={12} cy={12} r={9} />
      <circle cx={15} cy={10} r={7} fill="var(--surface-1)" stroke="none" />
    </svg>
  );
}

export function IconMoodPanic({ size = 20, className }: MoodIconProps) {
  const a = svgAttrs(size);
  return (
    <svg {...a} className={className}>
      {/* Spiral / chaotic */}
      <path d="M12 5 Q12 5 13 6 Q16 7 16 10 Q16 14 13 15 Q10 16 8 14 Q6 12 6 9 Q6 5 10 4 Q14 3 16 6 Q19 9 18 13" />
    </svg>
  );
}

export const MOOD_ICONS: Record<MemoryMood, React.FC<MoodIconProps>> = {
  calm:    IconMoodCalm,
  happy:   IconMoodHappy,
  anxious: IconMoodAnxious,
  angry:   IconMoodAngry,
  dark:    IconMoodDark,
  panic:   IconMoodPanic,
};

/** Returns the SVG icon component for a given mood */
export function moodIcon(mood: MemoryMood): React.FC<MoodIconProps> {
  return MOOD_ICONS[mood];
}
