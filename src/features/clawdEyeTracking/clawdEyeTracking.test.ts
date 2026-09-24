import { describe, expect, it } from 'vitest';
import { ACTIVE_CLAWD_EYE_CAPABILITY, CENTER_GAZE, EYE_TRACKING_CONFIG, isClawdEyeTrackingEligible, resolveClawdGaze, type EyeTrackingEligibility } from './clawdEyeTracking';

const rect = { left: 100, top: 100, width: 100, height: 100 };
const eligible: EyeTrackingEligibility = { capability: 'body-only', runtimeState: 'idle', interactionState: 'none', restState: 'awake', presentationMode: 'free', miniExpanded: false, reducedMotion: false, hoverFinePointer: true, visible: true };

describe('clawd eye tracking geometry', () => {
  it('centers inside the dead zone', () => expect(resolveClawdGaze({ x: 150, y: 150 }, rect, 'full')).toEqual(CENTER_GAZE));
  it('maps left and right relative to the pet box', () => {
    expect(resolveClawdGaze({ x: 100, y: 150 }, rect, 'full').normalizedX).toBeLessThan(0);
    expect(resolveClawdGaze({ x: 200, y: 150 }, rect, 'full').normalizedX).toBeGreaterThan(0);
  });
  it('maps above and below relative to the pet box', () => {
    expect(resolveClawdGaze({ x: 150, y: 100 }, rect, 'full').normalizedY).toBeLessThan(0);
    expect(resolveClawdGaze({ x: 150, y: 200 }, rect, 'full').normalizedY).toBeGreaterThan(0);
  });
  it('uses the supplied bounding box rather than viewport position', () => {
    expect(resolveClawdGaze({ x: 550, y: 550 }, { left: 500, top: 500, width: 100, height: 100 }, 'full')).toEqual(CENTER_GAZE);
  });
  it('clamps pupil displacement to three visual units', () => {
    const gaze = resolveClawdGaze({ x: 10_000, y: 150 }, rect, 'full');
    expect(gaze.eyeX).toBe(EYE_TRACKING_CONFIG.eyeMaxOffset);
    expect(Math.abs(gaze.eyeY)).toBeLessThanOrEqual(EYE_TRACKING_CONFIG.eyeMaxOffset);
  });
  it('keeps body-only tracking pupil and shadow offsets at zero', () => {
    const gaze = resolveClawdGaze({ x: 200, y: 150 }, rect, 'body-only');
    expect(gaze.bodyX).toBeGreaterThan(0); expect(gaze.eyeX).toBe(0); expect(gaze.shadowX).toBe(0);
  });
  it('returns center for none capability or pointer reset', () => {
    expect(resolveClawdGaze({ x: 200, y: 150 }, rect, 'none')).toEqual(CENTER_GAZE);
    expect(resolveClawdGaze(null, rect, 'full')).toEqual(CENTER_GAZE);
  });
  it('declares the baked production asset body-only', () => expect(ACTIVE_CLAWD_EYE_CAPABILITY).toBe('body-only'));
  it('does not persist derived gaze', () => {
    localStorage.clear(); resolveClawdGaze({ x: 200, y: 150 }, rect, 'body-only'); expect(localStorage.length).toBe(0);
  });
});

describe('clawd eye tracking eligibility', () => {
  it('allows awake and quiet idle tracking', () => {
    expect(isClawdEyeTrackingEligible(eligible)).toBe(true);
    expect(isClawdEyeTrackingEligible({ ...eligible, restState: 'quiet' })).toBe(true);
  });
  it.each([
    ['runtime non-idle', { runtimeState: 'thinking' }], ['held', { interactionState: 'held' }], ['dragging', { interactionState: 'dragging' }],
    ['sleeping', { restState: 'sleeping' }], ['yawning', { restState: 'yawning' }], ['waking', { restState: 'waking' }],
    ['none capability', { capability: 'none' }], ['reduced motion', { reducedMotion: true }], ['touch', { hoverFinePointer: false }],
  ] as const)('disables %s', (_label, override) => expect(isClawdEyeTrackingEligible({ ...eligible, ...override } as EyeTrackingEligibility)).toBe(false));
  it('disables collapsed Mini and allows expanded Mini', () => {
    expect(isClawdEyeTrackingEligible({ ...eligible, presentationMode: 'mini-left', miniExpanded: false })).toBe(false);
    expect(isClawdEyeTrackingEligible({ ...eligible, presentationMode: 'mini-right', miniExpanded: true })).toBe(true);
  });
});
