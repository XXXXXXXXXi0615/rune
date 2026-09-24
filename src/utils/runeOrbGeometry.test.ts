import { describe, expect, it } from 'vitest';
import { classifyRuneOrbGesture, clampRuneOrbPoint, clampRuneOrbPointToBounds, normalizedYFromTop, snapRuneOrbEdge, snapRuneOrbEdgeWithinBounds, topFromNormalizedY } from './runeOrbGeometry';

describe('Rune Orb geometry', () => {
  it('distinguishes click from drag at the five pixel threshold', () => {
    expect(classifyRuneOrbGesture({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe('click');
    expect(classifyRuneOrbGesture({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe('drag');
  });

  it('snaps to the nearest viewport edge', () => {
    expect(snapRuneOrbEdge(100, 1000)).toBe('left');
    expect(snapRuneOrbEdge(900, 1000)).toBe('right');
  });

  it('round trips normalized vertical position across resize', () => {
    const normalized = normalizedYFromTop(420, 900, 38, 24);
    expect(topFromNormalizedY(normalized, 900, 38, 24)).toBeCloseTo(420, 4);
    expect(topFromNormalizedY(normalized, 700, 38, 24)).toBeGreaterThan(24);
  });

  it('clamps geometry to the viewport rail', () => {
    expect(clampRuneOrbPoint({ x: -20, y: 900 }, 1440, 900, 38, 24)).toEqual({ x: 24, y: 838 });
  });

  it('snaps and clamps inside an offset App Frame', () => {
    const bounds = { left: 505, top: 0, right: 935, bottom: 900, width: 430, height: 900 };
    expect(snapRuneOrbEdgeWithinBounds(600, bounds)).toBe('left');
    expect(snapRuneOrbEdgeWithinBounds(820, bounds)).toBe('right');
    expect(clampRuneOrbPointToBounds({ x: 0, y: 1000 }, bounds, 38, 16)).toEqual({ x: 521, y: 846 });
  });
});
