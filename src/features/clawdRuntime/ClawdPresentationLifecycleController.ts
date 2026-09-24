import type { ClawdPresentationIntent } from './clawdVisualTypes';

export interface ClawdPresentationFrame {
  intent: ClawdPresentationIntent | null;
  revision: number;
  deadline: number | null;
}

export class ClawdPresentationLifecycleController {
  private frame: ClawdPresentationFrame = { intent: null, revision: 0, deadline: null };

  getFrame() { return this.frame; }

  transition(intent: ClawdPresentationIntent | null, now = Date.now()) {
    if (this.frame.intent?.semanticId === intent?.semanticId) return this.frame;
    this.frame = {
      intent,
      revision: this.frame.revision + 1,
      deadline: intent?.lifecycle === 'finite' && intent.dwellMs ? now + intent.dwellMs : null,
    };
    return this.frame;
  }

  expire(latestIntent: ClawdPresentationIntent | null, now = Date.now()) {
    if (this.frame.deadline == null || now < this.frame.deadline) return this.frame;
    this.frame = {
      intent: latestIntent,
      revision: this.frame.revision + 1,
      deadline: latestIntent?.lifecycle === 'finite' && latestIntent.dwellMs ? now + latestIntent.dwellMs : null,
    };
    return this.frame;
  }

  interrupt(latestIntent: ClawdPresentationIntent | null, now = Date.now()) {
    this.frame = { intent: latestIntent, revision: this.frame.revision + 1, deadline: latestIntent?.lifecycle === 'finite' && latestIntent.dwellMs ? now + latestIntent.dwellMs : null };
    return this.frame;
  }

  reset() { this.frame = { intent: null, revision: this.frame.revision + 1, deadline: null }; }
}
