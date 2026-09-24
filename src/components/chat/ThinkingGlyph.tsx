export function ThinkingGlyph() {
  return (
    <svg className="thinking-glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle className="thinking-glyph-orbit" cx="24" cy="24" r="15" />
      <circle className="thinking-glyph-dot thinking-glyph-dot--a" cx="24" cy="9" r="3" />
      <circle className="thinking-glyph-dot thinking-glyph-dot--b" cx="37" cy="31" r="3" />
      <circle className="thinking-glyph-dot thinking-glyph-dot--c" cx="11" cy="31" r="3" />
      <path className="thinking-glyph-spark" d="M24 18l1.7 4.3L30 24l-4.3 1.7L24 30l-1.7-4.3L18 24l4.3-1.7L24 18Z" />
    </svg>
  );
}
