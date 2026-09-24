import { mcpBridge } from '@/native/mcpBridge';
import { useMcpConnectionStore } from '@/store/useMcpConnectionStore';
import type { McpCallOptions, McpConnectionConfig } from './types';

export const McpClientFacade = {
  async connect(config: McpConnectionConfig) {
    const store = useMcpConnectionStore.getState();
    store.upsertConnection({ ...config, connectionStatus: 'connecting', toolCount: 0 });
    try {
      const connection = await mcpBridge.connect(config);
      store.upsertConnection(connection);
      return connection;
    } catch (error) {
      store.setConnectionError(config.serverId, error instanceof Error ? error.message : '连接失败');
      throw error;
    }
  },
  async disconnect(serverId: string) {
    await mcpBridge.disconnect(serverId);
    useMcpConnectionStore.getState().setConnectionStatus(serverId, 'disconnected');
  },
  listTools: (serverId: string) => mcpBridge.listTools(serverId),
  callTool: (options: McpCallOptions) => mcpBridge.callTool(options),
  cancelCall: (serverId: string, callId: string) => mcpBridge.cancelCall(serverId, callId),
  reconnectKnownServers: async () => {
    const connections = useMcpConnectionStore.getState().connections;
    for (const connection of connections.filter((item) => item.connectionStatus === 'connected')) {
      try { await McpClientFacade.connect(connection); } catch { /* status is recorded by connect */ }
    }
  },
};
