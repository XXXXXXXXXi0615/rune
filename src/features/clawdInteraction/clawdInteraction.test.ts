import { describe, expect, it } from 'vitest';
import { CLAWD_DRAG_THRESHOLD_PX, CLAWD_LONG_PRESS_MS, classifyPointerMove, resolveClickReaction, reactionDuration, resolveDragDirection, type PointerSequence } from './clawdInteraction';

const sequence = (patch: Partial<PointerSequence> = {}): PointerSequence => ({ pointerId: 1, startedAt: 0, startX: 0, startY: 0, lastX: 0, held: false, dragging: false, direction: 'neutral', ...patch });

describe('CLAWD interaction classifier', () => {
  it('keeps sub-threshold movement pressing and promotes movement over 6px to drag', () => {
    expect(CLAWD_LONG_PRESS_MS).toBe(320); expect(CLAWD_DRAG_THRESHOLD_PX).toBe(6);
    expect(classifyPointerMove(sequence(), 6, 0)).toBe('pressing');
    expect(classifyPointerMove(sequence(), 6.01, 0)).toBe('dragging');
  });
  it('keeps held semantic until movement and then promotes to dragging', () => {
    expect(classifyPointerMove(sequence({ held: true }), 0, 0)).toBe('held');
    expect(classifyPointerMove(sequence({ held: true }), 7, 0)).toBe('dragging');
  });
  it('uses directional hysteresis without switching on every pixel', () => {
    expect(resolveDragDirection('neutral', 7)).toBe('right');
    expect(resolveDragDirection('right', 4)).toBe('right');
    expect(resolveDragDirection('right', 1)).toBe('neutral');
    expect(resolveDragDirection('neutral', -7)).toBe('left');
  });
  it('maps single, double 50 percent branch, and four clicks', () => {
    expect(resolveClickReaction(1)).toBe('tap');
    expect(resolveClickReaction(2, .75)).toBe('poke');
    expect(resolveClickReaction(2, .25)).toBe('annoyed');
    expect(resolveClickReaction(4)).toBe('flail');
  });
  it('uses bounded Reduced Motion durations without losing semantics', () => {
    expect(reactionDuration('flail', true)).toBe(180);
    expect(reactionDuration('flail', false)).toBe(3500);
  });
});
