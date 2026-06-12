interface Props {
  size?: number;
  variant?: 'dots' | 'burst';
}

export function ThinkingSpinner({ size = 20, variant = 'dots' }: Props) {
  const dots = Array.from({ length: 12 });

  return (
    <span
      className={`thinking-spinner thinking-spinner--${variant}`}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {dots.map((_, index) => (
        <span
          key={index}
          className="thinking-spinner-dot"
          style={{
            transform: `rotate(${index * 30}deg) translateY(calc(${size / -2}px + 2px))`,
            animationDelay: `${index * -0.09}s`,
          }}
        />
      ))}
    </span>
  );
}
