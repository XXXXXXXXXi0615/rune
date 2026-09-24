import type { AgentActivityEvent } from '@/features/agentActivity/agentActivityTypes';
import { clawdRuntimeController } from './ClawdRuntimeController';
import type { ClawdNormalizedEvent } from './clawdRuntimeTypes';

export function emitClawdNormalizedEvent(event: ClawdNormalizedEvent) {
  clawdRuntimeController.receive(event);
}

export function bridgeAgentActivityEvent(event: AgentActivityEvent) {
  const timestamp = event.at ?? Date.now();
  const sessionId = event.requestId;
  if (event.type === 'request_started') {
    emitClawdNormalizedEvent({ type: 'session-start', sessionId, timestamp });
    emitClawdNormalizedEvent({ type: 'prompt-submit', sessionId, timestamp });
  } else if (event.type === 'tool_call_started') {
    emitClawdNormalizedEvent({ type: 'tool-start', sessionId, timestamp, toolId: event.toolId });
  } else if (event.type === 'tool_call_completed') {
    emitClawdNormalizedEvent({ type: 'tool-end', sessionId, timestamp, toolId: event.toolId });
  } else if (event.type === 'request_failed') {
    emitClawdNormalizedEvent({ type: 'tool-failure', sessionId, timestamp });
  } else if (event.type === 'request_completed') {
    emitClawdNormalizedEvent({ type: 'stop', sessionId, timestamp });
  } else if (event.type === 'request_aborted') {
    emitClawdNormalizedEvent({ type: 'session-end', sessionId, timestamp });
  }
}
