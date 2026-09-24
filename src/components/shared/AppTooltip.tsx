/** Minimal shared delayed tooltip presentation (no native title).
 *  Visibility delay is managed by the caller (default 300ms). */
export function AppTooltip({ open, lines, testId }: { open: boolean; lines: string[]; testId?: string }) {
  if (!open) return null;
  return (
    <span className="app-tooltip" role="tooltip" data-testid={testId}>
      {lines.map((line, index) => <span key={index} className={index === 0 ? 'app-tooltip__primary' : 'app-tooltip__secondary'}>{line}</span>)}
    </span>
  );
}
