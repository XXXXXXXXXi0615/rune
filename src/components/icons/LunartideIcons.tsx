// ================================================================
// Lunartide SVG Icons — stroke-based, no emoji
// ================================================================

interface IconProps {
  size?: number;
  className?: string;
}

function iconProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
}

/* --------------- Todo — checklist square --------------- */
export function TodoIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}

/* --------------- Water — droplet --------------- */
export function WaterIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </svg>
  );
}

/* --------------- Moon — crescent --------------- */
export function MoonIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

/* --------------- Music — note --------------- */
export function MusicIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/* --------------- Mood / Journal — heart pulse --------------- */
export function MoodIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/* --------------- Countdown — hourglass --------------- */
export function CountdownIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M6 2v4a6 6 0 006 6 6 6 0 016 6v4" />
      <path d="M18 2v4a6 6 0 01-6 6 6 6 0 00-6 6v4" />
      <line x1="2" y1="2" x2="22" y2="2" />
      <line x1="2" y1="22" x2="22" y2="22" />
    </svg>
  );
}

/* --------------- Clock — clock face --------------- */
export function ClockIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/* --------------- Add — circle with plus --------------- */
export function AddIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

/* --------------- Chat — bubble --------------- */
export function ChatIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

/* --------------- Memory — layered book / vault --------------- */
export function MemoryIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

/* --------------- Battery — for status bar --------------- */
export function BatteryIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <rect x="1" y="6" width="18" height="12" rx="2" />
      <line x1="23" y1="10" x2="23" y2="14" />
      <line x1="5" y1="10" x2="5" y2="14" />
      <line x1="9" y1="10" x2="9" y2="14" />
      <line x1="13" y1="10" x2="13" y2="14" />
    </svg>
  );
}

/* --------------- Edit — pencil --------------- */
export function EditIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M17 3a2.83 2.83 0 014 4L7.5 20.5 2 22l1.5-5.5z" />
      <line x1="15" y1="5" x2="19" y2="9" />
    </svg>
  );
}

/* --------------- Download --------------- */
export function DownloadIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/* --------------- Upload --------------- */
export function UploadIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* --------------- Globe / Language --------------- */
export function GlobeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

/* --------------- Mood Icons --------------- */

/* Blank — hollow circle */
export function HollowCircleIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

/* Joy — sparkle / star */
export function SparkleIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z" />
    </svg>
  );
}

/* Calm — moon + wave */
export function MoonWaveIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M19 11a5 5 0 01-5 5 7 7 0 01-7-7c0-1.5.5-3 1.5-4A5 5 0 0019 11z" />
      <path d="M4 18c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5" />
      <path d="M8 20c.5-1 1.5-1.5 3-1.5s2.5.5 3 1.5" />
    </svg>
  );
}

/* Tired — drooping / low energy */
export function DroopMoonIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M19 11a5 5 0 01-5 5 7 7 0 01-7-7c0-3 4-7 7-7 2 0 3 1 4 3" />
      <path d="M7 16c.5-2 3-4 5-4" />
    </svg>
  );
}

/* Anxious — ripple / alert */
export function RippleAlertIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M4.93 4.93l2.12 2.12" />
      <path d="M16.95 16.95l2.12 2.12" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
      <path d="M4.93 19.07l2.12-2.12" />
      <path d="M16.95 7.05l2.12-2.12" />
    </svg>
  );
}

/* --------------- Priority Icons --------------- */

/* Low — thin wave / gentle line */
export function LowPriorityIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M5 16c2-4 4-2 6-6s4-4 8 0" />
    </svg>
  );
}

/* Medium — double ring / moderate */
export function MediumPriorityIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M5 12c2-3 4 1 6-2s4-3 8 1" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

/* High — alert / rising lines */
export function HighPriorityIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <path d="M5 16c2-4 4-2 6-6s4-2 8 4" />
      <line x1="12" y1="4" x2="12" y2="2" />
      <line x1="15" y1="6" x2="16.5" y2="4.5" />
      <line x1="9" y1="6" x2="7.5" y2="4.5" />
    </svg>
  );
}

/* --------------- Check / tick --------------- */
export function CheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* --------------- DailyCache — broom / sweep --------------- */
export { DailyCacheIcon } from './DailyCacheIcon';

/* --------------- Trash --------------- */
export function TrashIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...iconProps(size, className)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
