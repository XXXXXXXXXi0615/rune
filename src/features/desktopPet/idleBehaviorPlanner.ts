import type { PetExpressionId } from '@/config/checkinPetAssets';

export type IdleAction = 'idle' | 'blink' | 'look-left' | 'look-right' | 'turn' | 'stretch' | 'sit' | 'walk-short';
export type PresentationLifecycle = 'once' | 'finite' | 'continuous';

export interface IdleActionDefinition {
  action: IdleAction;
  presentations: readonly PetExpressionId[];
  lifecycle: PresentationLifecycle;
  weight: number;
  dwellMs: readonly [number, number];
  cooldownMs: readonly [number, number];
  rare?: boolean;
}

export interface IdlePlannerState {
  currentAction: IdleAction;
  recentActions: IdleAction[];
  cooldownUntil: Partial<Record<IdleAction, number>>;
  cycle: number;
}

export interface IdlePlan {
  action: IdleAction;
  presentation: PetExpressionId;
  lifecycle: PresentationLifecycle;
  dwellMs: number;
  state: IdlePlannerState;
}

// Only real files from public/assets/checkin-pet are referenced here. Actions with
// no honest visual equivalent stay supported by the planner type but unavailable.
export const IDLE_ACTION_DEFINITIONS: readonly IdleActionDefinition[] = [
  { action: 'idle', presentations: ['idle'], lifecycle: 'continuous', weight: 52, dwellMs: [8_000, 18_000], cooldownMs: [0, 0] },
  { action: 'blink', presentations: [], lifecycle: 'once', weight: 18, dwellMs: [900, 1_400], cooldownMs: [8_000, 20_000] },
  { action: 'look-left', presentations: ['look-left'], lifecycle: 'finite', weight: 10, dwellMs: [1_600, 3_100], cooldownMs: [12_000, 30_000] },
  { action: 'look-right', presentations: ['look-right'], lifecycle: 'finite', weight: 10, dwellMs: [1_600, 3_100], cooldownMs: [12_000, 30_000] },
  { action: 'turn', presentations: [], lifecycle: 'once', weight: 4, dwellMs: [1_000, 2_000], cooldownMs: [20_000, 45_000] },
  { action: 'stretch', presentations: [], lifecycle: 'once', weight: 2, dwellMs: [1_500, 3_000], cooldownMs: [45_000, 120_000], rare: true },
  { action: 'sit', presentations: ['waiting'], lifecycle: 'finite', weight: 2, dwellMs: [4_000, 8_000], cooldownMs: [40_000, 120_000], rare: true },
  { action: 'walk-short', presentations: ['running-left', 'running-right'], lifecycle: 'finite', weight: 2, dwellMs: [1_800, 3_800], cooldownMs: [30_000, 90_000], rare: true },
] as const;

export const INITIAL_IDLE_PLANNER_STATE: IdlePlannerState = {
  currentAction: 'idle', recentActions: [], cooldownUntil: {}, cycle: 0,
};

function deterministicUnit(seed: number) {
  let value = (seed + 0x6d2b79f5) | 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

function jitter(range: readonly [number, number], seed: number) {
  return Math.round(range[0] + (range[1] - range[0]) * deterministicUnit(seed));
}

function weightedPick(candidates: readonly IdleActionDefinition[], unit: number) {
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  let cursor = unit * total;
  return candidates.find((item) => (cursor -= item.weight) <= 0) ?? candidates[candidates.length - 1];
}

export function planNextIdleAction(state: IdlePlannerState, now: number): IdlePlan {
  const available = IDLE_ACTION_DEFINITIONS.filter((item) => item.presentations.length > 0 && item.action !== state.currentAction && (state.cooldownUntil[item.action] ?? 0) <= now);
  const outsideRecent = available.filter((item) => !state.recentActions.slice(0, 2).includes(item.action));
  const candidates = outsideRecent.length > 0 ? outsideRecent : available;
  const fallback = IDLE_ACTION_DEFINITIONS.find((item) => item.action === 'idle')!;
  const selected = candidates.length > 0 ? weightedPick(candidates, deterministicUnit(state.cycle * 11 + 1)) : fallback;
  const presentationIndex = Math.floor(deterministicUnit(state.cycle * 11 + 2) * selected.presentations.length);
  const presentation = selected.presentations[presentationIndex] ?? 'idle';
  const dwellMs = jitter(selected.dwellMs, state.cycle * 11 + 3);
  const cooldownMs = jitter(selected.cooldownMs, state.cycle * 11 + 4);
  const nextState: IdlePlannerState = {
    currentAction: selected.action,
    recentActions: [selected.action, ...state.recentActions.filter((action) => action !== selected.action)].slice(0, 3),
    cooldownUntil: { ...state.cooldownUntil, [selected.action]: now + cooldownMs },
    cycle: state.cycle + 1,
  };
  return { action: selected.action, presentation, lifecycle: selected.lifecycle, dwellMs, state: nextState };
}
