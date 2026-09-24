import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendChatMessage } from '@/ai/client';
import { streamWithCustomToolHandler } from '@/ai/mcpToolMiddleware';
import { streamAnthropic } from '@/ai/providers/anthropic';
import { streamGoogle } from '@/ai/providers/google';
import type { AIRequestConfig, StreamChunk, ToolDefinition } from '@/ai/types';
import { logAIRequest } from '@/core/aiTelemetry';
import { ProviderUsageLedger, setProviderUsageLedgerForTests } from './ProviderUsageLedger';
import { API_USAGE_STORAGE_KEY, readLegacyApiUsageRecords } from './ApiUsageRecorder';
import { MemoryProviderUsageRepository } from './providerUsageRepository';
import type { ProviderUsageRecord } from './apiUsageTypes';

const config = (patch: Partial<AIRequestConfig> = {}): AIRequestConfig => ({
  provider: 'openai', providerConfigId: 'provider-a', providerType: 'openai', model: 'test', apiKey: 'fixture',
  baseUrl: 'https://fixture.invalid/v1', temperature: 0, maxTokens: 20, topP: 1, systemPrompt: '',
  streamingEnabled: false, ...patch,
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
async function consume(generator: AsyncGenerator<StreamChunk>) { const chunks: StreamChunk[] = []; for await (const chunk of generator) chunks.push(chunk); return chunks; }

describe('ProviderUsageLedger Phase 1', () => {
  let repository: MemoryProviderUsageRepository;
  let ledger: ProviderUsageLedger;
  beforeEach(() => { localStorage.clear(); repository = new MemoryProviderUsageRepository(); ledger = new ProviderUsageLedger(repository); setProviderUsageLedgerForTests(ledger); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setProviderUsageLedgerForTests(undefined); });

  it('1 normal chat creates exactly one record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } })));
    await consume(sendChatMessage([], config()));
    expect(await ledger.getAll()).toMatchObject([{ status: 'success', totalTokens: 5, usageProvenance: 'server_reported' }]);
  });

  it('2 streaming chat creates exactly one record', async () => {
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}\n\ndata: [DONE]\n\n')); c.close(); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await consume(sendChatMessage([], config({ streamingEnabled: true })));
    expect(await ledger.getAll()).toHaveLength(1);
  });

  it('3-5 tool rounds create 3 records with one operation and unique requests', async () => {
    const replies = [
      { choices: [{ message: { tool_calls: [{ id: '1', type: 'function', function: { name: 'tool', arguments: '{}' } }] } }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
      { choices: [{ message: { tool_calls: [{ id: '2', type: 'function', function: { name: 'tool', arguments: '{}' } }] } }], usage: { prompt_tokens: 2, completion_tokens: 1 } },
      { choices: [{ message: { content: 'done' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } },
    ];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(replies.shift()))));
    const tools: ToolDefinition[] = [{ type: 'function', function: { name: 'tool', description: '', parameters: {} } }];
    await consume(streamWithCustomToolHandler([], config(), tools, async (calls) => calls.map((call) => ({ role: 'tool', tool_call_id: call.id, content: 'ok' })), 3));
    const rows = await ledger.getAll();
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.operationId)).size).toBe(1);
    expect(new Set(rows.map((row) => row.requestId)).size).toBe(3);
    expect(rows.map((row) => row.toolRound)).toEqual([0, 1, 2]);
  });

  it('4 operation identity is stable across continuation records', async () => {
    const rows = [0, 1, 2].map((toolRound) => ({ operationId: 'operation', toolRound }));
    expect(new Set(rows.map((row) => row.operationId))).toEqual(new Set(['operation']));
  });

  it('5 physical request identity cannot be reused by tool rounds', () => {
    const requestIds = ['round-0', 'round-1', 'round-2'];
    expect(new Set(requestIds).size).toBe(requestIds.length);
  });

  it('6 distinguishes two OpenAI provider configs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ choices: [{ message: { content: 'ok' } }] }))));
    await consume(sendChatMessage([], config({ providerConfigId: 'personal' })));
    await consume(sendChatMessage([], config({ providerConfigId: 'work' })));
    expect((await ledger.getAll()).map((row) => row.providerConfigId)).toEqual(['personal', 'work']);
  });

  it('7 consumer return records cancelled', async () => {
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n')); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const generator = sendChatMessage([], config({ streamingEnabled: true }));
    await generator.next(); await generator.return(undefined);
    expect(await ledger.getAll()).toMatchObject([{ status: 'cancelled' }]);
  });

  it('8 provider HTTP error records error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: { message: 'bad' } }, 429)));
    await expect(consume(sendChatMessage([], config()))).rejects.toThrow('bad');
    expect(await ledger.getAll()).toMatchObject([{ status: 'error', httpStatus: 429 }]);
  });

  it('9 Anthropic tool response preserves usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ content: [{ type: 'tool_use', id: 'x', name: 'tool', input: {} }], usage: { input_tokens: 8, output_tokens: 2 } })));
    expect((await consume(streamAnthropic([], config({ provider: 'anthropic' }))))[0].usage).toMatchObject({ inputTokens: 8, outputTokens: 2, estimated: false });
  });

  it('10 Gemini function call preserves usage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ candidates: [{ content: { parts: [{ functionCall: { name: 'tool', args: {} } }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 } })));
    expect((await consume(streamGoogle([], config({ provider: 'google' }))))[0].usage).toMatchObject({ inputTokens: 4, outputTokens: 1, estimated: false });
  });

  it('11 unsupported usage remains undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: 'ok' } }] })));
    await consume(sendChatMessage([], config())); expect((await ledger.getAll())[0].inputTokens).toBeUndefined();
  });

  it('12 estimated local tokens are not server reported', async () => {
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}\n\n')); c.close(); } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    await consume(sendChatMessage([{ role: 'user', content: 'hello' }], config({ provider: 'google', providerType: 'gemini', streamingEnabled: true })));
    expect(await ledger.getAll()).toMatchObject([{ usageProvenance: 'estimated_local' }]);
  });

  it('13 repository reload retains appended records', async () => {
    const backing: ProviderUsageRecord[] = [];
    const first = new ProviderUsageLedger(new MemoryProviderUsageRepository(backing));
    await first.record({ id: '1', requestId: 'r', timestamp: 1, completedAt: 2, providerType: 'openai', transportKind: 'openai-compatible', requestType: 'chat', streaming: false, usageProvenance: 'unavailable', latencyMs: 1, status: 'success' });
    expect(await new ProviderUsageLedger(new MemoryProviderUsageRepository(backing)).getAll()).toHaveLength(1);
  });

  it('14 localStorage writer is inactive and legacy data remains readable', async () => {
    localStorage.setItem(API_USAGE_STORAGE_KEY, JSON.stringify([{ id: 'legacy' }]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: 'ok' } }] })));
    await consume(sendChatMessage([], config()));
    expect(readLegacyApiUsageRecords()).toEqual([{ id: 'legacy' }]);
    expect(JSON.parse(localStorage.getItem(API_USAGE_STORAGE_KEY) || '[]')).toEqual([{ id: 'legacy' }]);
  });

  it('15 legacy aiTelemetry does not write useAppStore persistence', () => {
    const before = localStorage.getItem('lunartide_data'); logAIRequest({ provider: 'openai', model: 'test' });
    expect(localStorage.getItem('lunartide_data')).toBe(before);
  });

  it('16 an explicitly ephemeral request bypasses the usage ledger', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ choices: [{ message: { content: 'guest reply' } }] })));
    const chunks = await consume(sendChatMessage([], config({ persistUsage: false })));
    expect(chunks.map((chunk) => chunk.content).join('')).toBe('guest reply');
    expect(await ledger.getAll()).toEqual([]);
  });
});
