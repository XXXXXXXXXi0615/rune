import type { ClawdRuntimeSnapshot, ClawdRuntimeState } from './clawdRuntimeTypes';
import type { ClawdPresentationIntent, ClawdVisualCapabilities } from './clawdVisualTypes';

export const CLAWD_NEUTRAL_PRESENTATION = 'companion-neutral-static';

const PRIORITY: Record<ClawdRuntimeState, number> = {
  sleeping: 0, idle: 1, thinking: 2, working: 3, juggling: 4,
  carrying: 4, attention: 5, sweeping: 6, notification: 7, error: 8,
};

const CATEGORY_FALLBACK: Partial<Record<ClawdRuntimeState, string>> = {
  thinking: 'clawd-thinking', working: 'clawd-tool-use', juggling: 'clawd-tool-use',
  error: 'clawd-error', attention: 'clawd-success', notification: 'clawd-notification',
  sweeping: 'clawd-cleaning-system', carrying: 'clawd-carrying', sleeping: 'clawd-sleeping',
};

const EXACT: Partial<Record<ClawdRuntimeState, string>> = {
  thinking: 'clawd-thinking', error: 'clawd-error', attention: 'clawd-success',
  notification: 'clawd-notification', sweeping: 'clawd-cleaning-system',
  carrying: 'clawd-carrying', sleeping: 'clawd-sleeping',
};

const FINITE: Partial<Record<ClawdRuntimeState, number>> = {
  attention: 4_000, error: 5_000, notification: 5_000, carrying: 3_000, sweeping: 300_000,
};

function exactPresentation(snapshot: ClawdRuntimeSnapshot) {
  if (snapshot.runtimeState === 'working') {
    return snapshot.workingTier === 'building' ? 'clawd-tool-use'
      : snapshot.workingTier === 'groove' ? 'clawd-groove' : 'clawd-typing';
  }
  if (snapshot.runtimeState === 'juggling') {
    return snapshot.jugglingTier === 'multi' ? 'clawd-random' : 'clawd-groove';
  }
  return EXACT[snapshot.runtimeState];
}

export function resolveClawdPresentation(snapshot: ClawdRuntimeSnapshot, capabilities: ClawdVisualCapabilities): ClawdPresentationIntent | null {
  if (snapshot.runtimeState === 'idle') return null;
  const exact = exactPresentation(snapshot);
  const category = CATEGORY_FALLBACK[snapshot.runtimeState];
  const presentationId = capabilities.reducedMotion ? CLAWD_NEUTRAL_PRESENTATION
    : exact && capabilities.availablePresentationIds.has(exact) ? exact
    : category && capabilities.availablePresentationIds.has(category) ? category
    : CLAWD_NEUTRAL_PRESENTATION;
  const dwellMs = FINITE[snapshot.runtimeState];
  return {
    presentationId,
    runtimeState: snapshot.runtimeState,
    lifecycle: dwellMs ? 'finite' : 'continuous',
    ...(dwellMs ? { dwellMs } : {}),
    interruptible: true,
    fallbackPresentationId: CLAWD_NEUTRAL_PRESENTATION,
    source: 'runtime',
    priority: PRIORITY[snapshot.runtimeState],
    semanticId: [snapshot.runtimeState, snapshot.workingTier, snapshot.jugglingTier, presentationId, capabilities.reducedMotion ? 'reduced' : 'motion'].filter(Boolean).join(':'),
  };
}
