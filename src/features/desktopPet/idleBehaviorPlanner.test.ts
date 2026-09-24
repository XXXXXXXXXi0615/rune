import { describe, expect, it } from 'vitest';
import { IDLE_ACTION_DEFINITIONS, INITIAL_IDLE_PLANNER_STATE, planNextIdleAction } from './idleBehaviorPlanner';

describe('idle behavior planner', () => {
  it('declares the full behavior vocabulary without inventing presentation ids', () => {
    expect(IDLE_ACTION_DEFINITIONS.map((item) => item.action)).toEqual([
      'idle', 'blink', 'look-left', 'look-right', 'turn', 'stretch', 'sit', 'walk-short',
    ]);
    expect(IDLE_ACTION_DEFINITIONS.find((item) => item.action === 'blink')?.presentations).toEqual([]);
    expect(IDLE_ACTION_DEFINITIONS.find((item) => item.action === 'stretch')?.presentations).toEqual([]);
  });

  it('never repeats the current action and prefers avoiding the latest two', () => {
    let state = INITIAL_IDLE_PLANNER_STATE;
    let now = 1_000_000;
    for (let index = 0; index < 40; index += 1) {
      const previous = state;
      const plan = planNextIdleAction(state, now);
      expect(plan.action).not.toBe(previous.currentAction);
      const hasOutsideRecent = IDLE_ACTION_DEFINITIONS.some((item) => item.presentations.length > 0
        && item.action !== previous.currentAction && !previous.recentActions.slice(0, 2).includes(item.action)
        && (previous.cooldownUntil[item.action] ?? 0) <= now);
      if (hasOutsideRecent) expect(previous.recentActions.slice(0, 2)).not.toContain(plan.action);
      state = plan.state;
      now += plan.dwellMs;
    }
  });

  it('keeps rare actions behind their cooldown and produces deterministic jitter', () => {
    const first = planNextIdleAction(INITIAL_IDLE_PLANNER_STATE, 50_000);
    expect(planNextIdleAction(INITIAL_IDLE_PLANNER_STATE, 50_000)).toEqual(first);
    let state = INITIAL_IDLE_PLANNER_STATE;
    let now = 50_000;
    const rareAt = new Map<string, number>();
    for (let index = 0; index < 80; index += 1) {
      const plan = planNextIdleAction(state, now);
      if (plan.action === 'sit' || plan.action === 'walk-short') {
        const prior = rareAt.get(plan.action);
        if (prior != null) expect(now - prior).toBeGreaterThanOrEqual(30_000);
        rareAt.set(plan.action, now);
      }
      state = plan.state;
      now += plan.dwellMs;
    }
  });

  it('keeps calm dwell as the majority of a two-minute idle window', () => {
    let state = INITIAL_IDLE_PLANNER_STATE;
    let now = 1_000_000;
    const deadline = now + 120_000;
    let calmMs = 0;
    let activeMs = 0;
    const presentations = new Set<string>();
    while (now < deadline) {
      const plan = planNextIdleAction(state, now);
      const elapsed = Math.min(plan.dwellMs, deadline - now);
      if (plan.action === 'idle') calmMs += elapsed;
      else activeMs += elapsed;
      presentations.add(plan.presentation);
      state = plan.state;
      now += plan.dwellMs;
    }
    expect(calmMs).toBeGreaterThan(activeMs);
    expect(presentations.size).toBeGreaterThan(1);
  });

  it('does not place sleep or unavailable invented actions into the candidate pool', () => {
    expect(IDLE_ACTION_DEFINITIONS.some((item) => item.action === ('sleep' as never))).toBe(false);
    expect(IDLE_ACTION_DEFINITIONS.filter((item) => item.presentations.length > 0).flatMap((item) => item.presentations)).toEqual(
      expect.arrayContaining(['idle', 'look-left', 'look-right', 'waiting', 'running-left', 'running-right']),
    );
    expect(IDLE_ACTION_DEFINITIONS.filter((item) => item.presentations.length === 0).map((item) => item.action)).toEqual(
      expect.arrayContaining(['blink', 'turn', 'stretch']),
    );
  });
});
