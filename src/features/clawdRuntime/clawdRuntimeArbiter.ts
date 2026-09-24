import type { ClawdRuntimeSnapshot, ClawdRuntimeState, ClawdSession } from './clawdRuntimeTypes';

const PRIORITY: Record<ClawdRuntimeState, number> = {
  sleeping: 0, idle: 1, thinking: 2, working: 3, juggling: 4,
  carrying: 4, attention: 5, sweeping: 6, notification: 7, error: 8,
};

export function deriveClawdRuntimeSnapshot(sessions: Iterable<ClawdSession>): ClawdRuntimeSnapshot {
  const live = [...sessions];
  const liveSessionCount = live.length;
  const subagentCount = live.reduce((total, session) => total + session.liveSubagentIds.size, 0);
  let owner: ClawdSession | undefined;
  for (const session of live) {
    if (!owner || PRIORITY[session.runtimeIntent] > PRIORITY[owner.runtimeIntent]
      || (PRIORITY[session.runtimeIntent] === PRIORITY[owner.runtimeIntent] && session.startedAt < owner.startedAt)) {
      owner = session;
    }
  }
  if (!owner) return { runtimeState: 'idle', sourceSessionId: null, liveSessionCount: 0, subagentCount: 0 };
  const runtimeState = owner.runtimeIntent;
  return {
    runtimeState,
    sourceSessionId: owner.sessionId,
    liveSessionCount,
    subagentCount,
    ...(runtimeState === 'working' ? { workingTier: liveSessionCount >= 3 ? 'building' : liveSessionCount === 2 ? 'groove' : 'typing' } : {}),
    ...(runtimeState === 'juggling' ? { jugglingTier: subagentCount >= 2 ? 'multi' : 'single' } : {}),
  };
}
