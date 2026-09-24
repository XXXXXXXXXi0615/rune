export type RuneOrbEdge = 'left' | 'right';

export interface RuneOrbPosition {
  edge: RuneOrbEdge;
  normalizedY: number;
}

export interface Point { x: number; y: number }
export interface RectLike { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface RuneOrbPlacementBounds { left: number; top: number; right: number; bottom: number; width: number; height: number }

export const RUNE_ORB_DRAG_THRESHOLD_PX = 5;
export const DEFAULT_RUNE_ORB_POSITION: RuneOrbPosition = { edge: 'right', normalizedY: 0.62 };

export function clampNormalizedY(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : DEFAULT_RUNE_ORB_POSITION.normalizedY));
}

export function classifyRuneOrbGesture(start: Point, current: Point, threshold = RUNE_ORB_DRAG_THRESHOLD_PX): 'click' | 'drag' {
  return Math.hypot(current.x - start.x, current.y - start.y) >= threshold ? 'drag' : 'click';
}

export function snapRuneOrbEdge(centerX: number, viewportWidth: number): RuneOrbEdge {
  return centerX <= viewportWidth / 2 ? 'left' : 'right';
}

export function snapRuneOrbEdgeWithinBounds(centerX: number, bounds: Pick<RuneOrbPlacementBounds, 'left' | 'right'>): RuneOrbEdge {
  return centerX <= bounds.left + (bounds.right - bounds.left) / 2 ? 'left' : 'right';
}

export function normalizedYFromTop(top: number, viewportHeight: number, orbSize: number, margin: number): number {
  const range = Math.max(1, viewportHeight - orbSize - margin * 2);
  return clampNormalizedY((top - margin) / range);
}

export function topFromNormalizedY(normalizedY: number, viewportHeight: number, orbSize: number, margin: number): number {
  const range = Math.max(0, viewportHeight - orbSize - margin * 2);
  return margin + clampNormalizedY(normalizedY) * range;
}

export function clampRuneOrbPoint(point: Point, viewportWidth: number, viewportHeight: number, orbSize: number, margin: number): Point {
  return {
    x: Math.min(viewportWidth - orbSize - margin, Math.max(margin, point.x)),
    y: Math.min(viewportHeight - orbSize - margin, Math.max(margin, point.y)),
  };
}

export function clampRuneOrbPointToBounds(point: Point, bounds: RuneOrbPlacementBounds, orbSize: number, margin: number): Point {
  return {
    x: Math.min(bounds.right - orbSize - margin, Math.max(bounds.left + margin, point.x)),
    y: Math.min(bounds.bottom - orbSize - margin, Math.max(bounds.top + margin, point.y)),
  };
}

export function runeOrbRect(point: Point, size: number): RectLike {
  return { left: point.x, top: point.y, right: point.x + size, bottom: point.y + size, width: size, height: size };
}
