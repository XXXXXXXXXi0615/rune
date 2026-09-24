import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { McpConnectionState, McpConnectionStatus } from '@/features/mcp/types';

interface McpConnectionStore {
  connections: McpConnectionState[];
  upsertConnection: (connection: McpConnectionState) => void;
  removeConnection: (serverId: string) => void;
  setConnectionStatus: (serverId: string, status: McpConnectionStatus) => void;
  setConnectionError: (serverId: string, message: string) => void;
}

export const useMcpConnectionStore = create<McpConnectionStore>()(
  persist(
    (set) => ({
      connections: [],
      upsertConnection: (connection) => set((state) => ({
        connections: state.connections.some((item) => item.serverId === connection.serverId)
          ? state.connections.map((item) => item.serverId === connection.serverId ? connection : item)
          : [...state.connections, connection],
      })),
      removeConnection: (serverId) => set((state) => ({ connections: state.connections.filter((item) => item.serverId !== serverId) })),
      setConnectionStatus: (serverId, connectionStatus) => set((state) => ({
        connections: state.connections.map((item) => item.serverId === serverId ? { ...item, connectionStatus, lastError: undefined } : item),
      })),
      setConnectionError: (serverId, lastError) => set((state) => ({
        connections: state.connections.map((item) => item.serverId === serverId ? { ...item, connectionStatus: 'error', lastError } : item),
      })),
    }),
    {
      name: 'lunartide-mcp-connections',
      version: 1,
      partialize: (state) => ({ connections: state.connections }),
      merge: (persisted, current) => {
        const value = persisted as Partial<McpConnectionStore> | undefined;
        return { ...current, ...value, connections: Array.isArray(value?.connections) ? value.connections : [] };
      },
    },
  ),
);
