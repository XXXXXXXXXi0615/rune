import { describe, expect, it } from 'vitest';
import {
  HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX,
  resolveAutoScrollStep,
  resolveInsertionIndex,
  resolveRowOffsets,
  type HomeWidgetRowMetrics,
} from './homeEditDrag';

const rows: HomeWidgetRowMetrics[] = [
  { top: 0, bottom: 100, height: 100 },
  { top: 114, bottom: 214, height: 100 },
  { top: 228, bottom: 328, height: 100 },
  { top: 342, bottom: 642, height: 300 },
];

describe('Edit Home reorder geometry', () => {
  it('resolves the insertion position from row midpoints', () => {
    expect(resolveInsertionIndex(-20, rows, 3)).toBe(0);
    expect(resolveInsertionIndex(10, rows, 3)).toBe(0);
    expect(resolveInsertionIndex(60, rows, 3)).toBe(1);
    expect(resolveInsertionIndex(170, rows, 0)).toBe(1);
    expect(resolveInsertionIndex(280, rows, 0)).toBe(2);
    expect(resolveInsertionIndex(640, rows, 0)).toBe(3);
    expect(resolveInsertionIndex(9999, rows, 0)).toBe(3);
  });

  it('never lets the dragged row become its own neighbour', () => {
    expect(resolveInsertionIndex(50, rows, 0)).toBe(0);
    expect(resolveInsertionIndex(150, rows, 1)).toBe(1);
    expect(resolveInsertionIndex(400, rows, 2)).toBe(2);
  });

  it('handles a degenerate empty row list', () => {
    expect(resolveInsertionIndex(120, [], 0)).toBe(0);
  });

  it('shifts the rows between origin and target for the insertion preview', () => {
    expect(resolveRowOffsets(4, 0, 0, 114)).toEqual([0, 0, 0, 0]);
    expect(resolveRowOffsets(4, 0, 2, 114)).toEqual([0, -114, -114, 0]);
    expect(resolveRowOffsets(4, 3, 1, 314)).toEqual([0, 314, 314, 0]);
    expect(resolveRowOffsets(4, 2, 3, 114)).toEqual([0, 0, 0, -114]);
    expect(resolveRowOffsets(4, -1, 3, 114)).toEqual([0, 0, 0, 0]);
  });

  it('auto-scrolls gently and only near the scrollport edges', () => {
    expect(resolveAutoScrollStep(400, 0, 800)).toBe(0);
    expect(resolveAutoScrollStep(20, 0, 800)).toBeLessThan(0);
    expect(resolveAutoScrollStep(20, 0, 800)).toBeGreaterThanOrEqual(-HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX);
    expect(resolveAutoScrollStep(790, 0, 800)).toBeGreaterThan(0);
    expect(resolveAutoScrollStep(790, 0, 800)).toBeLessThanOrEqual(HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX);
    expect(resolveAutoScrollStep(-40, 0, 800)).toBe(-HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX);
    expect(resolveAutoScrollStep(900, 0, 800)).toBe(HOME_WIDGET_DRAG_MAX_SCROLL_STEP_PX);
    expect(resolveAutoScrollStep(400, 0, 120)).toBe(0);
  });
});
