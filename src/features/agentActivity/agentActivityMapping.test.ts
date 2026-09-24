import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityForEvent, labelForActivity, orbStateForActivity } from './agentActivityMapping';
import { emitAgentActivity, resetAgentActivity, useAgentActivityStore } from './agentActivityState';

describe('agent activity mapping', () => {
  it.each([
    ['voice_listening', 'listening'],
    ['memory_retrieval_started', 'searching'],
    ['web_search_started', 'searching'],
    ['planning_started', 'solving'],
    ['tool_call_started', 'working'],
    ['response_stream_started', 'composing'],
    ['structured_output', 'shaping'],
  ] as const)('maps %s to %s', (event, activity) => {
    expect(activityForEvent(event)).toBe(activity);
    expect(orbStateForActivity(activity)).toBe(activity);
    expect(labelForActivity(activity)).toBeTruthy();
  });

  it('does not render idle or error as an orb', () => {
    expect(orbStateForActivity('idle')).toBeNull();
    expect(orbStateForActivity('error')).toBeNull();
  });
});

describe('agent activity lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAgentActivity();
  });

  afterEach(() => {
    resetAgentActivity();
    vi.useRealTimers();
  });

  it('ignores stale request events when a new request owns the indicator', () => {
    emitAgentActivity({ type: 'request_started', requestId: 'old', at: 0 });
    emitAgentActivity({ type: 'request_started', requestId: 'new', at: 10 });
    emitAgentActivity({ type: 'memory_retrieval_started', requestId: 'old', at: 20 });
    expect(useAgentActivityStore.getState().requestId).toBe('new');
    expect(useAgentActivityStore.getState().activity).toBe('working');
  });

  it('keeps tool activity visible across the first body token', () => {
    emitAgentActivity({ type: 'request_started', requestId: 'r1', at: 0 });
    emitAgentActivity({ type: 'tool_call_started', requestId: 'r1', toolId: 'tool-1', at: 10 });
    emitAgentActivity({ type: 'first_body_token', requestId: 'r1', at: 20 });
    vi.advanceTimersByTime(200);
    expect(useAgentActivityStore.getState().activity).toBe('working');
  });

  it('fades after the first token when no tool is active', () => {
    emitAgentActivity({ type: 'request_started', requestId: 'r1', at: 0 });
    emitAgentActivity({ type: 'response_stream_started', requestId: 'r1', at: 20 });
    emitAgentActivity({ type: 'first_body_token', requestId: 'r1', at: 30 });
    vi.advanceTimersByTime(149);
    expect(useAgentActivityStore.getState().activity).toBe('composing');
    vi.advanceTimersByTime(1);
    expect(useAgentActivityStore.getState().activity).toBe('idle');
  });

  it('returns to idle after abort without accepting stale completion', () => {
    emitAgentActivity({ type: 'request_started', requestId: 'r1', at: 0 });
    emitAgentActivity({ type: 'request_aborted', requestId: 'r1', at: 300 });
    vi.runAllTimers();
    expect(useAgentActivityStore.getState().activity).toBe('idle');
    expect(useAgentActivityStore.getState().requestId).toBeNull();
  });
});
