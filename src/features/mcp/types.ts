export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type McpPermissionPolicy = 'ask' | 'read-only' | 'allow-listed';

export interface McpConnectionConfig {
  serverId: string;
  displayName: string;
  endpoint: string;
  permissionPolicy: McpPermissionPolicy;
}

export interface McpConnectionState extends McpConnectionConfig {
  connectionStatus: McpConnectionStatus;
  toolCount: number;
  lastConnectedAt?: string;
  lastError?: string;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError: boolean;
  structuredContent?: unknown;
}

export interface McpAuthorizationResult {
  authorizationUrl: string;
  serverId: string;
}

export interface McpCallOptions {
  serverId: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  callId?: string;
  timeoutMs?: number;
}

export interface McpBridgeApi {
  connect(config: McpConnectionConfig): Promise<McpConnectionState>;
  beginAuthorization(config: McpConnectionConfig): Promise<McpAuthorizationResult>;
  completeAuthorization(serverId: string, callbackUrl: string): Promise<McpConnectionState>;
  disconnect(serverId: string): Promise<void>;
  listTools(serverId: string): Promise<McpTool[]>;
  callTool(options: McpCallOptions): Promise<McpToolResult>;
  cancelCall(serverId: string, callId: string): Promise<void>;
  getConnections(): Promise<McpConnectionState[]>;
  clearCredentials(serverId: string): Promise<void>;
}

export class UnsupportedMcpBridgeError extends Error {
  constructor() {
    super('MCP connections require the Lunartide iOS app.');
    this.name = 'UnsupportedMcpBridgeError';
  }
}
