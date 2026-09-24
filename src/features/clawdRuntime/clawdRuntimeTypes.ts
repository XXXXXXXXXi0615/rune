export type ClawdRuntimeState =
  | 'idle' | 'thinking' | 'working' | 'juggling' | 'error'
  | 'attention' | 'notification' | 'sweeping' | 'carrying' | 'sleeping';

export type ClawdWorkingTier = 'typing' | 'groove' | 'building';
export type ClawdJugglingTier = 'single' | 'multi';

export type ClawdNormalizedEventType =
  | 'session-start' | 'session-end' | 'prompt-submit'
  | 'tool-start' | 'tool-end' | 'tool-failure' | 'stop'
  | 'compact-start' | 'compact-end' | 'permission-request'
  | 'subagent-start' | 'subagent-stop' | 'worktree-create';

export interface ClawdNormalizedEvent {
  type: ClawdNormalizedEventType;
  sessionId: string;
  timestamp: number;
  toolId?: string;
  subagentId?: string;
}

export interface ClawdSession {
  sessionId: string;
  startedAt: number;
  lastActivityAt: number;
  runtimeIntent: ClawdRuntimeState;
  activeToolIds: ReadonlySet<string>;
  liveSubagentIds: ReadonlySet<string>;
  error: boolean;
  permissionPending: boolean;
}

export interface ClawdRuntimeSnapshot {
  runtimeState: ClawdRuntimeState;
  sourceSessionId: string | null;
  workingTier?: ClawdWorkingTier;
  jugglingTier?: ClawdJugglingTier;
  liveSessionCount: number;
  subagentCount: number;
}
