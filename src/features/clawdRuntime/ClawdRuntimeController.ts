import { deriveClawdRuntimeSnapshot } from './clawdRuntimeArbiter';
import type { ClawdNormalizedEvent, ClawdRuntimeSnapshot, ClawdRuntimeState, ClawdSession } from './clawdRuntimeTypes';

const EMPTY = new Set<string>();

export class ClawdRuntimeController {
  private readonly sessions = new Map<string, ClawdSession>();
  private snapshot: ClawdRuntimeSnapshot = deriveClawdRuntimeSnapshot([]);
  private readonly listeners = new Set<() => void>();

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  receive(event: ClawdNormalizedEvent) {
    if (event.type === 'session-end') {
      this.sessions.delete(event.sessionId);
      this.publish();
      return;
    }
    const previous = this.sessions.get(event.sessionId) ?? {
      sessionId: event.sessionId,
      startedAt: event.timestamp,
      lastActivityAt: event.timestamp,
      runtimeIntent: 'idle' as ClawdRuntimeState,
      activeToolIds: EMPTY,
      liveSubagentIds: EMPTY,
      error: false,
      permissionPending: false,
    };
    const tools = new Set(previous.activeToolIds);
    const subagents = new Set(previous.liveSubagentIds);
    let runtimeIntent = previous.runtimeIntent;
    let error = previous.error;
    let permissionPending = previous.permissionPending;
    const toolId = event.toolId ?? `${event.sessionId}:tool`;
    const subagentId = event.subagentId ?? `${event.sessionId}:subagent`;

    switch (event.type) {
      case 'session-start': runtimeIntent = 'idle'; error = false; permissionPending = false; tools.clear(); subagents.clear(); break;
      case 'prompt-submit': runtimeIntent = 'thinking'; error = false; permissionPending = false; break;
      case 'tool-start': tools.add(toolId); runtimeIntent = 'working'; break;
      case 'tool-end': tools.delete(toolId); runtimeIntent = tools.size ? 'working' : 'thinking'; break;
      case 'tool-failure': tools.delete(toolId); runtimeIntent = 'error'; error = true; break;
      case 'stop': runtimeIntent = 'attention'; tools.clear(); break;
      case 'compact-start': runtimeIntent = 'sweeping'; break;
      case 'compact-end': runtimeIntent = 'thinking'; break;
      case 'permission-request': runtimeIntent = 'notification'; permissionPending = true; break;
      case 'subagent-start': subagents.add(subagentId); runtimeIntent = 'juggling'; break;
      case 'subagent-stop': subagents.delete(subagentId); runtimeIntent = subagents.size ? 'juggling' : (tools.size ? 'working' : 'thinking'); break;
      case 'worktree-create': runtimeIntent = 'carrying'; break;
    }
    this.sessions.set(event.sessionId, { ...previous, startedAt: event.type === 'session-start' ? event.timestamp : previous.startedAt, lastActivityAt: event.timestamp, runtimeIntent, activeToolIds: tools, liveSubagentIds: subagents, error, permissionPending });
    this.publish();
  }

  reset() { this.sessions.clear(); this.publish(); }
  getSessions() { return new Map(this.sessions); }

  private publish() {
    this.snapshot = deriveClawdRuntimeSnapshot(this.sessions.values());
    this.listeners.forEach((listener) => listener());
  }
}

export const clawdRuntimeController = new ClawdRuntimeController();
