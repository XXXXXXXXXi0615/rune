import { ingestAgentTelemetry } from './activityLedgerStore';
import type { AgentTelemetryKind, NormalizedAgentTelemetryEvent } from './types';

type HookType = 'session.started' | 'session.ended' | 'turn.started' | 'tool.started' | 'tool.completed' | 'task.completed' | 'task.failed';
type ToolCategory = 'read' | 'search' | 'edit' | 'shell' | 'test' | 'build' | 'other';
export interface RelayEvent { version: 1; id: string; type: HookType | 'thinking' | 'heartbeat'; source: 'codex'; timestamp: number; sessionId?: string; turnId?: string; toolCategory?: ToolCategory }
type RelayFrame = { kind: 'connected'; protocol: 1; hookStatus: string } | { kind: 'heartbeat'; timestamp: number } | { kind: 'activity'; event: RelayEvent };

export interface CodexBridgeStatus { connected: boolean; hookStatus: string; lastHeartbeatAt?: number; lastError?: string }
export type CodexBridgeDisplayState = 'live' | 'disconnected' | 'failed';
let status: CodexBridgeStatus = { connected: false, hookStatus: 'unknown' };
const listeners = new Set<() => void>();
const publish = (next: CodexBridgeStatus) => { status = next; listeners.forEach((listener) => listener()); };
export const codexBridgeStatus = { getSnapshot: () => status, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
export function deriveCodexBridgeDisplayState(value: CodexBridgeStatus, now = Date.now()): CodexBridgeDisplayState {
  if (value.hookStatus === 'error' || (value.lastError && value.lastError !== 'websocket_unavailable')) return 'failed';
  if (value.connected && value.hookStatus === 'installed' && value.lastHeartbeatAt != null && now - value.lastHeartbeatAt <= 15_000) return 'live';
  return 'disconnected';
}

const SAFE_ID = /^[a-zA-Z0-9._:-]{1,96}$/;
const FALLBACK_ID = /^codex:\d+:[a-z0-9]{8}$/;
const RELAY_TYPES = new Set(['session.started', 'session.ended', 'turn.started', 'tool.started', 'tool.completed', 'task.completed', 'task.failed', 'thinking', 'heartbeat']);
const TOOL_CATEGORIES = new Set(['read', 'search', 'edit', 'shell', 'test', 'build', 'other']);
function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
export function validateRelayFrame(input: unknown): RelayFrame | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const frame = input as Record<string, unknown>;
  if (frame.kind === 'connected' && frame.protocol === 1 && typeof frame.hookStatus === 'string') return frame as unknown as RelayFrame;
  if (frame.kind === 'heartbeat' && Number.isFinite(frame.timestamp)) return frame as unknown as RelayFrame;
  if (frame.kind !== 'activity' || !frame.event || typeof frame.event !== 'object') return null;
  const event = frame.event as Record<string, unknown>;
  const keys = new Set(['version', 'id', 'type', 'source', 'timestamp', 'sessionId', 'turnId', 'toolCategory']);
  if (Object.keys(event).some((key) => !keys.has(key)) || event.version !== 1 || event.source !== 'codex' || typeof event.id !== 'string' || !SAFE_ID.test(event.id) || typeof event.type !== 'string' || !RELAY_TYPES.has(event.type) || !Number.isFinite(event.timestamp)) return null;
  if (event.sessionId !== undefined && (typeof event.sessionId !== 'string' || !SAFE_ID.test(event.sessionId))) return null;
  if (event.turnId !== undefined && (typeof event.turnId !== 'string' || !SAFE_ID.test(event.turnId))) return null;
  if (event.toolCategory !== undefined && (typeof event.toolCategory !== 'string' || !TOOL_CATEGORIES.has(event.toolCategory))) return null;
  return frame as unknown as RelayFrame;
}

function mappedId(event: RelayEvent, suffix = ''): string {
  if (!FALLBACK_ID.test(event.id)) return `${event.id}${suffix}`;
  return `derived:${stableHash(['codex', 'codex', event.sessionId ?? '', event.turnId ?? '', event.type, event.timestamp, suffix].join('|'))}`;
}
function mapped(event: RelayEvent, kind: AgentTelemetryKind, title: string, suffix = '', metadata?: NormalizedAgentTelemetryEvent['metadata']): NormalizedAgentTelemetryEvent {
  return { id: mappedId(event, suffix), timestamp: event.timestamp, sourceKind: 'codex', sourceId: 'codex', sessionId: event.sessionId, runId: event.turnId ?? event.sessionId, kind, title, metadata };
}
export function mapCodexRelayEvent(event: RelayEvent): NormalizedAgentTelemetryEvent[] {
  if (event.type === 'thinking' || event.type === 'heartbeat') return [];
  if (event.type === 'session.started') return [mapped(event, 'run_start', 'Codex session started')];
  if (event.type === 'turn.started') return [mapped(event, 'run_start', 'Codex turn started')];
  if (event.type === 'tool.started') return [mapped(event, 'tool_call', `Codex ${event.toolCategory ?? 'tool'} started`, '', { toolName: event.toolCategory })];
  if (event.type === 'tool.completed') {
    if (event.toolCategory === 'edit') return [mapped(event, 'file_change', 'Codex file change completed', '', { toolName: 'edit' })];
    if (event.toolCategory === 'test' || event.toolCategory === 'build') return [mapped(event, 'test', `Codex ${event.toolCategory} completed`, '', { toolName: event.toolCategory })];
    return [mapped(event, 'result', `Codex ${event.toolCategory ?? 'tool'} completed`, '', { toolName: event.toolCategory })];
  }
  if (event.type === 'task.completed') return [mapped(event, 'run_end', 'Codex task completed', '', { exitCode: 0 })];
  if (event.type === 'task.failed') return [mapped(event, 'error', 'Codex task failed', ':error'), mapped(event, 'run_end', 'Codex task ended', ':end', { exitCode: 1 })];
  return [mapped(event, 'run_end', 'Codex session ended', '', { exitCode: 0 })];
}

export function reconnectDelay(attempt: number): number { return Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt))); }

export async function applyCodexBridgeFrame(frame: RelayFrame): Promise<void> {
  if (frame.kind === 'connected') { publish({ ...status, connected: true, hookStatus: frame.hookStatus, lastError: undefined }); return; }
  if (frame.kind === 'heartbeat') { publish({ ...status, connected: true, lastHeartbeatAt: frame.timestamp }); return; }
  for (const event of mapCodexRelayEvent(frame.event)) await ingestAgentTelemetry(event);
}
export function setCodexBridgeDisconnected(lastError?: string): void { publish({ ...status, connected: false, ...(lastError ? { lastError } : {}) }); }

export function connectCodexTelemetryBridge(url?: string): () => void {
  if (!import.meta.env.DEV || typeof WebSocket === 'undefined') return () => {};
  const relayUrl = url ?? (window as Window & { __TIDEWATCH_CODEX_RELAY_URL__?: string }).__TIDEWATCH_CODEX_RELAY_URL__ ?? 'ws://127.0.0.1:47831/events';
  let socket: WebSocket | null = null; let stopped = false; let attempt = 0; let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (stopped) return;
    socket = new WebSocket(relayUrl);
    socket.onopen = () => { attempt = 0; publish({ ...status, connected: true, lastError: undefined }); };
    socket.onmessage = async ({ data }) => {
      let parsed: unknown; try { parsed = JSON.parse(String(data)); } catch { publish({ ...status, lastError: 'malformed_frame' }); return; }
      const frame = validateRelayFrame(parsed); if (!frame) { publish({ ...status, lastError: 'malformed_frame' }); return; }
      await applyCodexBridgeFrame(frame);
    };
    socket.onerror = () => setCodexBridgeDisconnected('websocket_unavailable');
    socket.onclose = () => { setCodexBridgeDisconnected(); if (!stopped) timer = setTimeout(connect, reconnectDelay(attempt++)); };
  };
  connect();
  return () => { stopped = true; if (timer) clearTimeout(timer); socket?.close(); socket = null; };
}
