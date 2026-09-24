export type FocusReportIconType = 'complete' | 'partial' | 'barely' | 'faking';

const iconProps = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function FocusReportIcon({ type }: { type: FocusReportIconType }) {
  if (type === 'complete') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 12.2l2.2 2.2 4.8-5" />
      </svg>
    );
  }

  if (type === 'partial') {
    return (
      <svg {...iconProps}>
        <rect x="6" y="4.5" width="12" height="15" rx="2.2" />
        <path d="M9.5 8.5h5" />
        <path d="M9.5 12h3.8" />
        <path d="M9.5 15.5h6" />
      </svg>
    );
  }

  if (type === 'barely') {
    return (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 12h7" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M4.8 10.2c1.3-2.1 3.8-3.2 7.2-3.2s5.9 1.1 7.2 3.2" />
      <path d="M5.4 10.4c.2 4.1 2.4 6.5 6.6 6.5s6.4-2.4 6.6-6.5" />
      <path d="M8.2 11.3c1.1-.7 2.2-.7 3.4 0" />
      <path d="M12.4 11.3c1.2-.7 2.3-.7 3.4 0" />
      <path d="M10 14.3c1.3.8 2.7.8 4 0" />
    </svg>
  );
}
