/* ═══════════════════════════════════════════════════════
   mcpToolMiddleware.ts — Tool Execution Loop Middleware

   Wraps the AI streaming pipeline with MCP tool execution:
     1. Inject tool definitions into AI request
     2. Detect tool_calls in AI response
     3. Route tool calls to MCP servers via mcpRuntime
     4. Inject tool results back into conversation
     5. Re-call AI for final response (up to maxRounds)
     6. Log all MCP tool calls into aiTelemetry

   The middleware yields regular StreamChunks — ChatPage
   doesn't need to know about tool internals.

   Usage:
     import {
       streamWithMcpTools,
       streamWithCustomToolHandler,
     } from '@/ai/mcpToolMiddleware';

     // Use with MCP runtime (auto-routes to connected servers)
     for await (const chunk of streamWithMcpTools(messages, config, signal)) {
       // handle chunk as normal
     }

     // Use with custom tool handler
     for await (const chunk of streamWithCustomToolHandler(
       messages, config, tools, handleToolCall, signal
     )) { }
   ═══════════════════════════════════════════════════════ */

import type { ChatMessage, StreamChunk, AIRequestConfig, ToolDefinition, ToolCall, ToolResult } from '@/ai/types';
import { sendChatMessage } from './client';
import { getMcpRuntime } from '@/core/mcpRuntime';
import { logMCPToolCall } from '@/core/aiTelemetry';
import { useAppStore } from '@/store/useAppStore';
import { executeAgentTool, agentToolToDefinition } from './agentToolExecutor';
import { executeCalendarSeeWithSnapshot, executeCalendarTool, type CalendarToolInput } from '@/features/calendar/calendarToolAdapter';
import { executeMomentsAgentTool, MOMENTS_TOOL_DEFINITION, type MomentsAgentToolInput } from '@/features/moments/agentTools';

const CALENDAR_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calendar',
    description: 'Read or manage the shared USER and LUNARIS calendar. Use see for one day and comment for a day or event note. Writes follow the calendar permission policy.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'see', 'create', 'update', 'delete', 'comment'] },
        from: { type: 'string' }, to: { type: 'string' }, date: { type: 'string' },
        eventId: { type: 'string' }, noteId: { type: 'string' }, title: { type: 'string' },
        description: { type: 'string' }, startsAt: { type: 'string' }, endsAt: { type: 'string' },
        precision: { type: 'string', enum: ['minute', 'hour', 'segment', 'day'] }, eventType: { type: 'string' },
        questId: { type: 'string' }, content: { type: 'string' }, expectedRevision: { type: 'number' }, newOnly: { type: 'boolean' },
      },
      required: ['action'],
    },
  },
};

export interface ToolLifecycleObserver {
  onToolStart?: (toolCall: ToolCall) => void;
  onToolComplete?: (toolCall: ToolCall) => void;
}

/* ── Core tool loop engine ── */

/**
 * Yields text content chunks from an AI call that may use tools.
 * Handles the tool execution loop internally — consumers only see text.
 */
export async function* streamWithCustomToolHandler(
  initMessages: ChatMessage[],
  config: AIRequestConfig,
  tools: ToolDefinition[],
  onToolCall: (toolCalls: ToolCall[]) => Promise<ToolResult[]>,
  maxRounds = 3,
  signal?: AbortSignal,
  observer?: ToolLifecycleObserver,
): AsyncGenerator<StreamChunk> {
  const messages: ChatMessage[] = [...initMessages];
  const operationId = config.telemetry?.operationId || crypto.randomUUID();

  let lastChunk: StreamChunk | null = null;

  for (let round = 0; round <= maxRounds; round++) {
    const mcpStartedAt = Date.now();
    lastChunk = null;

    const roundConfig: AIRequestConfig = {
      ...config,
      tools: tools.length > 0 ? tools : undefined,
      telemetry: {
        ...config.telemetry,
        requestId: undefined,
        operationId,
        requestType: round === 0 ? (config.telemetry?.requestType || 'chat') : 'tool_continuation',
        toolRound: round,
      },
    };
    for await (const chunk of sendChatMessage(messages, roundConfig, signal)) {
      if (!chunk.done) {
        yield chunk;
      } else {
        lastChunk = chunk;
      }
    }

    if (!lastChunk) break;

    const toolCalls = lastChunk.finalToolCalls;
    if (!toolCalls || toolCalls.length === 0) {
      // Final text response — done
      return;
    }

    // Tool calls detected — execute them
    const toolStartMs = Date.now();

    let toolResults: ToolResult[];
    try {
      toolCalls.forEach((toolCall) => observer?.onToolStart?.(toolCall));
      toolResults = await onToolCall(toolCalls);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      yield { content: `\n[MCP 工具執行失敗: ${errorMsg}]\n`, done: true };
      return;
    }

    const toolLatencyMs = Date.now() - toolStartMs;

    // Log each tool call into telemetry
    for (let i = 0; i < toolCalls.length; i++) {
      observer?.onToolComplete?.(toolCalls[i]);
      logMCPToolCall({
        toolName: toolCalls[i].function.name,
        success: true,
        latencyMs: toolLatencyMs,
        round,
        totalRounds: maxRounds,
      });
    }

    // Append assistant tool_calls + tool results to conversation
    messages.push({
      role: 'assistant',
      content: '',
      tool_calls: toolCalls,
    });

    for (const result of toolResults) {
      messages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id,
      });
    }

    // Remove tools param after first round to prevent infinite loops
    // but still allow subsequent tool calls if model requests them
  }

  // Max rounds reached — yield what we have
  if (lastChunk?.content) {
    yield lastChunk;
  }
}

/* ── MCP-aware convenience wrapper ── */

/**
 * Stream AI response with automatic MCP + AgentTool integration.
 * Merges tools from MCP connections and the Tools Center.
 */
export async function* streamWithMcpTools(
  messages: ChatMessage[],
  config: AIRequestConfig,
  signal?: AbortSignal,
  observer?: ToolLifecycleObserver,
): AsyncGenerator<StreamChunk> {
  const runtime = getMcpRuntime();

  // Collect MCP tools
  let mcpTools: ToolDefinition[] = [];
  try {
    mcpTools = await runtime.getAllToolDefinitions();
  } catch {
    mcpTools = [];
  }

  // Collect enabled AgentTools from the store
  const store = useAppStore.getState();
  const enabledAgentTools = (store.agentTools || []).filter((t) => t.enabled);
  const agentToolDefs: ToolDefinition[] = enabledAgentTools.map(agentToolToDefinition);
  const agentToolMap = new Map<string, typeof enabledAgentTools[0]>();
  for (const t of enabledAgentTools) {
    const name = `lunartide_${t.id.replace(/-/g, '_')}`;
    agentToolMap.set(name, t);
  }

  // Merge all tools
  const allTools = [CALENDAR_TOOL_DEFINITION, MOMENTS_TOOL_DEFINITION, ...mcpTools.filter((tool) => !['calendar', 'moments'].includes(tool.function.name)), ...agentToolDefs];

  if (allTools.length === 0) {
    yield* sendChatMessage(messages, config, signal);
    return;
  }

  yield* streamWithCustomToolHandler(
    messages,
    config,
    allTools,
    async (toolCalls): Promise<ToolResult[]> => {
      const results: ToolResult[] = [];
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        const toolName = tc.function.name;

        if (toolName === 'calendar') {
          const input = args as unknown as CalendarToolInput;
          const content = input.action === 'see' ? (await executeCalendarSeeWithSnapshot(input)).content : JSON.stringify(executeCalendarTool(input));
          results.push({ tool_call_id: tc.id, role: 'tool', content });
          continue;
        }

        if (toolName === 'moments') {
          const content = JSON.stringify(await executeMomentsAgentTool(args as unknown as MomentsAgentToolInput));
          results.push({ tool_call_id: tc.id, role: 'tool', content });
          continue;
        }

        // AgentTool routing (names start with lunartide_)
        const agentTool = agentToolMap.get(toolName);
        if (agentTool) {
          const execResult = await executeAgentTool(agentTool, args);
          results.push({
            tool_call_id: tc.id,
            role: 'tool',
            content: execResult,
          });
          continue;
        }

        // MCP tool routing
        try {
          const mcpResult = await runtime.routeTool(toolName, args);
          const textContent = mcpResult.content
            ?.filter((c) => c.type === 'text' || (c.type === 'resource' && c.text))
            .map((c) => c.text || (c as unknown as Record<string, string>).resource_text || '')
            .join('\n') || JSON.stringify(mcpResult);

          results.push({
            tool_call_id: tc.id,
            role: 'tool',
            content: textContent,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({
            tool_call_id: tc.id,
            role: 'tool',
            content: `Error: ${errorMsg}`,
          });
        }
      }
      return results;
    },
    3,
    signal,
    observer,
  );
}
