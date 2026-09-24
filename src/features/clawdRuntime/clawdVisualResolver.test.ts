import { describe, expect, it } from 'vitest';
import { ClawdPresentationLifecycleController } from './ClawdPresentationLifecycleController';
import { CLAWD_NEUTRAL_PRESENTATION, resolveClawdPresentation } from './clawdVisualResolver';
import type { ClawdRuntimeSnapshot, ClawdRuntimeState, ClawdWorkingTier, ClawdJugglingTier } from './clawdRuntimeTypes';

const ALL = new Set([
  'clawd-thinking', 'clawd-typing', 'clawd-groove', 'clawd-tool-use', 'clawd-random',
  'clawd-error', 'clawd-success', 'clawd-notification', 'clawd-cleaning-system', 'clawd-carrying', 'clawd-sleeping',
]);
const snapshot = (runtimeState: ClawdRuntimeState, workingTier?: ClawdWorkingTier, jugglingTier?: ClawdJugglingTier): ClawdRuntimeSnapshot => ({
  runtimeState, sourceSessionId: runtimeState === 'idle' ? null : 's', liveSessionCount: runtimeState === 'idle' ? 0 : 1,
  subagentCount: jugglingTier === 'multi' ? 2 : jugglingTier === 'single' ? 1 : 0, workingTier, jugglingTier,
});
const resolve = (state: ClawdRuntimeSnapshot, availablePresentationIds = ALL, reducedMotion = false) =>
  resolveClawdPresentation(state, { availablePresentationIds, reducedMotion });

describe('CLAWD visual resolver', () => {
  it('A-B: hands idle to the planner and resolves thinking', () => {
    expect(resolve(snapshot('idle'))).toBeNull();
    expect(resolve(snapshot('thinking'))).toMatchObject({ presentationId: 'clawd-thinking', source: 'runtime', lifecycle: 'continuous' });
  });

  it.each([
    ['typing', 'clawd-typing'], ['groove', 'clawd-groove'], ['building', 'clawd-tool-use'], ['typing', 'clawd-typing'],
  ] as const)('C-F: maps working %s to %s', (tier, presentationId) => {
    expect(resolve(snapshot('working', tier))?.presentationId).toBe(presentationId);
  });

  it('G-I: maps juggling tiers and returns to working from the latest snapshot', () => {
    expect(resolve(snapshot('juggling', undefined, 'single'))?.presentationId).toBe('clawd-groove');
    expect(resolve(snapshot('juggling', undefined, 'multi'))?.presentationId).toBe('clawd-random');
    expect(resolve(snapshot('working', 'typing'))?.presentationId).toBe('clawd-typing');
  });

  it('J-K: error immediately outranks thinking and idle releases ownership', () => {
    const controller = new ClawdPresentationLifecycleController();
    controller.transition(resolve(snapshot('thinking')), 0);
    expect(controller.transition(resolve(snapshot('error')), 1).intent?.presentationId).toBe('clawd-error');
    expect(controller.transition(resolve(snapshot('idle')), 2).intent).toBeNull();
  });

  it('L: does not restart the same semantic presentation', () => {
    const controller = new ClawdPresentationLifecycleController();
    const intent = resolve(snapshot('working', 'typing'))!;
    const first = controller.transition(intent, 0);
    const second = controller.transition({ ...intent }, 100);
    expect(second.revision).toBe(first.revision);
  });

  it('M-N-O: follows exact, category, then neutral capability fallback', () => {
    expect(resolve(snapshot('working', 'typing'), new Set(['clawd-tool-use']))?.presentationId).toBe('clawd-tool-use');
    expect(resolve(snapshot('working', 'typing'), new Set())?.presentationId).toBe(CLAWD_NEUTRAL_PRESENTATION);
    const afterFailure = new Set(ALL); afterFailure.delete('clawd-error');
    expect(resolve(snapshot('error'), afterFailure)?.presentationId).toBe(CLAWD_NEUTRAL_PRESENTATION);
  });

  it('P-Q-R: expires finite, retains continuous, and interrupts finite immediately', () => {
    const controller = new ClawdPresentationLifecycleController();
    const error = resolve(snapshot('error'))!;
    controller.transition(error, 0);
    expect(controller.expire(error, 4_999).revision).toBe(1);
    expect(controller.expire(error, 5_000).revision).toBe(2);
    const thinking = resolve(snapshot('thinking'))!;
    controller.transition(thinking, 6_000);
    expect(controller.getFrame().deadline).toBeNull();
    controller.transition(error, 7_000);
    expect(controller.interrupt(thinking, 7_001).intent?.runtimeState).toBe('thinking');
  });

  it('S-T: idle handoff stays empty and reduced motion preserves semantics with static fallback', () => {
    const controller = new ClawdPresentationLifecycleController();
    controller.transition(resolve(snapshot('thinking')), 0);
    const idle = controller.transition(null, 1);
    expect(idle.intent).toBeNull();
    expect(controller.expire(null, 99_999).intent).toBeNull();
    expect(resolve(snapshot('working', 'building'), ALL, true)).toMatchObject({
      presentationId: CLAWD_NEUTRAL_PRESENTATION, runtimeState: 'working', source: 'runtime',
    });
  });
});
