/* ═══════════════════════════════════════════════════════
   mcpRuntime.ts — MCP Runtime Manager

   Manages multiple MCP connections, brokers tool
   discovery and execution, and provides tool definitions
   for the AI pipeline.

   Usage:
     import { getMcpRuntime } from '@/core/mcpRuntime';

     const tools = await getMcpRuntime().getAllToolDefinitions();
     const result = await getMcpRuntime().routeTool('search', { q: 'hello' });
   ═══════════════════════════════════════════════════════ */

import type { ToolDefinition } from '@/ai/types';
import type { MCPConnection } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { McpClient } from './mcpClient';
import type { McpTool, McpToolCallResult } from './mcpClient';

/* ── Cached tool descriptor ── */

export interface CachedTool {
  connectionId: string;
  connectionName: string;
  tool: McpTool;
}

/* ── Runtime singleton ── */

class McpRuntime {
  private clients = new Map<string, McpClient>();
  private toolCache = new Map<string, CachedTool[]>(); // connectionId → tools
  private statusCache = new Map<string, 'idle' | 'connecting' | 'connected' | 'error'>();

  private getEnabledConnections(): MCPConnection[] {
    const store = useAppStore.getState();
    return (store.mcpConnections || []).filter((c) => c.enabled && c.serverUrl);
  }

  private getClient(conn: MCPConnection): McpClient {
    let client = this.clients.get(conn.id);
    if (!client) {
      client = new McpClient({ serverUrl: conn.serverUrl, transport: conn.transport });
      this.clients.set(conn.id, client);
    }
    return client;
  }

  /* ── Connect to a single server and fetch its tools ── */

  async connectAndFetchTools(connectionId: string): Promise<CachedTool[]> {
    const conns = this.getEnabledConnections();
    const conn = conns.find((c) => c.id === connectionId);
    if (!conn) return [];

    this.statusCache.set(connectionId, 'connecting');

    try {
      const client = this.getClient(conn);
      await client.initialize();
      const tools = await client.listTools();

      const cached: CachedTool[] = tools.map((tool) => ({
        connectionId: conn.id,
        connectionName: conn.name || conn.type || 'MCP',
        tool,
      }));

      this.toolCache.set(connectionId, cached);
      this.statusCache.set(connectionId, 'connected');
      return cached;
    } catch (err) {
      this.statusCache.set(connectionId, 'error');
      throw err;
    }
  }

  /* ── Refresh all connections ── */

  async refreshAllTools(): Promise<CachedTool[]> {
    const conns = this.getEnabledConnections();
    const results: CachedTool[] = [];

    for (const conn of conns) {
      try {
        const tools = await this.connectAndFetchTools(conn.id);
        results.push(...tools);
      } catch {
        this.statusCache.set(conn.id, 'error');
      }
    }

    return results;
  }

  /* ── Get all active tool definitions (for AI pipeline) ── */

  async getAllToolDefinitions(): Promise<ToolDefinition[]> {
    const conns = this.getEnabledConnections();
    let allTools: CachedTool[] = [];

    for (const conn of conns) {
      let cached = this.toolCache.get(conn.id);
      if (!cached) {
        try {
          cached = await this.connectAndFetchTools(conn.id);
        } catch {
          continue;
        }
      }
      allTools.push(...cached);
    }

    return allTools
      .filter((c) => c.tool.inputSchema?.type === 'object' || !c.tool.inputSchema?.type)
      .map((c) => ({
        type: 'function' as const,
        function: {
          name: c.tool.name,
          description: c.tool.description || `${c.connectionName} tool: ${c.tool.name}`,
          parameters: c.tool.inputSchema || { type: 'object', properties: {} },
        },
      }));
  }

  /* ── Route a tool call to the correct MCP server ── */

  async routeTool(toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    // Find which connection has this tool
    for (const [connectionId, tools] of this.toolCache.entries()) {
      if (tools.some((t) => t.tool.name === toolName)) {
        const conns = this.getEnabledConnections();
        const conn = conns.find((c) => c.id === connectionId);
        if (conn) {
          const client = this.getClient(conn);
          return client.callTool(toolName, args);
        }
      }
    }

    throw new Error(`MCP tool not found: ${toolName}`);
  }

  /* ── Execute tool on a specific connection ── */

  async executeTool(connectionId: string, toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const conns = this.getEnabledConnections();
    const conn = conns.find((c) => c.id === connectionId);
    if (!conn) throw new Error(`MCP connection not found: ${connectionId}`);

    const client = this.getClient(conn);
    return client.callTool(toolName, args);
  }

  /* ── Status check ── */

  getConnectionStatus(connectionId: string): string {
    return this.statusCache.get(connectionId) || 'idle';
  }

  /* ── Invalidate cache for a connection ── */

  invalidateCache(connectionId: string): void {
    this.toolCache.delete(connectionId);
    this.clients.get(connectionId)?.disconnect();
    this.clients.delete(connectionId);
    this.statusCache.set(connectionId, 'idle');
  }

  /* ── Disconnect all ── */

  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
    this.toolCache.clear();
    this.statusCache.clear();
  }
}

/* ── Module-level singleton ── */

let _runtime: McpRuntime | null = null;

export function getMcpRuntime(): McpRuntime {
  if (!_runtime) {
    _runtime = new McpRuntime();
  }
  return _runtime;
}
