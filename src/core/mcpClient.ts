/* ═══════════════════════════════════════════════════════
   mcpClient.ts — MCP JSON-RPC 2.0 Transport Layer

   Connects to MCP servers via streamable-http or SSE
   transport. Handles the initialize handshake, tool
   discovery, and tool execution.

   Usage:
     import { McpClient } from '@/core/mcpClient';

     const client = new McpClient({
       serverUrl: 'https://mcp.example.com/mcp',
       transport: 'streamable-http',
     });
     await client.initialize();
     const tools = await client.listTools();
     const result = await client.callTool(tools[0].name, { input: 'hello' });
   ═══════════════════════════════════════════════════════ */

import type { MCPConnection } from '@/types';

/* ── JSON-RPC types ── */

interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: number;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/* ── MCP tool types ── */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolCallResult {
  content: { type: string; text?: string; data?: string }[];
  isError?: boolean;
}

/* ── MCP Client ── */

export class McpClient {
  private serverUrl: string;
  private transport: 'streamable-http' | 'sse';
  private nextId = 1;
  private sseEndpoint: string | null = null;

  constructor(connection: Pick<MCPConnection, 'serverUrl' | 'transport'>) {
    this.serverUrl = connection.serverUrl.replace(/\/+$/, '');
    this.transport = connection.transport || 'streamable-http';

    if (!this.serverUrl) {
      throw new Error('MCP server URL is required');
    }
  }

  private newId(): number {
    return this.nextId++;
  }

  /* ── Streamable-HTTP transport (simple request/response) ── */

  private async httpRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = this.newId();
    const body: JSONRPCRequest = { jsonrpc: '2.0', method, id, ...(params ? { params } : {}) };

    const res = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json: JSONRPCResponse = await res.json();

    if (json.error) {
      throw new Error(`MCP error: ${json.error.message} (code ${json.error.code})`);
    }

    return json.result;
  }

  /* ── SSE transport ──
     Opens SSE stream to receive endpoint + responses,
     POSTs JSON-RPC messages to the provided endpoint.
  ── */

  private sseAbortController: AbortController | null = null;
  private ssePending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  private async ensureSseConnected(): Promise<void> {
    if (this.sseAbortController) return;

    this.sseAbortController = new AbortController();
    const res = await fetch(this.serverUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: this.sseAbortController.signal,
    });

    if (!res.ok) {
      throw new Error(`SSE connection failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No SSE response body');

    const decoder = new TextDecoder();
    let buffer = '';

    const readStream = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            if (!event.trim()) continue;

            let eventType = '';
            let eventData = '';

            for (const line of event.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              if (line.startsWith('data: ')) eventData = line.slice(6).trim();
            }

            // The endpoint event tells us where to POST messages
            if (eventType === 'endpoint') {
              // Resolve relative URLs against the server URL
              try {
                this.sseEndpoint = new URL(eventData, this.serverUrl).href;
              } catch {
                this.sseEndpoint = eventData;
              }
              continue;
            }

            // JSON-RPC responses come as SSE data events
            if (eventData) {
              try {
                const json: JSONRPCResponse = JSON.parse(eventData);
                if (json.id !== undefined) {
                  const pending = this.ssePending.get(json.id);
                  if (pending) {
                    this.ssePending.delete(json.id);
                    if (json.error) {
                      pending.reject(new Error(`MCP error: ${json.error.message} (code ${json.error.code})`));
                    } else {
                      pending.resolve(json.result);
                    }
                  }
                }
              } catch { /* skip unparseable events */ }
            }
          }
        }
      } catch {
        /* stream closed */
      }
    };

    // Read in background
    readStream().catch(() => {});
  }

  private async sseRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.ensureSseConnected();

    while (!this.sseEndpoint) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const id = this.newId();
    const body: JSONRPCRequest = { jsonrpc: '2.0', method, id, ...(params ? { params } : {}) };

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ssePending.delete(id);
        reject(new Error(`MCP SSE request timed out: ${method}`));
      }, 30000);

      this.ssePending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      fetch(this.sseEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((err) => {
        clearTimeout(timeout);
        this.ssePending.delete(id);
        reject(new Error(`SSE POST failed: ${err.message}`));
      });
    });
  }

  /* ── Unified request dispatcher ── */

  private async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (this.transport === 'sse') {
      return this.sseRequest(method, params);
    }
    return this.httpRequest(method, params);
  }

  /* ── Public API ── */

  async initialize(): Promise<{
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    serverInfo: { name: string; version: string };
  }> {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'lunartide', version: '1.0.0' },
    }) as {
      protocolVersion: string;
      capabilities: Record<string, unknown>;
      serverInfo: { name: string; version: string };
    };

    // Send initialized notification (no response expected)
    await this.request('notifications/initialized', {}).catch(() => {
      /* notification may cause errors in some servers */
    });

    return result;
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request('tools/list') as { tools: McpTool[] } | undefined;
    return result?.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    const result = await this.request('tools/call', { name, arguments: args }) as McpToolCallResult;
    return result;
  }

  async resourcesList(params?: Record<string, unknown>): Promise<unknown> {
    return this.request('resources/list', params);
  }

  async resourcesRead(uri: string): Promise<unknown> {
    return this.request('resources/read', { uri });
  }

  disconnect(): void {
    if (this.sseAbortController) {
      this.sseAbortController.abort();
      this.sseAbortController = null;
    }
    this.sseEndpoint = null;
    for (const [, pending] of this.ssePending) {
      pending.reject(new Error('Connection closed'));
    }
    this.ssePending.clear();
  }
}
