import type { TimeSlotId } from '@/features/focus/getFocusStatistics';

interface IconProps {
  size?: number;
  className?: string;
}

export function TimeSlotIcon({ id, size = 24, className }: { id: TimeSlotId } & IconProps) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className };

  switch (id) {
    case 'early_morning':
      return (
        <svg {...props}>
          <path d="M12 2v4" />
          <path d="M4.93 4.93l2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M4.93 19.07l2.83-2.83" />
          <path d="M12 22v-4" />
          <path d="M19.07 19.07l-2.83-2.83" />
          <path d="M22 12h-4" />
          <path d="M19.07 4.93l-2.83 2.83" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case 'morning':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2" />
          <path d="M12 21v2" />
          <path d="M4.22 4.22l1.42 1.42" />
          <path d="M18.36 18.36l1.42 1.42" />
          <path d="M1 12h2" />
          <path d="M21 12h2" />
          <path d="M4.22 19.78l1.42-1.42" />
          <path d="M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case 'afternoon':
      return (
        <svg {...props}>
          <path d="M12 2a7 7 0 0 0 0 14h1a5 5 0 0 0 0-10h-1a3 3 0 0 0 0 6" />
          <path d="M2 16h2" />
          <path d="M20 16h2" />
          <path d="M12 20v2" />
        </svg>
      );
    case 'evening':
      return (
        <svg {...props}>
          <path d="M12 10a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V20H10v-2.5c-1.2-.7-2-2-2-3.5a4 4 0 0 1 4-4z" />
          <path d="M12 6v2" />
          <path d="M8 8l1 1" />
          <path d="M16 8l-1 1" />
          <path d="M4 18h16" />
        </svg>
      );
    case 'night':
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      );
    case 'late_night':
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
          <path d="M3 8l1 1" />
          <path d="M7 3l1 1" />
          <path d="M21 15l-1-1" />
        </svg>
      );
  }
}

export function AchievementIcon({ id, size = 32, className }: { id: string } & IconProps) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className };

  switch (id) {
    case 'moonrise':
      return (
        <svg {...props}>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
          <path d="M3 20h18" />
        </svg>
      );
    case 'punctual':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'tide':
      return (
        <svg {...props}>
          <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" />
          <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" />
          <path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" />
        </svg>
      );
    case 'streak':
      return (
        <svg {...props}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'deep':
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M8 6l4-4 4 4" />
          <path d="M8 18l4 4 4-4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'recovery':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 9-9" />
          <polyline points="3 4 3 12 9 12" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
