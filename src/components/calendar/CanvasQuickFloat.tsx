import { CalendarDayCanvas } from './CalendarDayCanvas';

/**
 * Calendar Phase C1 — Canvas Quick Float.
 *
 * Phase C2 — the only Canvas presentation. It renders the existing
 * `CalendarDayCanvas` in its `quick` variant, so selection, drag, delete,
 * keyboard nudge and persisted x/y all keep the frozen canvas document
 * semantics. The former full-screen workspace and its 「展開畫布」 entry are
 * retired; the canonical canvas data is untouched.
 */
export function CanvasQuickFloat({ dateKey, dateLabel, onClose }: {
  dateKey: string;
  dateLabel: string;
  onClose: () => void;
}) {
  return (
    <section
      className="calendar-canvas-quick-float"
      data-testid="canvas-quick-float"
      data-slot-date={dateKey}
      data-pet-safe-region="interactive"
      role="dialog"
      aria-modal="false"
      aria-label="當日畫布"
    >
      <header className="calendar-canvas-quick-header">
        <div className="calendar-canvas-quick-copy">
          <strong>當日畫布</strong>
          <small>{dateLabel}</small>
        </div>
        <div className="calendar-canvas-quick-header-actions">
          <button type="button" className="calendar-canvas-quick-close" aria-label="關閉畫布" onClick={onClose}>×</button>
        </div>
      </header>
      <div className="calendar-canvas-quick-body">
        <CalendarDayCanvas dateKey={dateKey} />
      </div>
    </section>
  );
}
