import { useMemo, useState } from 'react';
import { isNativeMcpAvailable, mcpBridge } from '@/native/mcpBridge';
import { McpClientFacade } from '@/features/mcp/McpClientFacade';
import { useMcpConnectionStore } from '@/store/useMcpConnectionStore';
import type { McpConnectionConfig, McpPermissionPolicy, McpTool } from '@/features/mcp/types';

const createServerId = () => `mcp-${crypto.randomUUID()}`;

export function McpConnectionsPanel() {
  const connections = useMcpConnectionStore((state) => state.connections);
  const removeConnection = useMcpConnectionStore((state) => state.removeConnection);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [policy, setPolicy] = useState<McpPermissionPolicy>('ask');
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const nativeAvailable = isNativeMcpAvailable();
  const sorted = useMemo(() => [...connections].sort((a, b) => a.displayName.localeCompare(b.displayName)), [connections]);

  const addConnection = async () => {
    setFormError('');
    let parsed: URL;
    try { parsed = new URL(endpoint.trim()); } catch { setFormError('请输入有效的 HTTPS Endpoint。'); return; }
    if (parsed.protocol !== 'https:') { setFormError('iPhone 仅允许 HTTPS MCP Endpoint。'); return; }
    const config: McpConnectionConfig = { serverId: createServerId(), displayName: name.trim() || parsed.hostname, endpoint: parsed.toString(), permissionPolicy: policy };
    setBusyId(config.serverId);
    try {
      await McpClientFacade.connect(config);
      setEditing(false); setName(''); setEndpoint('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '连接失败');
    } finally { setBusyId(null); }
  };

  const loadTools = async (serverId: string) => {
    setBusyId(serverId);
    try {
      const nextTools = await McpClientFacade.listTools(serverId);
      setTools((current) => ({ ...current, [serverId]: nextTools }));
    }
    finally { setBusyId(null); }
  };

  return (
    <div className="settings-module-stack mcp-connections-panel">
      <div className="settings-info-block"><strong>MCP Connections</strong><p>连接远程 Streamable HTTP 服务。凭证只保存在 iOS Keychain，不会写入 Web Storage。</p></div>
      {!nativeAvailable && <div className="mcp-native-notice" role="status"><strong>需要 Lunartide iOS App</strong><span>浏览器环境不支持原生 MCP Bridge，也不会伪装为已连接。</span></div>}
      {sorted.length === 0 ? (
        <div className="mcp-empty-state"><span className="mcp-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 8V4m8 4V4M5 8h14v11H5zM9 13h6" /></svg></span><strong>尚未连接服务</strong><span>添加一个 HTTPS MCP Endpoint 后，iOS 原生客户端会完成初始化与工具发现。</span></div>
      ) : (
        <div className="mcp-connection-list">{sorted.map((connection) => <article key={connection.serverId} className="mcp-connection-row">
          <div><strong>{connection.displayName}</strong><span className="mcp-endpoint">{connection.endpoint}</span><small className={`mcp-status is-${connection.connectionStatus}`}>{connection.connectionStatus} · {connection.toolCount} tools</small>{connection.lastError && <small className="mcp-error">{connection.lastError}</small>}</div>
          <div className="mcp-row-actions">{connection.connectionStatus === 'connected' ? <button type="button" onClick={() => loadTools(connection.serverId)} disabled={busyId === connection.serverId}>工具</button> : <button type="button" onClick={() => McpClientFacade.connect(connection)} disabled={!nativeAvailable || busyId === connection.serverId}>重试</button>}<button type="button" onClick={async () => { await mcpBridge.clearCredentials(connection.serverId).catch(() => undefined); removeConnection(connection.serverId); }}>移除</button></div>
          {(tools[connection.serverId]?.length || 0) > 0 && <ul className="mcp-tool-list">{tools[connection.serverId].map((tool) => <li key={tool.name}><strong>{tool.title || tool.name}</strong><span>{tool.description || '无说明'}</span></li>)}</ul>}
        </article>)}</div>
      )}
      {!editing ? <button type="button" className="mcp-add-button" onClick={() => setEditing(true)}>添加 MCP 服务</button> : <div className="mcp-add-sheet" role="group" aria-label="添加 MCP 服务">
        <label><span>名称</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：测试工具箱" /></label>
        <label><span>HTTPS Endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} inputMode="url" autoCapitalize="none" placeholder="https://example.com/mcp" /></label>
        <label><span>权限策略</span><select value={policy} onChange={(event) => setPolicy(event.target.value as McpPermissionPolicy)}><option value="ask">每次询问</option><option value="read-only">仅只读工具</option><option value="allow-listed">仅允许清单</option></select></label>
        {formError && <p className="mcp-form-error" role="alert">{formError}</p>}
        <div className="mcp-sheet-actions"><button type="button" onClick={() => { setEditing(false); setFormError(''); }}>取消</button><button type="button" onClick={addConnection} disabled={!nativeAvailable || busyId !== null}>连接</button></div>
      </div>}
    </div>
  );
}
