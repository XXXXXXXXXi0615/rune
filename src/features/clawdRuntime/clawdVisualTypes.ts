import type { ClawdRuntimeState } from './clawdRuntimeTypes';

export type ClawdPresentationLifecycle = 'continuous' | 'finite' | 'once';
export type ClawdPresentationSource = 'runtime' | 'interaction' | 'idle';

export interface ClawdPresentationIntent {
  presentationId: string;
  runtimeState: ClawdRuntimeState;
  lifecycle: ClawdPresentationLifecycle;
  dwellMs?: number;
  interruptible: boolean;
  fallbackPresentationId: string;
  source: ClawdPresentationSource;
  priority: number;
  semanticId: string;
}

export interface ClawdVisualCapabilities {
  availablePresentationIds: ReadonlySet<string>;
  reducedMotion: boolean;
}
