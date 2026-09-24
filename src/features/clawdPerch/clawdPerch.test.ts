import { describe, expect, it } from 'vitest';
import {
  isInPerchAcceptanceZone,
  resolvePerchNormalizedX,
  resolvePerchPosition,
  shouldDetachFromPerch,
  isClockPerchAvailable,
  clampNormalizedX,
  intersectsExclusion,
  resolvePetCssOrigin,
  resolveRenderedPetFoot,
  PERCH_ACCEPTANCE_VERTICAL_PX,
  PERCH_DETACH_DRAG_PX,
  type PerchSurfaceRect,
  type PerchExclusionZone,
} from './clawdPerch';

const CLOCK: PerchSurfaceRect = { left: 100, top: 200, right: 500, bottom: 400, width: 400, height: 200 };

describe('clawdPerch', () => {
  describe('isInPerchAcceptanceZone', () => {
    it('returns false when foot is outside clock horizontal bounds', () => {
      expect(isInPerchAcceptanceZone(50, 210, CLOCK)).toBe(false);
      expect(isInPerchAcceptanceZone(550, 210, CLOCK)).toBe(false);
    });

    it('returns false when foot is below acceptance band', () => {
      expect(isInPerchAcceptanceZone(300, 260, CLOCK)).toBe(false);
    });

    it('returns true when foot is inside acceptance zone', () => {
      expect(isInPerchAcceptanceZone(300, 210, CLOCK)).toBe(true);
      expect(isInPerchAcceptanceZone(100, 200, CLOCK)).toBe(true);
      expect(isInPerchAcceptanceZone(500, 200 + PERCH_ACCEPTANCE_VERTICAL_PX, CLOCK)).toBe(true);
    });
  });

  describe('resolvePerchNormalizedX', () => {
    it('returns 0 at left edge', () => {
      expect(resolvePerchNormalizedX(100, CLOCK)).toBe(0);
    });

    it('returns 1 at right edge', () => {
      expect(resolvePerchNormalizedX(500, CLOCK)).toBe(1);
    });

    it('returns 0.5 at center', () => {
      expect(resolvePerchNormalizedX(300, CLOCK)).toBe(0.5);
    });

    it('clamps to [0,1]', () => {
      expect(resolvePerchNormalizedX(50, CLOCK)).toBe(0);
      expect(resolvePerchNormalizedX(600, CLOCK)).toBe(1);
    });
  });

  describe('resolvePerchPosition', () => {
    it('places pet foot at clock top edge', () => {
      const pos = resolvePerchPosition(CLOCK, 0.5, 88, 0.94);
      expect(pos.x).toBe(300 - 44);
      expect(pos.y).toBe(200 - 88 * 0.94);
    });

    it('places pet at left edge', () => {
      const pos = resolvePerchPosition(CLOCK, 0, 88, 0.94);
      expect(pos.x).toBe(100 - 44);
    });

    it('places pet at right edge', () => {
      const pos = resolvePerchPosition(CLOCK, 1, 88, 0.94);
      expect(pos.x).toBe(500 - 44);
    });
  });

  describe('rendered pet anchor geometry', () => {
    it('recovers the CSS origin from a 120% bottom-centred transform', () => {
      const rendered = { left: 91.2, top: 182.4, right: 196.8, bottom: 288, width: 105.6, height: 105.6 };
      expect(resolvePetCssOrigin(rendered, 88)).toEqual({ x: 100, y: 200 });
    });

    it('uses the rendered dimensions for the semantic foot point', () => {
      const rendered = { left: 91.2, top: 182.4, right: 196.8, bottom: 288, width: 105.6, height: 105.6 };
      expect(resolveRenderedPetFoot(rendered, 0.94)).toEqual({ x: 144, y: 281.664 });
    });
  });

  describe('clampNormalizedX', () => {
    it('returns original when no exclusion zones', () => {
      expect(clampNormalizedX(0.5, CLOCK, 88, [])).toBe(0.5);
    });

    it('shifts away from exclusion zone', () => {
      const zones: PerchExclusionZone[] = [{ left: 280, top: 180, right: 320, bottom: 220 }];
      const result = clampNormalizedX(0.5, CLOCK, 88, zones);
      expect(result).not.toBe(0.5);
    });
  });

  describe('intersectsExclusion', () => {
    it('returns false when no overlap', () => {
      expect(intersectsExclusion(100, 200, 100, 200, [{ left: 300, top: 300, right: 400, bottom: 400 }])).toBe(false);
    });

    it('returns true when overlapping', () => {
      expect(intersectsExclusion(150, 250, 150, 250, [{ left: 200, top: 200, right: 300, bottom: 300 }])).toBe(true);
    });
  });

  describe('shouldDetachFromPerch', () => {
    it('returns false for small movement', () => {
      expect(shouldDetachFromPerch(105, 205, 100, 200)).toBe(false);
    });

    it('returns true for real drag', () => {
      expect(shouldDetachFromPerch(200, 300, 100, 200)).toBe(true);
    });

    it('uses correct threshold', () => {
      const d = PERCH_DETACH_DRAG_PX;
      expect(shouldDetachFromPerch(100 + d + 1, 200, 100, 200)).toBe(true);
      expect(shouldDetachFromPerch(100 + d - 1, 200, 100, 200)).toBe(false);
    });
  });

  describe('isClockPerchAvailable', () => {
    it('returns false on mobile', () => {
      expect(isClockPerchAvailable('mobile')).toBe(false);
    });

    it('returns false when clock element missing (jsdom)', () => {
      expect(isClockPerchAvailable('desktop')).toBe(false);
    });
  });
});
