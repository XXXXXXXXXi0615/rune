export type MemoryMoodIconName = 'all' | 'joy' | 'anger' | 'sadness' | 'fatigue' | 'music' | 'neutral';

interface MoodIconProps {
  mood: MemoryMoodIconName;
  size?: number;
  className?: string;
}

export function MoodIcon({ mood, size = 18, className }: MoodIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {mood === 'all' && (
        <>
          <path d="M4 7h10" />
          <path d="M4 17h16" />
          <path d="M18 7h2" />
          <circle cx="15.5" cy="7" r="2.5" />
          <circle cx="8.5" cy="17" r="2.5" />
        </>
      )}
      {mood === 'joy' && (
        <>
          <path d="M12 3l1.4 5.1L18.5 9.5l-5.1 1.4L12 16l-1.4-5.1-5.1-1.4 5.1-1.4L12 3Z" />
          <path d="M18.5 15.5 19 18l2.5.5L19 19l-.5 2.5L18 19l-2.5-.5L18 18l.5-2.5Z" />
        </>
      )}
      {mood === 'anger' && (
        <>
          <path d="m13.5 2-7 11h5l-1 9 7-12h-5l1-8Z" />
          <path d="M4 5.5 6 7" />
          <path d="m18.5 17 2 1.5" />
        </>
      )}
      {mood === 'sadness' && (
        <>
          <path d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />
          <path d="M9.5 16.5c1.7-1.3 3.3-1.3 5 0" />
        </>
      )}
      {mood === 'fatigue' && (
        <>
          <path d="M19.5 14.5A8 8 0 0 1 9.5 4a8.3 8.3 0 1 0 10 10.5Z" />
          <path d="M15.5 5h4l-4 4h4" />
        </>
      )}
      {mood === 'music' && (
        <>
          <path d="M9 18V6l11-2v12" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </>
      )}
      {mood === 'neutral' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 12h7" />
        </>
      )}
    </svg>
  );
}
