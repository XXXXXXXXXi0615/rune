export const CLAWD_DRAG_THRESHOLD_PX = 6;
export const CLAWD_CLICK_WINDOW_MS = 400;
export const CLAWD_LONG_PRESS_MS = 320;
export const CLAWD_DRAG_DIRECTION_THRESHOLD_PX = 6;
export const CLAWD_DRAG_DIRECTION_RELEASE_PX = 2;

export type ClawdReaction = 'tap' | 'poke' | 'annoyed' | 'flail';
export type ClawdDragDirection = 'neutral' | 'left' | 'right';
export type ClawdInteractionState =
  | { kind: 'none' }
  | { kind: 'pressing'; startedAt: number }
  | { kind: 'held'; startedAt: number }
  | { kind: 'dragging'; startedAt: number; direction: ClawdDragDirection }
  | { kind: 'landing'; startedAt: number }
  | { kind: 'reaction'; reaction: ClawdReaction; startedAt: number };

export interface PointerSequence { pointerId: number; startedAt: number; startX: number; startY: number; lastX: number; held: boolean; dragging: boolean; direction: ClawdDragDirection }

export function classifyPointerMove(sequence: PointerSequence, x: number, y: number) {
  return sequence.dragging || Math.hypot(x - sequence.startX, y - sequence.startY) > CLAWD_DRAG_THRESHOLD_PX ? 'dragging' : sequence.held ? 'held' : 'pressing';
}

export function resolveDragDirection(previous: ClawdDragDirection, deltaX: number): ClawdDragDirection {
  if (deltaX > CLAWD_DRAG_DIRECTION_THRESHOLD_PX) return 'right';
  if (deltaX < -CLAWD_DRAG_DIRECTION_THRESHOLD_PX) return 'left';
  if (Math.abs(deltaX) <= CLAWD_DRAG_DIRECTION_RELEASE_PX) return 'neutral';
  return previous;
}

export function resolveClickReaction(count: number, annoyedRoll = 1): ClawdReaction {
  if (count >= 4) return 'flail';
  if (count >= 2) return annoyedRoll < .5 ? 'annoyed' : 'poke';
  return 'tap';
}

export function reactionDuration(reaction: ClawdReaction, reducedMotion: boolean) {
  if (reducedMotion) return 180;
  return reaction === 'tap' ? 700 : reaction === 'poke' ? 2_500 : 3_500;
}
