interface RuneWordmarkProps { className?: string; title?: string; }

/** Original Rune wordmark artwork, drawn for this project as SVG paths. */
export function RuneWordmark({ className, title = 'Rune' }: RuneWordmarkProps) {
  return (
    <svg className={className} viewBox="0 0 150 58" fill="none" role="img" aria-label={title} focusable="false">
      <title>{title}</title>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="4.6" d="M35 48C41 33 47 17 50 6M49 7C73-1 77 10 69 19c-5 6-15 9-25 9m17-2c9 3 13 11 18 20" />
        <path strokeWidth="3.5" d="M83 24c-2 8-6 20 0 22 7 2 13-10 16-22m-2 8c-2 9-1 14 5 14 4 0 7-3 9-6" />
        <path strokeWidth="3.5" d="M111 24c-2 7-4 15-5 22m3-12c5-9 14-14 17-8 2 4-3 14-1 18 2 4 8 1 11-3" />
        <path strokeWidth="3.5" d="M138 34c10-1 13-5 10-8-4-4-12 2-13 10-1 8 6 12 14 6" />
        <path strokeWidth="1.35" opacity=".72" d="M12 17C24 5 39 3 52 7M16 17c9-6 20-8 30-7M27 52c28 2 64 1 111-5M127 51c10 2 17 0 21-5" />
      </g>
    </svg>
  );
}
