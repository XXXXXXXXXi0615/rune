import { describe, expect, it } from 'vitest';
import {
  PET_SAFE_GAP_PX,
  intersectsReservedRegion,
  petMaxLeft,
  petMaxTop,
  resolveAcceptedPetPosition,
  resolveAcceptedPetRect,
  type PetRect,
  type PetResolutionContext,
} from './PetSafeRegionResolver';

const region = (left: number, top: number, width: number, height: number): PetRect => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

const context = (reserved: PetRect[], overrides: Partial<PetResolutionContext> = {}): PetResolutionContext => ({
  canvasLeft: 0, canvasWidth: 390, canvasHeight: 844, bottomReserve: 88, petSize: 64,
  viewportWidth: 390, viewportHeight: 844, reserved, ...overrides,
});

const rectOf = (result: { left: number; top: number }, ctx: PetResolutionContext): PetRect => ({
  left: result.left, top: result.top, right: result.left + ctx.petSize, bottom: result.top + ctx.petSize, width: ctx.petSize, height: ctx.petSize,
});

describe('resolveAcceptedPetRect', () => {
  it('preserves a clear drop exactly where it was requested', () => {
    const ctx = context([region(0, 0, 120, 120)]);
    const result = resolveAcceptedPetRect({ left: 200, top: 500 }, ctx);
    expect(result).toEqual({ left: 200, top: 500, gap: PET_SAFE_GAP_PX });
  });

  it('clamps a drop outside the canvas into the legal travel box', () => {
    const ctx = context([]);
    expect(resolveAcceptedPetRect({ left: -400, top: -400 }, ctx)).toEqual({ left: 0, top: 0, gap: PET_SAFE_GAP_PX });
    expect(resolveAcceptedPetRect({ left: 9999, top: 9999 }, ctx)).toEqual({
      left: ctx.canvasLeft + petMaxLeft(ctx), top: petMaxTop(ctx), gap: PET_SAFE_GAP_PX,
    });
  });

  it('settles an unsafe drop once, to a predictable position clear of the obstacle', () => {
    const obstacle = region(200, 460, 120, 120);
    const ctx = context([obstacle]);
    const first = resolveAcceptedPetRect({ left: 220, top: 480 }, ctx);
    const second = resolveAcceptedPetRect({ left: 220, top: 480 }, ctx);
    expect(first).toEqual(second);
    expect(intersectsReservedRegion(rectOf(first, ctx), [obstacle])).toBe(false);
    expect(first.gap).toBe(PET_SAFE_GAP_PX);
  });

  it('is a fixed point for every branch, so a later pass cannot rewrite the drop', () => {
    const cases: Array<{ name: string; ctx: PetResolutionContext; requested: { left: number; top: number } }> = [
      { name: 'clear drop', ctx: context([region(0, 0, 120, 120)]), requested: { left: 220, top: 500 } },
      { name: 'needs a nudge', ctx: context([region(200, 460, 120, 120)]), requested: { left: 220, top: 480 } },
      { name: 'needs the candidate scan', ctx: context([region(0, 0, 390, 700)]), requested: { left: 100, top: 300 } },
      { name: 'nothing legal at all', ctx: context([region(0, 0, 390, 900)]), requested: { left: 100, top: 300 } },
      { name: 'gap-only conflict', ctx: context([region(400, 100, 40, 40)]), requested: { left: 358, top: 100 } },
    ];
    for (const testCase of cases) {
      const settled = resolveAcceptedPetRect(testCase.requested, testCase.ctx);
      const reResolved = resolveAcceptedPetRect({ left: settled.left, top: settled.top }, testCase.ctx);
      expect(reResolved, `${testCase.name} must not move on a second pass`).toEqual(settled);
    }
  });

  it('never returns a hard-overlapping position while any clear candidate exists', () => {
    const obstacle = region(120, 300, 150, 150);
    const ctx = context([obstacle]);
    const settled = resolveAcceptedPetRect({ left: 150, top: 330 }, ctx);
    expect(intersectsReservedRegion(rectOf(settled, ctx), [obstacle], 0)).toBe(false);
  });

  it('keeps the requested point when the page offers no legal spot at all', () => {
    const ctx = context([region(0, 0, 390, 900)]);
    const requested = { left: 100, top: 300 };
    expect(resolveAcceptedPetRect(requested, ctx)).toEqual({ ...requested, gap: null });
  });
});

describe('resolveAcceptedPetPosition', () => {
  it('round-trips a clear normalized position without moving it', () => {
    const ctx = context([]);
    const result = resolveAcceptedPetPosition({ x: .5, y: .5 }, ctx);
    expect(result.relocated).toBe(false);
    expect(result.x).toBeCloseTo(.5, 10);
    expect(result.y).toBeCloseTo(.5, 10);
  });

  it('reports relocation and stays a fixed point for an unsafe normalized drop', () => {
    const ctx = context([region(150, 400, 160, 160)]);
    const settled = resolveAcceptedPetPosition({ x: .6, y: .55 }, ctx);
    expect(settled.relocated).toBe(true);
    const again = resolveAcceptedPetPosition({ x: settled.x, y: settled.y }, ctx);
    expect(again.relocated).toBe(false);
    expect(again.x).toBeCloseTo(settled.x, 10);
    expect(again.y).toBeCloseTo(settled.y, 10);
    expect(settled.x).toBeGreaterThanOrEqual(0);
    expect(settled.x).toBeLessThanOrEqual(1);
    expect(settled.y).toBeGreaterThanOrEqual(0);
    expect(settled.y).toBeLessThanOrEqual(1);
  });
});
