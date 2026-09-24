import { describe, expect, it } from 'vitest';
import { applyCodexBridgeFrame, codexBridgeStatus, deriveCodexBridgeDisplayState, mapCodexRelayEvent, reconnectDelay, setCodexBridgeDisconnected, validateRelayFrame, type RelayEvent } from './codexTelemetryBridge';

const event = (type: RelayEvent['type'], extra: Partial<RelayEvent> = {}): RelayEvent => ({ version: 1, id: 'stable-id', type, source: 'codex', timestamp: 100, sessionId: 'session-1', turnId: 'turn-1', ...extra });

describe('Codex telemetry bridge mapping', () => {
  it.each([
    ['session.started', ['run_start']], ['turn.started', ['run_start']], ['tool.started', ['tool_call']],
    ['task.completed', ['run_end']], ['session.ended', ['run_end']], ['task.failed', ['error', 'run_end']],
  ] as const)('maps %s', (type, kinds) => expect(mapCodexRelayEvent(event(type)).map((item) => item.kind)).toEqual(kinds));

  it('maps allowlisted tool completion categories without guessing paths or output', () => {
    expect(mapCodexRelayEvent(event('tool.completed', { toolCategory: 'edit' }))[0]).toMatchObject({ kind: 'file_change', sourceKind: 'codex', sourceId: 'codex', sessionId: 'session-1', runId: 'turn-1' });
    expect(mapCodexRelayEvent(event('tool.completed', { toolCategory: 'test' }))[0].kind).toBe('test');
    expect(mapCodexRelayEvent(event('tool.completed', { toolCategory: 'shell' }))[0].kind).toBe('result');
  });

  it('drops thinking and heartbeat from canonical telemetry', () => {
    expect(mapCodexRelayEvent(event('thinking'))).toEqual([]);
    expect(mapCodexRelayEvent(event('heartbeat'))).toEqual([]);
  });

  it('derives deterministic IDs for hook random fallbacks and keeps stable IDs', () => {
    const fallback = event('tool.started', { id: 'codex:100:abcdefgh' });
    expect(mapCodexRelayEvent(fallback)[0].id).toBe(mapCodexRelayEvent(fallback)[0].id);
    expect(mapCodexRelayEvent(fallback)[0].id).toMatch(/^derived:/);
    expect(mapCodexRelayEvent(event('tool.started'))[0].id).toBe('stable-id');
  });

  it('rejects malformed and unsafe frames', () => {
    expect(validateRelayFrame({ kind: 'activity', event: { ...event('tool.started'), prompt: 'secret' } })).toBeNull();
    expect(validateRelayFrame({ kind: 'activity', event: { ...event('tool.started'), id: 'bad id' } })).toBeNull();
    expect(validateRelayFrame({ kind: 'wat' })).toBeNull();
  });

  it('uses bounded exponential reconnect backoff', () => {
    expect([0, 1, 2, 8].map(reconnectDelay)).toEqual([1000, 2000, 4000, 30000]);
  });

  it('keeps transport status ephemeral across connected, heartbeat, and disconnected transitions', async () => {
    await applyCodexBridgeFrame({ kind: 'connected', protocol: 1, hookStatus: 'installed' });
    expect(codexBridgeStatus.getSnapshot()).toMatchObject({ connected: true, hookStatus: 'installed' });
    await applyCodexBridgeFrame({ kind: 'heartbeat', timestamp: 900 });
    expect(codexBridgeStatus.getSnapshot().lastHeartbeatAt).toBe(900);
    expect(deriveCodexBridgeDisplayState(codexBridgeStatus.getSnapshot(), 901)).toBe('live');
    setCodexBridgeDisconnected('websocket_unavailable');
    expect(codexBridgeStatus.getSnapshot()).toMatchObject({ connected: false, lastError: 'websocket_unavailable' });
  });
});
