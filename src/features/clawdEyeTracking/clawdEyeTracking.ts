export type ClawdEyeTrackingCapability = 'full' | 'body-only' | 'none';
export type EyeTrackingRestState = 'awake' | 'quiet' | 'yawning' | 'sleeping' | 'waking';
export type EyeTrackingMiniMode = 'free' | 'mini-left' | 'mini-right';

export interface EyeTrackingConfig {
  eyeMaxOffset: number;
  deadZone: number;
  bodyFollowInfluence: number;
  shadowInfluence: number;
  gazeShiftInfluence: number;
  quietSensitivity: number;
}

export const EYE_TRACKING_CONFIG: Readonly<EyeTrackingConfig> = Object.freeze({
  eyeMaxOffset: 3,
  deadZone: 0.12,
  bodyFollowInfluence: 0.33,
  shadowInfluence: 0.15,
  gazeShiftInfluence: 0.3,
  quietSensitivity: 0.6,
});

/** Current production visual is one baked raster layer: no pupil or shadow parts. */
export const ACTIVE_CLAWD_EYE_CAPABILITY: ClawdEyeTrackingCapability = 'body-only';

export interface PointerSample { x: number; y: number }
export interface TrackingRect { left: number; top: number; width: number; height: number }
export interface ClawdGaze {
  normalizedX: number;
  normalizedY: number;
  eyeX: number;
  eyeY: number;
  bodyX: number;
  bodyY: number;
  shadowX: number;
}

export const CENTER_GAZE: Readonly<ClawdGaze> = Object.freeze({ normalizedX: 0, normalizedY: 0, eyeX: 0, eyeY: 0, bodyX: 0, bodyY: 0, shadowX: 0 });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolveClawdGaze(sample: PointerSample | null, rect: TrackingRect, capability: ClawdEyeTrackingCapability, sensitivity = 1, config = EYE_TRACKING_CONFIG): ClawdGaze {
  if (!sample || capability === 'none' || rect.width <= 0 || rect.height <= 0) return { ...CENTER_GAZE };
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let x = (sample.x - centerX) / (rect.width / 2);
  let y = (sample.y - centerY) / (rect.height / 2);
  const distance = Math.hypot(x, y);
  if (distance < config.deadZone) return { ...CENTER_GAZE };
  if (distance > 1) { x /= distance; y /= distance; }
  x = clamp(x * sensitivity, -1, 1);
  y = clamp(y * sensitivity, -1, 1);
  const supportsPupils = capability === 'full';
  return {
    normalizedX: x,
    normalizedY: y,
    eyeX: supportsPupils ? x * config.eyeMaxOffset : 0,
    eyeY: supportsPupils ? y * config.eyeMaxOffset : 0,
    bodyX: x * config.eyeMaxOffset * config.bodyFollowInfluence,
    bodyY: y * config.eyeMaxOffset * config.bodyFollowInfluence,
    shadowX: supportsPupils ? x * config.eyeMaxOffset * config.shadowInfluence : 0,
  };
}

export interface EyeTrackingEligibility {
  capability: ClawdEyeTrackingCapability;
  runtimeState: string;
  interactionState: string;
  restState: EyeTrackingRestState;
  presentationMode: EyeTrackingMiniMode;
  miniExpanded: boolean;
  reducedMotion: boolean;
  hoverFinePointer: boolean;
  visible: boolean;
}

export function isClawdEyeTrackingEligible(input: EyeTrackingEligibility): boolean {
  if (!input.visible || input.reducedMotion || !input.hoverFinePointer || input.capability === 'none') return false;
  if (input.runtimeState !== 'idle' || input.interactionState !== 'none') return false;
  if (input.restState !== 'awake' && input.restState !== 'quiet') return false;
  if (input.presentationMode !== 'free' && !input.miniExpanded) return false;
  return true;
}

export interface PointerTrackerStats { pointerEvents: number; scheduledFrames: number; visualUpdates: number; pendingFrame: boolean }
type PointerSubscriber = (sample: PointerSample | null) => void;

class ClawdPointerTracker {
  private subscribers = new Set<PointerSubscriber>();
  private latest: PointerSample | null = null;
  private frame: number | null = null;
  private stats = { pointerEvents: 0, scheduledFrames: 0, visualUpdates: 0 };

  subscribe = (subscriber: PointerSubscriber) => {
    this.subscribers.add(subscriber);
    if (this.subscribers.size === 1) this.attach();
    return () => {
      this.subscribers.delete(subscriber);
      if (!this.subscribers.size) this.detach();
    };
  };

  getStats = (): PointerTrackerStats => ({ ...this.stats, pendingFrame: this.frame !== null });
  resetStats = () => { this.stats = { pointerEvents: 0, scheduledFrames: 0, visualUpdates: 0 }; };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    this.stats.pointerEvents += 1;
    this.latest = { x: event.clientX, y: event.clientY };
    this.schedule();
  };

  private reset = () => { this.latest = null; this.schedule(); };
  private onVisibility = () => { if (document.visibilityState === 'hidden') this.reset(); };

  private schedule() {
    if (this.frame !== null || !this.subscribers.size) return;
    this.stats.scheduledFrames += 1;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.stats.visualUpdates += 1;
      this.subscribers.forEach((subscriber) => subscriber(this.latest));
    });
  }

  private attach() {
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.reset);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private detach() {
    window.removeEventListener('pointermove', this.onPointerMove);
    document.documentElement.removeEventListener('pointerleave', this.reset);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.latest = null;
  }
}

export const clawdPointerTracker = new ClawdPointerTracker();
