import type {
  ActivityEvent,
  AgentSourceKind,
  AgentTelemetryKind,
  AgentTelemetryMetadata,
  NormalizedAgentTelemetryEvent,
} from './types';

const KINDS = new Set<AgentTelemetryKind>(['run_start', 'run_end', 'tool_call', 'command', 'file_change', 'test', 'result', 'error']);
const SOURCES = new Set<AgentSourceKind>(['codex', 'lunartide', 'external']);
const SECRET_PATTERN = /(api[_-]?key|authorization|bearer|password|passwd|secret|token|credential)\s*[:=]\s*([^\s,;]+)/gi;
const PRIVATE_KEYS = new Set(['reasoning', 'chainOfThought', 'chain_of_thought', 'prompt', 'content', 'userText', 'message', 'apiKey', 'credential', 'secret', 'token']);

export interface AgentSourceProjection {
  key: string;
  sourceId: string;
  sourceKind: AgentSourceKind;
  agentId?: string;
  provider?: string;
  model?: string;
  status: 'running' | 'ready' | 'failed';
  lastSeenAt: number;
}

export interface AgentRunProjection {
  key: string;
  sourceId: string;
  sourceKind: AgentSourceKind;
  agentId?: string;
  runId: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'completed' | 'failed';
  toolCount: number;
  fileChangeCount: number;
  testPassed: number;
  testFailed: number;
  durationMs: number;
}

export interface AgentDailySummary {
  runs: number;
  completed: number;
  failed: number;
  tools: number;
  files: number;
  tests: number;
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(SECRET_PATTERN, '$1=[REDACTED]').replace(/[\r\n\t]+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeAgentTelemetry(input: NormalizedAgentTelemetryEvent): ActivityEvent {
  if (!input || typeof input !== 'object') throw new Error('Agent telemetry event is required');
  if (!KINDS.has(input.kind)) throw new Error('Unsupported agent telemetry kind');
  if (!SOURCES.has(input.sourceKind)) throw new Error('Unsupported agent source kind');
  const externalId = cleanText(input.id, 160);
  const sourceId = cleanText(input.sourceId, 120);
  const title = cleanText(input.title, 240);
  if (!externalId || !sourceId || !title || !Number.isFinite(input.timestamp)) throw new Error('Invalid agent telemetry identity');
  const metadataInput = input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } as Record<string, unknown> : {};
  for (const key of PRIVATE_KEYS) delete metadataInput[key];
  const metadata: AgentTelemetryMetadata = {
    provider: cleanText(metadataInput.provider, 80), model: cleanText(metadataInput.model, 120),
    toolName: cleanText(metadataInput.toolName, 120), filePath: cleanText(metadataInput.filePath, 500),
    exitCode: safeNumber(metadataInput.exitCode), durationMs: safeNumber(metadataInput.durationMs),
    testPassed: safeNumber(metadataInput.testPassed), testFailed: safeNumber(metadataInput.testFailed),
    resultSummary: cleanText(metadataInput.resultSummary, 300),
  };
  Object.keys(metadata).forEach((key) => { if (metadata[key as keyof AgentTelemetryMetadata] == null) delete metadata[key as keyof AgentTelemetryMetadata]; });
  return {
    id: `agent:${input.sourceKind}:${sourceId}:${externalId}`,
    timestamp: input.timestamp,
    type: input.kind,
    sourceId,
    sourceKind: input.sourceKind,
    agentId: cleanText(input.agentId, 120),
    sessionId: cleanText(input.sessionId, 160),
    runId: cleanText(input.runId, 160),
    title,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

export function isAgentActivityEvent(event: ActivityEvent): boolean {
  return Boolean(event.sourceId && event.sourceKind && KINDS.has(event.type as AgentTelemetryKind));
}

export function sortActivityEvents(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
}

export function selectAgentTimeline(events: ActivityEvent[]): ActivityEvent[] {
  return sortActivityEvents(events.filter(isAgentActivityEvent));
}

export function selectAgentRuns(events: ActivityEvent[]): AgentRunProjection[] {
  const timeline = [...selectAgentTimeline(events)].reverse();
  const runs = new Map<string, AgentRunProjection>();
  for (const event of timeline) {
    if (!event.runId || !event.sourceId || !event.sourceKind) continue;
    const key = `${event.sourceKind}:${event.sourceId}:${event.runId}`;
    let run = runs.get(key);
    if (!run) {
      run = { key, sourceId: event.sourceId, sourceKind: event.sourceKind, agentId: event.agentId, runId: event.runId, title: event.title ?? '未命名運行', startedAt: event.timestamp, status: 'running', toolCount: 0, fileChangeCount: 0, testPassed: 0, testFailed: 0, durationMs: 0 };
      runs.set(key, run);
    }
    if (event.type === 'run_start') { run.startedAt = event.timestamp; run.title = event.title ?? run.title; }
    if (event.type === 'tool_call') run.toolCount += 1;
    if (event.type === 'file_change') run.fileChangeCount += 1;
    if (event.type === 'test') { run.testPassed += event.metadata?.testPassed ?? 0; run.testFailed += event.metadata?.testFailed ?? 0; }
    if (event.type === 'error') run.status = 'failed';
    if (event.type === 'run_end') { run.endedAt = event.timestamp; run.status = (event.metadata?.exitCode ?? 0) === 0 && run.status !== 'failed' ? 'completed' : 'failed'; }
    run.durationMs = event.metadata?.durationMs ?? Math.max(0, (run.endedAt ?? Date.now()) - run.startedAt);
  }
  return [...runs.values()].sort((a, b) => b.startedAt - a.startedAt || a.key.localeCompare(b.key));
}

export function selectActiveAgentRuns(events: ActivityEvent[]): AgentRunProjection[] {
  return selectAgentRuns(events).filter((run) => run.status === 'running');
}

export function selectAgentSources(events: ActivityEvent[]): AgentSourceProjection[] {
  const sources = new Map<string, AgentSourceProjection>();
  const runs = selectAgentRuns(events);
  for (const event of selectAgentTimeline(events)) {
    const key = `${event.sourceKind}:${event.sourceId}:${event.agentId ?? ''}`;
    if (!sources.has(key)) sources.set(key, { key, sourceId: event.sourceId!, sourceKind: event.sourceKind!, agentId: event.agentId, provider: event.metadata?.provider, model: event.metadata?.model, status: 'ready', lastSeenAt: event.timestamp });
    const source = sources.get(key)!;
    source.provider ??= event.metadata?.provider;
    source.model ??= event.metadata?.model;
  }
  for (const source of sources.values()) {
    const related = runs.filter((run) => run.sourceId === source.sourceId && run.sourceKind === source.sourceKind && run.agentId === source.agentId);
    if (related.some((run) => run.status === 'running')) source.status = 'running';
    else if (related[0]?.status === 'failed') source.status = 'failed';
  }
  return [...sources.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.key.localeCompare(b.key));
}

export function selectAgentDailySummary(events: ActivityEvent[], now = Date.now()): AgentDailySummary {
  const day = new Date(now); day.setHours(0, 0, 0, 0); const from = day.getTime();
  const today = selectAgentTimeline(events).filter((event) => event.timestamp >= from && event.timestamp <= now);
  const runs = selectAgentRuns(today);
  return {
    runs: runs.length, completed: runs.filter((run) => run.status === 'completed').length,
    failed: runs.filter((run) => run.status === 'failed').length,
    tools: today.filter((event) => event.type === 'tool_call').length,
    files: today.filter((event) => event.type === 'file_change').length,
    tests: today.filter((event) => event.type === 'test').reduce((sum, event) => sum + (event.metadata?.testPassed ?? 0) + (event.metadata?.testFailed ?? 0), 0),
  };
}
