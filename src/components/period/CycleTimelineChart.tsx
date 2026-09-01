/**
 * CycleTimelineChart — now a thin wrapper around the shared CycleTrendStrip.
 *
 * The previous standalone chart (660px fixed SVG, its own phase color map,
 * its own tooltip, English "Mood/Tide" labels) has been removed so the home
 * card and /period page share one trend implementation. The full variant keeps
 * tooltip, hover, tap, and keyboard interaction via the shared component.
 */
import type { CycleSnapshot } from '@/features/period/getCycleSnapshot';
import { CycleTrendStrip } from '@/components/period/CycleTrendStrip';

export function CycleTimelineChart({ snapshot }: { snapshot: CycleSnapshot }) {
  return <CycleTrendStrip snapshot={snapshot} variant="full" interactive showLegend />;
}
