import type { CSSProperties } from 'react';

export interface DailyCacheIconProps {
  size?: number;
  className?: string;
  title?: string;
  hasNotice?: boolean;
  style?: CSSProperties;
}

export function DailyCacheIcon({
  size = 24,
  className,
  title = '每日緩存',
  hasNotice = false,
  style,
}: DailyCacheIconProps) {
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        color: 'currentColor',
        ...style,
      }}
      aria-label={title}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.8 3.9a7.1 7.1 0 1 0 4.1 12.7 6.2 6.2 0 0 1-4.1-12.7Z" />
        <circle cx="18.3" cy="7.2" r="0.8" fill="currentColor" stroke="none" />
        <circle
          cx="17.1"
          cy="10.3"
          r="0.55"
          fill="currentColor"
          stroke="none"
          opacity={0.72}
        />
        <path d="M5.1 16.3h13.8" />
        <path d="M6 16.3l.85 3.05h10.3L18 16.3" />
      </svg>

      {hasNotice && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -1,
            right: -1,
            width: 6,
            height: 6,
            borderRadius: '999px',
            background: 'var(--cache-notice, #e8a55a)',
            boxShadow: '0 0 0 2px var(--cache-notice-ring, rgba(255,255,255,.88))',
          }}
        />
      )}
    </span>
  );
}
