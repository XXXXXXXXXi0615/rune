/**
 * LUNARIS Animation Controller — centralized event-driven animation bridge.
 *
 * Manages temporary animation overrides when in auto mode.
 * Never overrides manual user selection.
 */
import { getLunarisAnimationAsset } from '@/data/lunarisAnimationManifest';
import {
  loadLunarisPetMode,
  saveLunarisPetMode,
  publishLunarisPetState,
  MODE_TO_STATE,
  LUNARIS_PET_MODE_KEY,
  LUNARIS_PET_MODE_EVENT,
  type LunarisPetMode,
  type LunarisPetState,
} from '@/config/lunarisPetStates';

export type LunarisAnimationEventSource =
  | 'journal'
  | 'chat'
  | 'music'
  | 'focus'
  | 'memory'
  | 'calendar'
  | 'system';

interface ActiveEvent {
  animationId: string;
  source: LunarisAnimationEventSource;
  mode: string;
  state: LunarisPetState;
  until: number;
  priority: number;
  restorePreviousMode: boolean;
}

interface ControllerState {
  activeEvent: ActiveEvent | null;
  previousMode: LunarisPetMode | null;
  timerId: ReturnType<typeof setTimeout> | null;
}

const state: ControllerState = { activeEvent: null, previousMode: null, timerId: null };

function isManualMode(): boolean {
  return loadLunarisPetMode() !== 'auto';
}

function clearTimer() {
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function restore() {
  clearTimer();
  if (!state.activeEvent) return;

  const { restorePreviousMode } = state.activeEvent;
  state.activeEvent = null;

  if (restorePreviousMode && state.previousMode) {
    saveLunarisPetMode(state.previousMode);
    const resolved = MODE_TO_STATE[state.previousMode as Exclude<LunarisPetMode, 'auto'>];
    if (resolved) publishLunarisPetState(resolved);
  } else {
    publishLunarisPetState('idle');
  }
}

/**
 * Trigger a temporary animation. Only works in auto mode.
 * Returns true if the animation was accepted.
 */
export function triggerLunarisAnimation(opts: {
  animationId: string;
  source: LunarisAnimationEventSource;
  durationMs?: number;
  priority?: number;
  restoreAfter?: boolean;
}): boolean {
  if (isManualMode()) return false;

  const asset = getLunarisAnimationAsset(opts.animationId);
  if (!asset) return false;

  const priority = opts.priority ?? 0;
  const restoreAfter = opts.restoreAfter ?? true;
  const durationMs = opts.durationMs ?? 3000;

  // Don't interrupt a higher-priority event
  if (state.activeEvent && state.activeEvent.priority > priority) return false;

  // Save previous mode for restoration
  const currentMode = loadLunarisPetMode();

  clearTimer();

  // If already in a temp event, don't double-save previous mode
  if (!state.activeEvent) {
    state.previousMode = currentMode;
  }

  // Resolve state from mode string
  const mode = asset.mode as Exclude<LunarisPetMode, 'auto'>;
  const resolvedState = MODE_TO_STATE[mode] || 'idle';

  state.activeEvent = {
    animationId: opts.animationId,
    source: opts.source,
    mode: asset.mode,
    state: resolvedState,
    until: Date.now() + durationMs,
    priority,
    restorePreviousMode: restoreAfter,
  };

  // Apply immediately
  saveLunarisPetMode(mode);
  publishLunarisPetState(resolvedState);

  // Schedule restore
  if (restoreAfter) {
    state.timerId = setTimeout(restore, durationMs);
  }

  return true;
}

/**
 * Clear any animation from a specific source. Restores previous mode if that source was active.
 */
export function clearLunarisAnimation(source?: LunarisAnimationEventSource) {
  if (!state.activeEvent) return;
  if (source && state.activeEvent.source !== source) return;
  restore();
}

/**
 * Force-restore to idle. Called on route changes to avoid stale animations.
 */
export function restoreLunarisIdle() {
  restore();
  publishLunarisPetState('idle');
}

/**
 * Get current event info (for debugging / UI).
 */
export function getCurrentAnimationEvent() {
  return state.activeEvent;
}

/**
 * Clean up on unmount / route change.
 */
export function disposeLunarisController() {
  clearTimer();
  state.activeEvent = null;
  state.previousMode = null;
}
