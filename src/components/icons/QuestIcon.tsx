interface QuestIconProps {
  size?: number;
  className?: string;
}

export function QuestIcon({ size = 24, className }: QuestIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 4.5a5.5 5.5 0 1 0 0 11 4.5 4.5 0 1 1 0-11Z" />
      <line x1="3" y1="10" x2="12" y2="10" />
      <line x1="3" y1="14" x2="11" y2="14" />
    </svg>
  );
}
