import { useId } from 'react';

interface LunarisJournalMarkProps {
  size?: number;
  state?: 'idle' | 'generating' | 'complete';
  className?: string;
}

export function LunarisJournalMark({ size = 36, state = 'idle', className = '' }: LunarisJournalMarkProps) {
  const symbolId = `lunaris-journal-mark-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={`lunaris-journal-mark is-${state} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="月潮手記"
    >
      <defs>
        <symbol id={symbolId} viewBox="0 0 48 48">
          <path d="M31.8 8.2A17 17 0 1 0 38 35.4 14 14 0 0 1 31.8 8.2Z" fill="currentColor" opacity=".9" />
          <path d="M7 34.5c6-3.5 10.5-3.5 16.5 0s10.5 3.5 17.5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 40c4.5-2.3 8-2.3 12.5 0s8 2.3 13.5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
          <circle cx="39" cy="10" r="2" fill="currentColor" />
          <circle cx="42" cy="17" r="1.15" fill="currentColor" opacity=".65" />
        </symbol>
      </defs>
      <use href={`#${symbolId}`} />
    </svg>
  );
}
