/**
 * Phase 2B — Edit Home vertical reorder geometry.
 *
 * Pure functions only: the component measures rows once at drag start and
 * these helpers decide the insertion position, the preview offsets and the
 * bounded auto-scroll step. No arbitrary coordinates are ever persisted —
 * the layout stays an ordered list.
 */

export interface HomeWidgetRowMetrics {
  top: number;
  bottom: number;
  height: number;
}

export const HOME_WIDGET_DRAG_EDGE_PX = 72;
export const HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX = 9;

/**
 * Final position of the dragged row, counted against the midpoints of the rows
 * that are not being dragged.
 */
export function resolveInsertionIndex(
  pointerY: number,
  rows: HomeWidgetRowMetrics[],
  fromIndex: number,
): number {
  if (rows.length === 0) return 0;
  let index = 0;
  rows.forEach((row, rowIndex) => {
    if (rowIndex === fromIndex) return;
    if (pointerY > row.top + row.height / 2) index += 1;
  });
  return Math.max(0, Math.min(index, rows.length - 1));
}

/** translateY per row while dragging: rows between origin and target make room. */
export function resolveRowOffsets(
  count: number,
  fromIndex: number,
  targetIndex: number,
  shift: number,
): number[] {
  const offsets = new Array<number>(count).fill(0);
  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return offsets;
  if (targetIndex > fromIndex) {
    for (let index = fromIndex + 1; index <= targetIndex; index += 1) offsets[index] = -shift;
  } else {
    for (let index = targetIndex; index < fromIndex; index += 1) offsets[index] = shift;
  }
  return offsets;
}

/**
 * Gentle, bounded auto-scroll while a finger holds near the scrollport edge.
 * The Home scroll owner (`.app-main`) applies the step; nothing else scrolls.
 */
export function resolveAutoScrollStep(
  pointerY: number,
  viewportTop: number,
  viewportBottom: number,
  edge = HOME_WIDGET_DRAG_EDGE_PX,
  maxStep = HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX,
): number {
  if (viewportBottom - viewportTop <= edge * 2) return 0;
  const topZone = viewportTop + edge;
  const bottomZone = viewportBottom - edge;
  if (pointerY < topZone) {
    const ratio = Math.min(1, Math.max(0, (topZone - pointerY) / edge));
    return -Math.round(ratio * maxStep);
  }
  if (pointerY > bottomZone) {
    const ratio = Math.min(1, Math.max(0, (pointerY - bottomZone) / edge));
    return Math.round(ratio * maxStep);
  }
  return 0;
}
