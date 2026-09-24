import { describe, expect, it } from 'vitest';
import { MINI_HIT_TARGET_PX, MINI_OFFSET_RATIO, MINI_PEEK_PX, calculateMiniGeometry, normalizeMiniOffset, resolveEdgeSnap, resolveMiniEdgeInsets, resolveModeAfterDrag, restoreMiniMode } from './clawdMiniMode';

const viewport = { width: 1000, height: 800, bottomSafe: 20 };
describe('CLAWD mini mode geometry', () => {
  it('keeps far anchors free and snaps both 30px boundaries inclusively', () => {
    expect(resolveEdgeSnap(31, 1000)).toBe('free'); expect(resolveEdgeSnap(30, 1000)).toBe('mini-left'); expect(resolveEdgeSnap(970, 1000)).toBe('mini-right');
  });
  it('uses a 25px peek and accessible hit target', () => {
    const value = calculateMiniGeometry('mini-left', MINI_OFFSET_RATIO, viewport, 88);
    expect(value.visiblePx).toBe(MINI_PEEK_PX); expect(value.hitWidth).toBe(MINI_HIT_TARGET_PX); expect(value.left).toBe(-63);
  });
  it('mirrors left and right geometry', () => {
    const left = calculateMiniGeometry('mini-left', .5, viewport, 88); const right = calculateMiniGeometry('mini-right', .5, viewport, 88);
    expect(left.top).toBe(right.top); expect(left.left).toBe(-63); expect(right.left).toBe(975);
  });
  it('clamps vertical geometry and resize restoration', () => {
    expect(calculateMiniGeometry('mini-left', 2, viewport, 88).top).toBe(692);
    expect(calculateMiniGeometry('mini-left', 1, { ...viewport, height: 400 }, 88).top).toBe(292);
    expect(normalizeMiniOffset(346, viewport, 88)).toBe(.5);
  });
  it('restores normalized values and repairs invalid persistence', () => {
    expect(restoreMiniMode('mini-right', .7)).toEqual({ mode: 'mini-right', offset: .7 });
    expect(restoreMiniMode('lost', Number.NaN)).toEqual({ mode: 'free', offset: MINI_OFFSET_RATIO });
  });
  it('drag intent can leave or return to an edge without touching other axes', () => {
    expect(resolveModeAfterDrag(200, 1000)).toBe('free'); expect(resolveModeAfterDrag(980, 1000)).toBe('mini-right');
  });
  it('derives a usable content edge from tall reserved topology', () => {
    expect(resolveMiniEdgeInsets([{ left: 0, right: 280, top: 0, bottom: 800 }], 1000, 800)).toEqual({ leftInset: 280, rightInset: 0 });
    expect(calculateMiniGeometry('mini-left', .5, { ...viewport, leftInset: 280 }, 88).left).toBe(217);
  });
});
