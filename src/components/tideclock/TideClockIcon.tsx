interface TideClockIconProps {
  size?: number;
  className?: string;
}

export function TideClockIcon({ size = 24, className }: TideClockIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="7" r="5" stroke="var(--amber, #d4a053)" strokeWidth="1.6" />
      <path d="M12 4.5v2.5l1.5 1" stroke="var(--amber, #d4a053)" strokeWidth="1.4" />
      <rect x="6" y="13" width="12" height="8" rx="1.5" stroke="var(--teal, #6bb5a0)" strokeWidth="1.6" />
      <path d="M9 13V11.5" stroke="var(--teal, #6bb5a0)" strokeWidth="1.4" />
      <path d="M15 13V11.5" stroke="var(--teal, #6bb5a0)" strokeWidth="1.4" />
      <line x1="9" y1="16.5" x2="15" y2="16.5" stroke="var(--teal, #6bb5a0)" strokeWidth="1.2" opacity="0.6" />
      <line x1="9" y1="18.5" x2="13" y2="18.5" stroke="var(--teal, #6bb5a0)" strokeWidth="1.2" opacity="0.4" />
      <rect x="10" y="21" width="4" height="1.5" rx="0.5" stroke="var(--amber, #d4a053)" strokeWidth="1" opacity="0.7" />
    </svg>
  );
}
