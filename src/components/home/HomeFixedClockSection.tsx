import { MoonGlassClock } from '@/components/home/MoonGlassClock';

/**
 * Fixed home clock zone — the clock is the fixed home hero visual.
 *
 * - Lives OUTSIDE HomeWidgetGrid: no CSS Grid packing, no drag & drop,
 *   no edit-mode controls (drag handle / hide / size selector).
 * - The Hero position is canonical and fixed. HomeClockStore controls only
 *   display appearance; it cannot offset or drag this anchor.
 */
export function HomeFixedClockSection() {
  return (
    <section
      className="home-fixed-clock-section has-flow-day-clock"
      data-home-fixed-clock
      aria-label="首頁時鐘"
    >
      <MoonGlassClock />
    </section>
  );
}
