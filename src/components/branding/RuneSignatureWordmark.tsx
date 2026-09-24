interface RuneSignatureWordmarkProps {
  className?: string;
  title?: string;
  decorative?: boolean;
}

/** Airy, single-line Rune signature drawn specifically for the top status island. */
export function RuneSignatureWordmark({ className, title = 'Rune', decorative = false }: RuneSignatureWordmarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 156 54"
      fill="none"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {!decorative && <title>{title}</title>}
      <g
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M10 18C23 7 41 6 53 10C63 13 63 22 54 27C47 31 38 32 29 31M42 11C37 22 32 34 27 45M39 29C48 29 53 35 59 43" />
        <path d="M64 28C62 34 60 41 64 43C70 46 78 36 81 28M80 28C77 36 77 42 82 43C87 44 91 38 94 34" />
        <path d="M95 28C93 33 91 38 90 43M93 35C99 27 107 24 110 29C113 34 106 40 109 43C112 46 118 42 121 38" />
        <path d="M122 35C132 34 138 30 136 27C133 23 124 28 122 36C120 44 128 47 137 42" />
        <path d="M18 47C54 49 100 48 143 43C148 42 151 40 153 37" opacity=".72" />
      </g>
    </svg>
  );
}
