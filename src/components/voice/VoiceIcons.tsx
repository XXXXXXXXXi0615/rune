type IconProps = {
  size?: number;
  className?: string;
};

const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </svg>
  );
}

export function PauseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className} fill="currentColor" stroke="none">
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  );
}

export function MicIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function UploadIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function SendIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="m4 12 16-8-5 16-3.5-6.5L4 12Z" />
      <path d="m11.5 13.5 3.5-3.5" />
    </svg>
  );
}

export function PlusIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ChevronIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="m8 10 4 4 4-4" />
    </svg>
  );
}

export function MoonIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M18.5 15.5A7.6 7.6 0 0 1 8.5 5.5 7.8 7.8 0 1 0 18.5 15.5Z" />
    </svg>
  );
}

export function UserVoiceIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M4 13c1.5-3 4-4.5 8-4.5S18.5 10 20 13" />
      <path d="M7 16c1.1 1.5 2.8 2.5 5 2.5s3.9-1 5-2.5" />
      <path d="M9 12h.01M15 12h.01" />
    </svg>
  );
}

export function MemoryIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M7 6.5h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
      <path d="M9 6.5V4h6v2.5" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15h4" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 9A7 7 0 0 1 18 6.7L20 12" />
      <path d="M17.9 15A7 7 0 0 1 6 17.3L4 12" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6.5 7l.8 13h9.4l.8-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function ImageIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m7 17 4.2-4.2a1.4 1.4 0 0 1 2 0L18 17" />
    </svg>
  );
}

export function ImageOffIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...svg(size)} className={className}>
      <path d="M4 4l16 16" />
      <path d="M6.6 5H18a2 2 0 0 1 2 2v10.4" />
      <path d="M17.4 19H6a2 2 0 0 1-2-2V7c0-.8.5-1.5 1.2-1.8" />
      <path d="m8 16 2.8-2.8" />
      <path d="M14 14.2 16.8 17" />
    </svg>
  );
}
