export const CLAWD_REST_QUIET_MS = 20_000;
export const CLAWD_REST_YAWNING_MS = 60_000;
export const CLAWD_REST_SLEEPING_MS = 10 * 60_000;
export const CLAWD_REST_WAKE_MS = 1_500;

export type ClawdRestState = 'awake' | 'quiet' | 'yawning' | 'sleeping' | 'waking';
type TimerId = ReturnType<typeof setTimeout>;
export interface RestClock { now: () => number; setTimeout: (callback: () => void, delay: number) => TimerId; clearTimeout: (id: TimerId) => void }
const browserClock: RestClock = { now: () => Date.now(), setTimeout: (callback, delay) => setTimeout(callback, delay), clearTimeout: (id) => clearTimeout(id) };

export class ClawdRestController {
  private state: ClawdRestState = 'awake'; private eligible = false; private visible = true;
  private inactiveSince = 0; private hiddenAt: number | null = null; private timer: TimerId | null = null; private destroyed = false;
  private readonly onChange: (state: ClawdRestState) => void; private readonly clock: RestClock;
  constructor(onChange: (state: ClawdRestState) => void, clock: RestClock = browserClock) { this.onChange = onChange; this.clock = clock; }
  getState() { return this.state; }
  setEligible(eligible: boolean) {
    if (this.destroyed || this.eligible === eligible) return; this.eligible = eligible;
    if (!eligible) { if (this.state !== 'waking') this.clear(); return; }
    if (this.state === 'waking') return;
    this.inactiveSince = this.clock.now(); this.transition('awake'); this.schedule();
  }
  activity(critical = false) {
    if (this.destroyed) return; this.clear(); this.inactiveSince = this.clock.now();
    if (critical || this.state === 'awake') { this.transition('awake'); if (this.eligible && this.visible) this.schedule(); return; }
    this.transition('waking'); this.timer = this.clock.setTimeout(() => { this.timer = null; this.inactiveSince = this.clock.now(); this.transition('awake'); if (this.eligible && this.visible) this.schedule(); }, CLAWD_REST_WAKE_MS);
  }
  setVisible(visible: boolean) {
    if (this.destroyed || this.visible === visible) return; this.visible = visible;
    if (!visible) { this.hiddenAt = this.clock.now(); this.clear(); return; }
    if (this.hiddenAt != null) this.inactiveSince += this.clock.now() - this.hiddenAt; this.hiddenAt = null; if (this.eligible) this.schedule();
  }
  destroy() { this.destroyed = true; this.clear(); }
  private transition(next: ClawdRestState) { if (this.state === next) return; this.state = next; this.onChange(next); }
  private clear() { if (this.timer != null) this.clock.clearTimeout(this.timer); this.timer = null; }
  private schedule() {
    this.clear(); if (!this.eligible || !this.visible || this.destroyed || this.state === 'waking') return;
    const elapsed = this.clock.now() - this.inactiveSince;
    if (elapsed >= CLAWD_REST_SLEEPING_MS) { this.transition('sleeping'); return; }
    if (elapsed >= CLAWD_REST_YAWNING_MS) this.transition('yawning'); else if (elapsed >= CLAWD_REST_QUIET_MS) this.transition('quiet'); else this.transition('awake');
    const deadline = elapsed < CLAWD_REST_QUIET_MS ? CLAWD_REST_QUIET_MS : elapsed < CLAWD_REST_YAWNING_MS ? CLAWD_REST_YAWNING_MS : CLAWD_REST_SLEEPING_MS;
    this.timer = this.clock.setTimeout(() => { this.timer = null; this.schedule(); }, Math.max(0, deadline - elapsed));
  }
}
