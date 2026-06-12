import type { ConnectionStyle } from '@/types';

interface Props {
  variant: ConnectionStyle;
  size?: number;
}

export function ConnectionGlyph({ variant, size = 48 }: Props) {
  const strokeProps = {
    stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      style={{ flexShrink: 0, color: 'var(--coral)', opacity: 0.7 }}
      aria-hidden="true"
    >
      {/* Left anchor dot */}
      <circle cx="6" cy="24" r="2.5" fill="currentColor" opacity="0.6" />

      {/* Right anchor dot */}
      <circle cx="42" cy="24" r="2.5" fill="currentColor" opacity="0.6" />

      {variant === 'heartbeat' && (
        <polyline {...strokeProps}
          points="6,24 14,24 18,14 22,34 26,18 34,24 42,24"
        />
      )}

      {variant === 'wave' && (
        <path {...strokeProps}
          d="M6,24 Q12,16 18,24 Q24,32 30,24 Q36,16 42,24"
        />
      )}

      {variant === 'orbit' && (
        <>
          <ellipse cx="24" cy="24" rx="16" ry="7" {...strokeProps} opacity="0.5" />
          <ellipse cx="24" cy="24" rx="16" ry="7" {...strokeProps} opacity="0.3"
            transform="rotate(60,24,24)" />
        </>
      )}

      {variant === 'link' && (
        <>
          <line x1="8" y1="18" x2="20" y2="18" {...strokeProps} />
          <line x1="28" y1="30" x2="40" y2="30" {...strokeProps} />
          <path d="M20,18 Q24,24 20,30" {...strokeProps} />
          <path d="M28,30 Q24,24 28,18" {...strokeProps} />
        </>
      )}

      {variant === 'heart' && (
        <path {...strokeProps}
          d="M24,36 C12,28 8,16 18,10 C24,6 24,14 24,14 C24,14 24,6 30,10 C40,16 36,28 24,36Z"
          fill="currentColor" fillOpacity="0.12"
        />
      )}
    </svg>
  );
}
