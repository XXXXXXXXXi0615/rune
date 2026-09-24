import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  McpAuthorizationResult,
  McpBridgeApi,
  McpCallOptions,
  McpConnectionConfig,
  McpConnectionState,
  McpTool,
  McpToolResult,
} from '@/features/mcp/types';
import { UnsupportedMcpBridgeError } from '@/features/mcp/types';

interface NativeMcpPlugin {
  connect(options: McpConnectionConfig): Promise<McpConnectionState>;
  beginAuthorization(options: McpConnectionConfig): Promise<McpAuthorizationResult>;
  completeAuthorization(options: { serverId: string; callbackUrl: string }): Promise<McpConnectionState>;
  disconnect(options: { serverId: string }): Promise<void>;
  listTools(options: { serverId: string }): Promise<{ tools: McpTool[] }>;
  callTool(options: McpCallOptions): Promise<McpToolResult>;
  cancelCall(options: { serverId: string; callId: string }): Promise<void>;
  getConnections(): Promise<{ connections: McpConnectionState[] }>;
  clearCredentials(options: { serverId: string }): Promise<void>;
}

const NativeMcpBridge = registerPlugin<NativeMcpPlugin>('MCPBridge');

class UnsupportedMcpBridge implements McpBridgeApi {
  private reject<T>(): Promise<T> { return Promise.reject(new UnsupportedMcpBridgeError()); }
  connect(_config: McpConnectionConfig): Promise<McpConnectionState> { return this.reject(); }
  beginAuthorization(_config: McpConnectionConfig): Promise<McpAuthorizationResult> { return this.reject(); }
  completeAuthorization(_serverId: string, _callbackUrl: string): Promise<McpConnectionState> { return this.reject(); }
  disconnect(_serverId: string): Promise<void> { return this.reject(); }
  listTools(_serverId: string): Promise<McpTool[]> { return this.reject(); }
  callTool(_options: McpCallOptions): Promise<McpToolResult> { return this.reject(); }
  cancelCall(_serverId: string, _callId: string): Promise<void> { return this.reject(); }
  getConnections(): Promise<McpConnectionState[]> { return this.reject(); }
  clearCredentials(_serverId: string): Promise<void> { return this.reject(); }
}

class CapacitorMcpBridge implements McpBridgeApi {
  connect(config: McpConnectionConfig) { return NativeMcpBridge.connect(config); }
  beginAuthorization(config: McpConnectionConfig) { return NativeMcpBridge.beginAuthorization(config); }
  completeAuthorization(serverId: string, callbackUrl: string) { return NativeMcpBridge.completeAuthorization({ serverId, callbackUrl }); }
  disconnect(serverId: string) { return NativeMcpBridge.disconnect({ serverId }); }
  async listTools(serverId: string) { return (await NativeMcpBridge.listTools({ serverId })).tools; }
  callTool(options: McpCallOptions) { return NativeMcpBridge.callTool(options); }
  cancelCall(serverId: string, callId: string) { return NativeMcpBridge.cancelCall({ serverId, callId }); }
  async getConnections() { return (await NativeMcpBridge.getConnections()).connections; }
  clearCredentials(serverId: string) { return NativeMcpBridge.clearCredentials({ serverId }); }
}

export const mcpBridge: McpBridgeApi = Capacitor.isNativePlatform()
  ? new CapacitorMcpBridge()
  : new UnsupportedMcpBridge();

export const isNativeMcpAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
