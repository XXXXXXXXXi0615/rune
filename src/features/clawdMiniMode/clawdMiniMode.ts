export const MINI_EDGE_SNAP_TOLERANCE = 30;
export const MINI_OFFSET_RATIO = 0.486;
export const MINI_PEEK_PX = 25;
export const MINI_HIT_TARGET_PX = 44;
export const MINI_HOVER_DURATION_MS = 200;
export const MINI_JUMP_DURATION_MS = 350;

export type ClawdPresentationMode = 'free' | 'mini-left' | 'mini-right';
export type MiniSide = 'left' | 'right';
export interface MiniViewport { width: number; height: number; bottomSafe: number; leftInset?: number; rightInset?: number }
export interface MiniGeometry { left: number; top: number; visiblePx: number; hitWidth: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolveEdgeSnap(anchorX: number, viewportWidth: number): ClawdPresentationMode {
  if (anchorX <= MINI_EDGE_SNAP_TOLERANCE) return 'mini-left';
  if (anchorX >= viewportWidth - MINI_EDGE_SNAP_TOLERANCE) return 'mini-right';
  return 'free';
}

export const sideFromMode = (mode: ClawdPresentationMode): MiniSide | null => mode === 'mini-left' ? 'left' : mode === 'mini-right' ? 'right' : null;

export function normalizeMiniOffset(top: number, viewport: MiniViewport, petSize: number) {
  const maxY = Math.max(0, viewport.height - viewport.bottomSafe - petSize);
  return maxY ? clamp(top / maxY, 0, 1) : MINI_OFFSET_RATIO;
}

export function calculateMiniGeometry(mode: Exclude<ClawdPresentationMode, 'free'>, normalizedOffset: number, viewport: MiniViewport, petSize: number, expanded = false): MiniGeometry {
  const maxY = Math.max(0, viewport.height - viewport.bottomSafe - petSize);
  const top = clamp(Number.isFinite(normalizedOffset) ? normalizedOffset : MINI_OFFSET_RATIO, 0, 1) * maxY;
  const side = sideFromMode(mode)!;
  const leftEdge = viewport.leftInset ?? 0; const rightEdge = viewport.width - (viewport.rightInset ?? 0);
  const left = expanded ? (side === 'left' ? leftEdge : rightEdge - petSize) : (side === 'left' ? leftEdge + MINI_PEEK_PX - petSize : rightEdge - MINI_PEEK_PX);
  return { left, top, visiblePx: expanded ? petSize : MINI_PEEK_PX, hitWidth: Math.max(MINI_HIT_TARGET_PX, MINI_PEEK_PX) };
}

export function resolveMiniEdgeInsets(regions: Array<{ left: number; right: number; top: number; bottom: number }>, width: number, height: number) {
  const blockers = regions.filter((region) => region.bottom - region.top >= height * .7);
  const leftInset = blockers.filter((region) => region.left <= 1).reduce((value, region) => Math.max(value, region.right), 0);
  const rightInset = blockers.filter((region) => region.right >= width - 1).reduce((value, region) => Math.max(value, width - region.left), 0);
  return { leftInset: clamp(leftInset, 0, width / 2), rightInset: clamp(rightInset, 0, width / 2) };
}

export function restoreMiniMode(mode: unknown, offset: unknown): { mode: ClawdPresentationMode; offset: number } {
  const legalMode: ClawdPresentationMode = mode === 'mini-left' || mode === 'mini-right' ? mode : 'free';
  const legalOffset = typeof offset === 'number' && Number.isFinite(offset) ? clamp(offset, 0, 1) : MINI_OFFSET_RATIO;
  return { mode: legalMode, offset: legalOffset };
}

export function resolveModeAfterDrag(anchorX: number, viewportWidth: number) {
  return resolveEdgeSnap(anchorX, viewportWidth);
}
