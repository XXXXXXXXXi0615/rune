import { sendChatMessage } from '@/ai/client';
import { resolveProviderRequestConfig, resolveActiveProvider } from '@/ai/providerRuntime';
import { AIProviderHttpError, type StreamChunk } from '@/ai/types';
import type { ProviderConfig } from '@/types';
import { validateTideRailDecision, type TideRailProposal, type TideRailDecision } from '@/store/useTideRailStore';

export type TideRailProviderErrorType =
  | 'not_configured'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'offline'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'aborted'
  | 'unknown';

export interface TideRailProviderError {
  type: TideRailProviderErrorType;
  message: string;
  retryAfter?: string;
}

export interface TideRailRuntimeDiagnostic {
  providerId: string;
  modelId: string;
  startedAt: number;
  responseStatus?: number;
  responseContentType?: string;
  durationMs: number;
  aborted: boolean;
  timeout: boolean;
  parsedVerdict?: TideRailDecision['verdict'];
  schemaValid: boolean;
  safeErrorType?: TideRailProviderErrorType;
}

export interface TideRailProviderFailureAudit {
  proposalId: string;
  providerId?: string;
  modelId?: string;
  type: TideRailProviderErrorType;
  retryAfter?: string;
  occurredAt: number;
}

const FAILURE_KEY = 'lunartide-tiderail-provider-failures-v1';
const diagnostics = new Set<(entry: TideRailRuntimeDiagnostic) => void>();
let latestRuntimeGeneration = 0;

export function subscribeTideRailRuntimeDiagnostics(listener: (entry: TideRailRuntimeDiagnostic) => void) {
  diagnostics.add(listener);
  return () => diagnostics.delete(listener);
}

function publishDiagnostic(entry: TideRailRuntimeDiagnostic) {
  if (!import.meta.env.DEV && !import.meta.env.TEST) return;
  diagnostics.forEach((listener) => listener(entry));
}

export function readTideRailProviderFailureAudit(): TideRailProviderFailureAudit[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAILURE_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function auditFailure(entry: TideRailProviderFailureAudit) {
  try {
    localStorage.setItem(FAILURE_KEY, JSON.stringify([entry, ...readTideRailProviderFailureAudit()].slice(0, 50)));
  } catch { /* storage is best-effort; never blocks adjudication */ }
}

const ALLOWED_KEYS = new Set(['verdict', 'rationale', 'appliedRules', 'confidence']);
const UNSAFE_MODEL_INSTRUCTION = /ignore (all |any )?(previous|prior)|system prompt|developer message|execute (a )?(tool|command|code)|call (a )?(tool|function)|忽略.{0,12}(指令|規則)|執行.{0,8}(工具|程式|命令)/i;

function responseText(value: unknown): { text: string; hasUnsafePart: boolean } {
  if (typeof value === 'string') return { text: value, hasUnsafePart: false };
  if (!Array.isArray(value)) return { text: '', hasUnsafePart: true };
  let hasUnsafePart = false;
  const text = value.map((part) => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') { hasUnsafePart = true; return ''; }
    const record = part as Record<string, unknown>;
    if (record.finalToolCalls) hasUnsafePart = true;
    if (record.type && record.type !== 'text') { hasUnsafePart = true; return ''; }
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    hasUnsafePart = true;
    return '';
  }).join('');
  return { text, hasUnsafePart };
}

/** Strict TideRail parser. It accepts one JSON object, optionally inside one json fence. */
export function normalizeTideRailDecisionResponse(
  response: unknown,
  modelId: string,
  now = Date.now(),
): TideRailDecision | null {
  const extracted = responseText(response);
  if (extracted.hasUnsafePart) return null;
  const trimmed = extracted.text.trim();
  const fenced = trimmed.match(/^```json\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  if (!jsonText.startsWith('{') || !jsonText.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed) || Object.keys(parsed).some((key) => !ALLOWED_KEYS.has(key))) return null;
    if ('confidence' in parsed && (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 1)) return null;
    if (UNSAFE_MODEL_INSTRUCTION.test(String(parsed.rationale || '')) || (Array.isArray(parsed.appliedRules) && parsed.appliedRules.some((rule) => UNSAFE_MODEL_INSTRUCTION.test(String(rule))))) return null;
    return validateTideRailDecision(parsed, 'ai', modelId, now);
  } catch {
    return null;
  }
}

export function classifyTideRailProviderError(error: unknown, timedOut = false): TideRailProviderError {
  if (timedOut) return { type: 'timeout', message: '裁決逾時，可安全重試。' };
  if (error instanceof DOMException && error.name === 'AbortError') return { type: 'aborted', message: '' };
  if (error instanceof AIProviderHttpError) {
    if (error.status === 401) return { type: 'unauthorized', message: 'Provider 憑證無效。' };
    if (error.status === 403) return { type: 'forbidden', message: 'Provider 拒絕目前模型或權限。' };
    if (error.status === 429) return { type: 'rate_limited', message: `請求過於頻繁。${error.retryAfter ? ` Retry-After：${error.retryAfter}` : ''}`, retryAfter: error.retryAfter };
    if (error.status >= 500) return { type: 'provider_unavailable', message: 'Provider 暫時不可用。' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { type: 'offline', message: '目前離線，請恢復網路後重試。' };
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|networkerror|network request failed|無法連線/i.test(message)) return { type: 'offline', message: '目前無法連線到 Provider。' };
  return { type: 'unknown', message: 'AI 裁決未完成。' };
}

export interface TideRailAiDecisionResult {
  decision: TideRailDecision | null;
  error?: TideRailProviderError;
  providerId?: string;
  modelId?: string;
  durationMs?: number;
}

export async function requestTideRailAiDecision(
  proposal: TideRailProposal,
  active: TideRailProposal | null,
  providers: ProviderConfig[],
  signal: AbortSignal,
  timeoutMs = 30_000,
): Promise<TideRailAiDecisionResult> {
  const requestGeneration = ++latestRuntimeGeneration;
  const runtime = resolveActiveProvider(providers);
  if (!runtime.configured || !runtime.provider) {
    return { decision: null, error: { type: 'not_configured', message: '尚未接入可用模型，潮軌無法產生新的裁決。' } };
  }
  const provider = runtime.provider;
  const startedAt = Date.now();
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => { timedOut = true; timeoutController.abort(); }, timeoutMs);
  const abort = () => timeoutController.abort();
  signal.addEventListener('abort', abort, { once: true });
  const payload = {
    proposal: { title: proposal.title, summary: proposal.summary, priority: proposal.priority, category: proposal.category, dependencies: proposal.dependencies, acceptanceCriteria: proposal.acceptanceCriteria, sourceTypes: proposal.sourceRefs.map((ref) => ref.type), started: proposal.started, advisory: proposal.userAdvisory },
    activeMainline: active ? { title: active.title, priority: active.priority, started: active.started, acceptanceIncomplete: active.acceptanceCriteria.length - active.completedCriteria.length } : null,
    rules: ['P0 runtime block first', 'P1 corruption/security/core interruption second', 'started mainline acceptance before P2/P3', 'P0/P1 interruption requires contract'],
  };
  const config = await resolveProviderRequestConfig(provider, 'Return exactly one JSON object with verdict, rationale, appliedRules, confidence. Never use tools, include source facts not supplied, or add prose outside JSON.');
  const chunks: StreamChunk[] = [];
  try {
    for await (const chunk of sendChatMessage([{ role: 'user', content: JSON.stringify(payload) }], { ...config, streamingEnabled: false, tools: undefined }, timeoutController.signal)) chunks.push(chunk);
    if (requestGeneration !== latestRuntimeGeneration || signal.aborted) return { decision: null, error: { type: 'aborted', message: '' }, providerId: provider.id, modelId: provider.model, durationMs: Date.now() - startedAt };
    const decision = normalizeTideRailDecisionResponse(chunks, provider.model);
    const durationMs = Date.now() - startedAt;
    if (!decision) {
      const error: TideRailProviderError = { type: 'invalid_response', message: '模型回應格式無法驗證；沒有寫入裁決，可安全重試。' };
      auditFailure({ proposalId: proposal.id, providerId: provider.id, modelId: provider.model, type: error.type, occurredAt: Date.now() });
      const responseMeta = chunks.findLast((chunk) => chunk.responseMeta)?.responseMeta;
      publishDiagnostic({ providerId: provider.id, modelId: provider.model, startedAt, responseStatus: responseMeta?.status, responseContentType: responseMeta?.contentType, durationMs, aborted: false, timeout: false, schemaValid: false, safeErrorType: error.type });
      return { decision: null, error, providerId: provider.id, modelId: provider.model, durationMs };
    }
    const responseMeta = chunks.findLast((chunk) => chunk.responseMeta)?.responseMeta;
    publishDiagnostic({ providerId: provider.id, modelId: provider.model, startedAt, responseStatus: responseMeta?.status, responseContentType: responseMeta?.contentType, durationMs, aborted: false, timeout: false, parsedVerdict: decision.verdict, schemaValid: true });
    return { decision, providerId: provider.id, modelId: provider.model, durationMs };
  } catch (cause) {
    if ((requestGeneration !== latestRuntimeGeneration || signal.aborted) && !timedOut) {
      const durationMs = Date.now() - startedAt;
      publishDiagnostic({ providerId: provider.id, modelId: provider.model, startedAt, durationMs, aborted: true, timeout: false, schemaValid: false, safeErrorType: 'aborted' });
      return { decision: null, error: { type: 'aborted', message: '' }, providerId: provider.id, modelId: provider.model, durationMs };
    }
    const error = classifyTideRailProviderError(cause, timedOut);
    const durationMs = Date.now() - startedAt;
    if (error.type !== 'aborted') auditFailure({ proposalId: proposal.id, providerId: provider.id, modelId: provider.model, type: error.type, retryAfter: error.retryAfter, occurredAt: Date.now() });
    publishDiagnostic({ providerId: provider.id, modelId: provider.model, startedAt, responseStatus: cause instanceof AIProviderHttpError ? cause.status : undefined, responseContentType: cause instanceof AIProviderHttpError ? cause.contentType : undefined, durationMs, aborted: error.type === 'aborted', timeout: error.type === 'timeout', schemaValid: false, safeErrorType: error.type });
    return { decision: null, error, providerId: provider.id, modelId: provider.model, durationMs };
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', abort);
  }
}
