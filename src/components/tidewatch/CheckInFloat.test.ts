import { describe, expect, it } from 'vitest';
import { clampCheckInUtilityPoint, placementFromCheckInPoint, pointFromCheckInPlacement, resolveCheckInUtilityBounds } from './CheckInUtilityHost';
import { resolveRunePresentationAsset } from '@/components/branding/runeBrandAssets';

describe('CheckInFloat presentation geometry', () => {
  it('registers the audited Rune asset and effective visual bounds', () => {
    expect(resolveRunePresentationAsset('tidewatch-checkin-neutral')).toMatchObject({
      canvas: { width: 1376, height: 1143 },
      visualBounds: { x: 38, y: 28, width: 923, height: 1088, alphaThreshold: 8 },
    });
  });

  it('derives safe bounds from shell, switch and dock geometry', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const bounds = resolveCheckInUtilityBounds(
      { left: 0, top: 0, right: 390, bottom: 1200 },
      { left: 16, top: 80, right: 374, bottom: 132 },
      [{ left: 0, top: 700, right: 390, bottom: 800 }, { left: 173, top: 669, right: 217, bottom: 713 }],
      { width: 340, height: 400 },
      800,
    );
    expect(bounds).toEqual({ minX: 14, maxX: 36, minY: 170, maxY: 255, safeBottom: 655 });
  });

  it('clamps extreme drag positions back inside the safe region', () => {
    const bounds = { minX: 12, maxX: 250, minY: 150, maxY: 500, safeBottom: 600 };
    expect(clampCheckInUtilityPoint({ x: -900, y: -900 }, bounds)).toEqual({ x: 12, y: 150 });
    expect(clampCheckInUtilityPoint({ x: 900, y: 900 }, bounds)).toEqual({ x: 250, y: 500 });
  });

  it('converts a dragged point to one shared edge and bottom anchor', () => {
    const bounds = { minX: 12, maxX: 250, minY: 150, maxY: 500, safeBottom: 600 };
    expect(placementFromCheckInPoint({ x: 70, y: 300 }, bounds, 88)).toEqual({ edge: 'left', anchorY: 388 });
    expect(placementFromCheckInPoint({ x: 220, y: 300 }, bounds, 88)).toEqual({ edge: 'right', anchorY: 388 });
  });

  it('uses the same bottom anchor across differently sized presentation modes', () => {
    const idleBounds = { minX: 14, maxX: 194, minY: 150, maxY: 570, safeBottom: 642 };
    const editingBounds = { minX: 14, maxX: 36, minY: 150, maxY: 242, safeBottom: 642 };
    const placement = { edge: 'right' as const, anchorY: 642 };
    expect(pointFromCheckInPlacement(placement, idleBounds, 72)).toEqual({ x: 194, y: 570 });
    expect(pointFromCheckInPlacement(placement, editingBounds, 400)).toEqual({ x: 36, y: 242 });
  });
});
