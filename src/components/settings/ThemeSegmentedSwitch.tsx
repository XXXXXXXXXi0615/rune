import { type KeyboardEvent } from 'react';

interface ThemeSegmentedSwitchProps {
  value: 'dark' | 'light';
  onChange: (value: 'dark' | 'light') => void;
}

export function ThemeSegmentedSwitch({ value, onChange }: ThemeSegmentedSwitchProps) {
  const isLeft = value === 'dark';

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange('dark');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange('light');
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(value === 'dark' ? 'light' : 'dark');
    }
  };

  return (
    <div
      className="tss-track"
      role="radiogroup"
      aria-label="切換外觀模式"
      onKeyDown={handleKey}
    >
      {/* Sliding capsule behind the segments */}
      <div className={`tss-capsule ${isLeft ? 'tss-capsule--left' : 'tss-capsule--right'}`} />

      {/* DARK segment */}
      <button
        type="button"
        className={`tss-segment ${isLeft ? 'tss-segment--active' : ''}`}
        onClick={() => onChange('dark')}
        role="radio"
        aria-checked={isLeft}
        tabIndex={isLeft ? 0 : -1}
      >
        <svg
          width={14} height={14} viewBox="0 0 24 24"
          fill={isLeft ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
        <span>DARK</span>
      </button>

      {/* LIGHT segment */}
      <button
        type="button"
        className={`tss-segment ${!isLeft ? 'tss-segment--active' : ''}`}
        onClick={() => onChange('light')}
        role="radio"
        aria-checked={!isLeft}
        tabIndex={!isLeft ? 0 : -1}
      >
        <svg
          width={14} height={14} viewBox="0 0 24 24"
          fill={!isLeft ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span>LIGHT</span>
      </button>
    </div>
  );
}
