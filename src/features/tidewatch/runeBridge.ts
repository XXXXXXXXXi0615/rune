/**
 * TIDEWATCH — Rune Writing Bridge.
 *
 * Pure derived function: input → presentation intent.
 * Rune must never consume raw text.
 *
 * Each numeric threshold may trigger only once within its intended scope.
 * Do not trigger on every keypress.
 * Do not modify global CLAWD runtime.
 */
import type { RuneBridgeInput, RuneBridgeOutput, RuneIntent } from './types';

// ---------------------------------------------------------------------------
// Threshold constants
// ---------------------------------------------------------------------------

const SESSION_PROUD_THRESHOLD = 200;
const DAILY_PROUD_THRESHOLD = 5_000;

// Per-scope "already fired" tracking (within a single bridge evaluation cycle)
let lastSessionFiredAt = 0;
let lastDailyFiredAt = 0;
let lastMilestoneFiredAt = 0;

/**
 * Reset threshold tracking (call on new session or new day).
 */
export function resetRuneBridgeThresholds(): void {
  lastSessionFiredAt = 0;
  lastDailyFiredAt = 0;
  lastMilestoneFiredAt = 0;
}

// ---------------------------------------------------------------------------
// Pure bridge function
// ---------------------------------------------------------------------------

/**
 * Derive a presentation intent from writing telemetry signals.
 *
 * Priority:
 *   1. milestone → finite special reaction
 *   2. session threshold → finite pleased reaction
 *   3. daily threshold → finite received/pleased reaction
 *   4. typing paused → curious / paused
 *   5. typing → typing
 *   6. focused → focused
 *   7. idle
 */
export function deriveRuneIntent(input: RuneBridgeInput): RuneBridgeOutput {
  const now = Date.now();

  // Milestone (highest priority)
  if (input.newMilestone && now - lastMilestoneFiredAt > 60_000) {
    lastMilestoneFiredAt = now;
    return { intent: 'milestone-pleased', reason: '新的里程碑達成' };
  }

  // Session chars crossed
  if (
    input.currentSessionChars >= SESSION_PROUD_THRESHOLD &&
    now - lastSessionFiredAt > 120_000
  ) {
    lastSessionFiredAt = now;
    return { intent: 'session-proud', reason: `本次已寫 ${input.currentSessionChars} 字` };
  }

  // Daily chars crossed
  if (
    input.todayUserChars >= DAILY_PROUD_THRESHOLD &&
    now - lastDailyFiredAt > 300_000
  ) {
    lastDailyFiredAt = now;
    return { intent: 'daily-proud', reason: `今日已寫 ${input.todayUserChars} 字` };
  }

  // Typing states
  if (input.isTyping) {
    if (input.typingPaused) {
      return { intent: 'paused', reason: '輸入暫停' };
    }
    return { intent: 'typing', reason: '正在輸入' };
  }

  if (input.isFocused) {
    return { intent: 'focused', reason: '專注中' };
  }

  return { intent: 'idle' };
}

/**
 * Format a Rune intent into a human-readable Chinese label.
 */
export function formatRuneIntent(intent: RuneIntent): string {
  switch (intent) {
    case 'idle': return '閒置';
    case 'focused': return '專注';
    case 'typing': return '書寫中';
    case 'paused': return '思考中';
    case 'session-proud': return '書寫成就';
    case 'daily-proud': return '今日里程碑';
    case 'milestone-received': return '里程碑達成';
    case 'milestone-pleased': return '里程碑達成';
    case 'curious': return '好奇';
  }
}

/**
 * Format a Rune intent into a brief description for presentation.
 */
export function describeRuneIntent(output: RuneBridgeOutput): string {
  return output.reason ?? formatRuneIntent(output.intent);
}
