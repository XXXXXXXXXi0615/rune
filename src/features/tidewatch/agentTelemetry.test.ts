import { describe, expect, it } from 'vitest';
import { normalizeAgentTelemetry, selectActiveAgentRuns, selectAgentDailySummary, selectAgentRuns, selectAgentSources, selectAgentTimeline } from './agentTelemetry';
import type { ActivityEvent, NormalizedAgentTelemetryEvent, WritingTelemetryEvent } from './types';
import { todayStats } from './aggregation';

const now = new Date().setHours(12, 0, 0, 0);
const fixture = (id: string, timestamp: number, kind: NormalizedAgentTelemetryEvent['kind'], metadata = {}, sourceId = 'codex-local'): ActivityEvent => normalizeAgentTelemetry({ id, timestamp, sourceId, sourceKind: 'codex', agentId: 'agent-a', runId: 'run-1', kind, title: `${kind} event`, metadata });

describe('agent telemetry foundation', () => {
  it('normalizes a deterministic namespaced event with provider/model metadata', () => {
    const event = fixture('external-1', now, 'run_start', { provider: 'OpenAI', model: 'gpt-test' });
    expect(event).toMatchObject({ id: 'agent:codex:codex-local:external-1', type: 'run_start', sourceId: 'codex-local', sourceKind: 'codex', metadata: { provider: 'OpenAI', model: 'gpt-test' } });
  });

  it('redacts secrets and drops hidden reasoning/user payload fields', () => {
    const input = { id: 'secret', timestamp: now, sourceId: 'local', sourceKind: 'external' as const, kind: 'command' as const, title: 'curl token=abc123', metadata: { resultSummary: 'authorization: BearerValue', reasoning: 'hidden', prompt: 'raw user text', apiKey: 'key' } } as unknown as NormalizedAgentTelemetryEvent;
    const event = normalizeAgentTelemetry(input);
    expect(JSON.stringify(event)).not.toContain('abc123');
    expect(JSON.stringify(event)).not.toContain('BearerValue');
    expect(JSON.stringify(event)).not.toContain('hidden');
    expect(JSON.stringify(event)).not.toContain('raw user text');
    expect(event.title).toContain('[REDACTED]');
  });

  it('orders deterministically and separates sources', () => {
    const a = fixture('b', now, 'tool_call');
    const b = fixture('a', now, 'run_start', {}, 'codex-other');
    expect(selectAgentTimeline([a, b]).map((event) => event.id)).toEqual([a.id, b.id]);
    expect(selectAgentSources([a, b])).toHaveLength(2);
  });

  it('projects start/end, active state, metrics, tests and failed runs', () => {
    const events = [
      fixture('1', now - 5000, 'run_start'), fixture('2', now - 4000, 'tool_call'),
      fixture('3', now - 3000, 'file_change'), fixture('4', now - 2000, 'test', { testPassed: 7, testFailed: 1 }),
    ];
    expect(selectActiveAgentRuns(events)).toHaveLength(1);
    expect(selectAgentRuns(events)[0]).toMatchObject({ status: 'running', toolCount: 1, fileChangeCount: 1, testPassed: 7, testFailed: 1 });
    const failed = [...events, fixture('5', now - 1000, 'error'), fixture('6', now, 'run_end', { exitCode: 1, durationMs: 5000 })];
    expect(selectActiveAgentRuns(failed)).toHaveLength(0);
    expect(selectAgentRuns(failed)[0]).toMatchObject({ status: 'failed', durationMs: 5000 });
  });

  it('aggregates today without persisting counters', () => {
    const events = [fixture('1', now - 5000, 'run_start'), fixture('2', now - 4000, 'tool_call'), fixture('3', now - 3000, 'file_change'), fixture('4', now - 2000, 'test', { testPassed: 2, testFailed: 1 }), fixture('5', now, 'run_end', { exitCode: 0 })];
    expect(selectAgentDailySummary(events, now)).toEqual({ runs: 1, completed: 1, failed: 0, tools: 1, files: 1, tests: 3 });
  });

  it('does not interfere with USER writing selectors', () => {
    const writing: WritingTelemetryEvent[] = [{ id: 'w', timestamp: now, actor: 'user', surface: 'chat', inputChars: 12, committedChars: 10 }];
    const before = todayStats(writing);
    selectAgentDailySummary([fixture('1', now, 'run_start')], now);
    expect(todayStats(writing)).toEqual(before);
  });
});
