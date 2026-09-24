import { PET_SAFE_GAP_PX, intersectsReservedRegion, resolveNearestSafeDelta, type PetRect } from '@/features/desktopPet/PetSafeRegionResolver';

export const CLAWD_LANDING_MS = 150;

export type ClawdPositionOwner = 'drag' | 'auto';

export interface ClawdDragOwnershipState {
  gestureActive: boolean;
  gestureDragging: boolean;
  landing: boolean;
  needsGeometryRefresh: boolean;
}

export const INITIAL_DRAG_OWNERSHIP: ClawdDragOwnershipState = Object.freeze({
  gestureActive: false,
  gestureDragging: false,
  landing: false,
  needsGeometryRefresh: false,
});

export function beginDragGesture(): ClawdDragOwnershipState {
  return { gestureActive: true, gestureDragging: false, landing: false, needsGeometryRefresh: false };
}

export function promoteGestureToDrag(state: ClawdDragOwnershipState): ClawdDragOwnershipState {
  return state.gestureDragging ? state : { ...state, gestureDragging: true };
}

export function dragOwnsPosition(state: ClawdDragOwnershipState): boolean {
  return state.gestureActive || state.landing;
}

export function currentPositionOwner(state: ClawdDragOwnershipState): ClawdPositionOwner {
  return dragOwnsPosition(state) ? 'drag' : 'auto';
}

/** Automatic systems ask before writing position. During drag ownership the write is denied and deferred. */
export function requestAutoPositionWrite(state: ClawdDragOwnershipState): { allowed: boolean; state: ClawdDragOwnershipState } {
  if (!dragOwnsPosition(state)) return { allowed: true, state };
  return { allowed: false, state: { ...state, needsGeometryRefresh: true } };
}

export function beginLanding(state: ClawdDragOwnershipState): ClawdDragOwnershipState {
  return { gestureActive: false, gestureDragging: false, landing: true, needsGeometryRefresh: state.needsGeometryRefresh };
}

export function completeLanding(state: ClawdDragOwnershipState): { state: ClawdDragOwnershipState; runDeferredRefresh: boolean } {
  return {
    state: { gestureActive: false, gestureDragging: false, landing: false, needsGeometryRefresh: false },
    runDeferredRefresh: state.needsGeometryRefresh,
  };
}

export function cancelDragGesture(): ClawdDragOwnershipState {
  return { ...INITIAL_DRAG_OWNERSHIP };
}

export interface ClawdGestureSuppression {
  suppressClick: boolean;
  suppressClickAggregation: boolean;
  suppressLongPress: boolean;
  suppressPalette: boolean;
  suppressTapAction: boolean;
}

const NO_SUPPRESSION: ClawdGestureSuppression = Object.freeze({
  suppressClick: false,
  suppressClickAggregation: false,
  suppressLongPress: false,
  suppressPalette: false,
  suppressTapAction: false,
});

const FULL_SUPPRESSION: ClawdGestureSuppression = Object.freeze({
  suppressClick: true,
  suppressClickAggregation: true,
  suppressLongPress: true,
  suppressPalette: true,
  suppressTapAction: true,
});

/** Once the gesture promoted to dragging, every tap-derived action stays suppressed until pointerup/cancel. */
export function resolveGestureSuppression(gestureDragging: boolean): ClawdGestureSuppression {
  return gestureDragging ? FULL_SUPPRESSION : NO_SUPPRESSION;
}

export interface FinalDropInput {
  dropLeft: number;
  dropTop: number;
  petSize: number;
  maxX: number;
  maxY: number;
  viewportWidth: number;
  viewportHeight: number;
  reserved: PetRect[];
  gap?: number;
}

export interface FinalDropResult {
  left: number;
  top: number;
  normalizedX: number;
  normalizedY: number;
  relocatedBySafeRegion: boolean;
  resolutionPasses: number;
}

const clampToBounds = (value: number, max: number) => Math.min(Math.max(0, max), Math.max(0, value));

/**
 * Deterministic final-drop pipeline:
 * raw pointer drop → viewport clamp → safe-region resolution (exactly once) → canonical final position.
 * The same gap as the idle-time safe-region resolver is used so the committed point
 * is already legal for later automatic checks (no second relocation, no bounce chain).
 */
export function resolveFinalDrop(input: FinalDropInput): FinalDropResult {
  const gap = input.gap ?? PET_SAFE_GAP_PX;
  const maxX = Math.max(0, input.maxX);
  const maxY = Math.max(0, input.maxY);
  let left = clampToBounds(input.dropLeft, maxX);
  let top = clampToBounds(input.dropTop, maxY);
  const petRect: PetRect = { left, top, right: left + input.petSize, bottom: top + input.petSize, width: input.petSize, height: input.petSize };
  let relocated = false;
  if (intersectsReservedRegion(petRect, input.reserved, gap)) {
    const delta = resolveNearestSafeDelta(petRect, input.viewportWidth, input.viewportHeight, input.reserved, gap);
    left = clampToBounds(left + delta.dx, maxX);
    top = clampToBounds(top + delta.dy, maxY);
    relocated = true;
  }
  return {
    left,
    top,
    normalizedX: maxX > 0 ? left / maxX : 0,
    normalizedY: maxY > 0 ? top / maxY : 0,
    relocatedBySafeRegion: relocated,
    resolutionPasses: 1,
  };
}

export interface FreeHostPositionInput {
  x: number;
  y: number;
  scale: number;
}

/**
 * Canonical host placement vars for free mode. Deliberately independent of asset
 * normalization (footAnchor / visibleBounds / scale): the host bounding box must stay
 * stable across idle/jump/reaction/working/sleeping visual states. Normalization is
 * applied to the inner image only.
 */
export function resolveFreeHostPositionVars(input: FreeHostPositionInput): Record<string, string> {
  return {
    '--companion-x': `${input.x * 100}%`,
    '--companion-y': `${input.y * 100}%`,
    '--companion-shift-x': `${-input.x * 100}%`,
    '--companion-shift-y': `${-input.y * 100}%`,
    '--companion-scale': `${input.scale}`,
  };
}
