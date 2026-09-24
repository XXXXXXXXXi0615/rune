import { describe, expect, it } from 'vitest';
import { ClawdRuntimeController } from './ClawdRuntimeController';
import type { ClawdNormalizedEventType } from './clawdRuntimeTypes';

const send = (controller: ClawdRuntimeController, type: ClawdNormalizedEventType, sessionId = 'a', timestamp = 1, extra: { toolId?: string; subagentId?: string } = {}) =>
  controller.receive({ type, sessionId, timestamp, ...extra });

describe('CLAWD runtime arbitration', () => {
  it('A: has an idle empty snapshot', () => {
    expect(new ClawdRuntimeController().getSnapshot()).toMatchObject({ runtimeState: 'idle', sourceSessionId: null });
  });

  it.each([
    ['prompt-submit', 'thinking'], ['tool-failure', 'error'], ['permission-request', 'notification'],
    ['compact-start', 'sweeping'], ['compact-end', 'thinking'], ['stop', 'attention'], ['worktree-create', 'carrying'],
  ] as const)('%s maps to %s', (type, state) => {
    const controller = new ClawdRuntimeController();
    send(controller, type);
    expect(controller.getSnapshot().runtimeState).toBe(state);
  });

  it('maps one, two and three live working sessions to typing, groove and building', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'tool-start', 'a', 1);
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'working', workingTier: 'typing' });
    send(controller, 'session-start', 'b', 2); send(controller, 'tool-start', 'b', 3);
    expect(controller.getSnapshot().workingTier).toBe('groove');
    send(controller, 'session-start', 'c', 4); send(controller, 'tool-start', 'c', 5);
    expect(controller.getSnapshot().workingTier).toBe('building');
  });

  it('maps one and two live subagents to single and multi', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'subagent-start', 'a', 1, { subagentId: 'one' });
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'juggling', jugglingTier: 'single' });
    send(controller, 'subagent-start', 'a', 2, { subagentId: 'two' });
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'juggling', jugglingTier: 'multi' });
  });

  it('honors error over notification and working over thinking', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'permission-request', 'notice', 1);
    send(controller, 'tool-failure', 'error', 2);
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'error', sourceSessionId: 'error' });
    controller.reset();
    send(controller, 'prompt-submit', 'think', 1); send(controller, 'tool-start', 'work', 2);
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'working', sourceSessionId: 'work' });
  });

  it('uses earliest startedAt for same priority regardless of insertion order', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'tool-start', 'later', 20); send(controller, 'tool-start', 'earlier', 10);
    expect(controller.getSnapshot().sourceSessionId).toBe('earlier');
  });

  it('removes ended sessions and returns idle after the last one', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'tool-start', 'a', 1); send(controller, 'prompt-submit', 'b', 2);
    send(controller, 'session-end', 'a', 3);
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'thinking', sourceSessionId: 'b' });
    send(controller, 'session-end', 'b', 4);
    expect(controller.getSnapshot()).toMatchObject({ runtimeState: 'idle', liveSessionCount: 0 });
  });

  it('returns to working or thinking when subagents stop', () => {
    const controller = new ClawdRuntimeController();
    send(controller, 'tool-start', 'a', 1, { toolId: 'tool' });
    send(controller, 'subagent-start', 'a', 2, { subagentId: 'child' });
    send(controller, 'subagent-stop', 'a', 3, { subagentId: 'child' });
    expect(controller.getSnapshot().runtimeState).toBe('working');
    send(controller, 'tool-end', 'a', 4, { toolId: 'tool' });
    expect(controller.getSnapshot().runtimeState).toBe('thinking');
  });
});
