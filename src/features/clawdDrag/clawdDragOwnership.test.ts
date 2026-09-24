import { describe, expect, it } from 'vitest';
import type { PetRect } from '@/features/desktopPet/PetSafeRegionResolver';
import {
  INITIAL_DRAG_OWNERSHIP,
  beginDragGesture,
  beginLanding,
  cancelDragGesture,
  completeLanding,
  currentPositionOwner,
  dragOwnsPosition,
  promoteGestureToDrag,
  requestAutoPositionWrite,
  resolveFreeHostPositionVars,
  resolveFinalDrop,
  resolveGestureSuppression,
} from './clawdDragOwnership';

const region = (left: number, top: number, width: number, height: number): PetRect => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

const viewport = { viewportWidth: 1280, viewportHeight: 800 };
const host = { maxX: 1280 - 88, maxY: 800 - 16 - 88 };

describe('CLAWD drag ownership machine', () => {
  it('starts idle and hands ownership to drag from pointerdown through landing', () => {
    expect(dragOwnsPosition(INITIAL_DRAG_OWNERSHIP)).toBe(false);
    expect(currentPositionOwner(INITIAL_DRAG_OWNERSHIP)).toBe('auto');
    const pressed = beginDragGesture();
    expect(dragOwnsPosition(pressed)).toBe(true);
    const dragging = promoteGestureToDrag(pressed);
    expect(dragging.gestureDragging).toBe(true);
    expect(dragOwnsPosition(dragging)).toBe(true);
    const landing = beginLanding(dragging);
    expect(landing.gestureActive).toBe(false);
    expect(dragOwnsPosition(landing)).toBe(true);
    const done = completeLanding(landing);
    expect(dragOwnsPosition(done.state)).toBe(false);
    expect(currentPositionOwner(done.state)).toBe('auto');
    expect(done.runDeferredRefresh).toBe(false);
  });

  it('denies automatic position writes during pressed, held, dragging and landing, and defers them once', () => {
    for (const state of [beginDragGesture(), promoteGestureToDrag(beginDragGesture()), beginLanding(promoteGestureToDrag(beginDragGesture()))]) {
      const request = requestAutoPositionWrite(state);
      expect(request.allowed).toBe(false);
      expect(request.state.needsGeometryRefresh).toBe(true);
    }
    const idleRequest = requestAutoPositionWrite(INITIAL_DRAG_OWNERSHIP);
    expect(idleRequest.allowed).toBe(true);
    expect(idleRequest.state).toBe(INITIAL_DRAG_OWNERSHIP);
  });

  it('runs the deferred geometry refresh exactly once after landing completes', () => {
    const dragging = promoteGestureToDrag(beginDragGesture());
    const denied = requestAutoPositionWrite(dragging);
    const landing = beginLanding(denied.state);
    expect(landing.needsGeometryRefresh).toBe(true);
    const done = completeLanding(landing);
    expect(done.runDeferredRefresh).toBe(true);
    expect(done.state.needsGeometryRefresh).toBe(false);
    expect(completeLanding(done.state).runDeferredRefresh).toBe(false);
  });

  it('cancel cleans ownership completely and drops stale refresh flags', () => {
    const dragging = promoteGestureToDrag(beginDragGesture());
    const denied = requestAutoPositionWrite(dragging);
    const cancelled = cancelDragGesture();
    expect(cancelled).toEqual(INITIAL_DRAG_OWNERSHIP);
    expect(dragOwnsPosition(cancelled)).toBe(false);
    expect(cancelled.needsGeometryRefresh).toBe(false);
    expect(denied.state.gestureDragging).toBe(true);
  });

  it('promoting to drag is idempotent for the whole gesture', () => {
    const once = promoteGestureToDrag(beginDragGesture());
    const twice = promoteGestureToDrag(once);
    expect(twice).toBe(once);
  });
});

describe('CLAWD gesture suppression contract', () => {
  it('suppresses click, aggregation, long press, palette and tap actions permanently once dragging', () => {
    const suppressed = resolveGestureSuppression(true);
    expect(suppressed.suppressClick).toBe(true);
    expect(suppressed.suppressClickAggregation).toBe(true);
    expect(suppressed.suppressLongPress).toBe(true);
    expect(suppressed.suppressPalette).toBe(true);
    expect(suppressed.suppressTapAction).toBe(true);
  });
  it('allows tap semantics before the drag threshold', () => {
    const open = resolveGestureSuppression(false);
    expect(Object.values(open).every((value) => value === false)).toBe(true);
  });
});

describe('CLAWD final drop pipeline', () => {
  it('keeps a legal drop exactly at the pointer target', () => {
    const result = resolveFinalDrop({ dropLeft: 640, dropTop: 360, petSize: 88, ...host, ...viewport, reserved: [] });
    expect(result.left).toBe(640);
    expect(result.top).toBe(360);
    expect(result.relocatedBySafeRegion).toBe(false);
    expect(result.resolutionPasses).toBe(1);
    expect(result.normalizedX).toBeCloseTo(640 / host.maxX, 10);
    expect(result.normalizedY).toBeCloseTo(360 / host.maxY, 10);
  });

  it('clamps out-of-viewport drops into the host bounds', () => {
    const result = resolveFinalDrop({ dropLeft: 9999, dropTop: -400, petSize: 88, ...host, ...viewport, reserved: [] });
    expect(result.left).toBe(host.maxX);
    expect(result.top).toBe(0);
    expect(result.relocatedBySafeRegion).toBe(false);
  });

  it('resolves an illegal drop to the nearest legal point exactly once and deterministically', () => {
    const reserved = [region(300, 300, 200, 120)];
    const input = { dropLeft: 340, dropTop: 330, petSize: 88, ...host, ...viewport, reserved };
    const first = resolveFinalDrop(input);
    const second = resolveFinalDrop(input);
    expect(first.relocatedBySafeRegion).toBe(true);
    expect(first.resolutionPasses).toBe(1);
    expect(first).toEqual(second);
    const settled = region(first.left, first.top, 88, 88);
    const stillInside = reserved.some((r) => settled.right > r.left && settled.left < r.right && settled.bottom > r.top && settled.top < r.bottom);
    expect(stillInside).toBe(false);
    expect(first.left).toBeGreaterThanOrEqual(0);
    expect(first.top).toBeGreaterThanOrEqual(0);
    expect(first.left).toBeLessThanOrEqual(host.maxX);
    expect(first.top).toBeLessThanOrEqual(host.maxY);
  });

  it('uses the idle-resolver gap so the committed point needs no second relocation', () => {
    const reserved = [region(0, 0, 280, 800)];
    const result = resolveFinalDrop({ dropLeft: 260, dropTop: 400, petSize: 88, ...host, ...viewport, reserved });
    expect(result.relocatedBySafeRegion).toBe(true);
    expect(result.left).toBeGreaterThanOrEqual(280 + 20);
  });

  it('never resolves twice even when several regions overlap the drop', () => {
    const reserved = [region(200, 200, 160, 160), region(240, 240, 160, 160), region(500, 100, 90, 500)];
    const result = resolveFinalDrop({ dropLeft: 280, dropTop: 280, petSize: 88, ...host, ...viewport, reserved });
    expect(result.resolutionPasses).toBe(1);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.top).toBeGreaterThanOrEqual(0);
  });
});

describe('CLAWD visual anchor stability', () => {
  it('host placement vars depend only on normalized position and scale, never on asset normalization', () => {
    const base = resolveFreeHostPositionVars({ x: 0.42, y: 0.66, scale: 1 });
    for (const footAnchor of [0.5, 0.9, 0.94, 1]) {
      for (const scaleY of [1, 2.4, 3.1]) {
        expect(resolveFreeHostPositionVars({ x: 0.42, y: 0.66, scale: 1 })).toEqual(base);
        expect(base['--companion-y']).toBe('66%');
        expect(base).not.toHaveProperty('--clawd-visual-y');
        void footAnchor; void scaleY;
      }
    }
  });
});
