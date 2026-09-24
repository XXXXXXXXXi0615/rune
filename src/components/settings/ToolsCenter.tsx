import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import type { AgentTool, AgentToolType, MCPConnection } from '@/types';

interface ToolsCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

function toolTypeLabel(type: AgentToolType): string {
  switch (type) {
    case 'moonread': return '月讀室';
    case 'memory': return '記憶搜尋';
    case 'web_search': return 'Web Search';
    case 'file_reader': return 'File Reader';
    case 'custom_http': return 'Custom HTTP';
  }
}

function transportLabel(t: MCPConnection['transport']): string {
  return t === 'streamable-http' ? 'HTTP' : 'SSE';
}

/* ══════════════════════════════════════
   ONBOARDING HELP MODAL
   ══════════════════════════════════════ */
function OnboardingModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="mcp-onboarding-overlay" onClick={onClose}>
      <div className="mcp-onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mcp-onboarding-head">
          <h2>{t('mcp.onboardingTitle')}</h2>
          <button type="button" className="mcp-edit-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="mcp-onboarding-body">
          <p className="mcp-onboarding-desc">{t('mcp.onboardingDesc')}</p>

          <div className="mcp-onboarding-features">
            <div className="mcp-onb-feature">
              <span className="mcp-onb-feature-icon">📂</span>
              <div>
                <strong>檔案工具</strong>
                <p>讀取、編輯本機檔案，讓 Luna 成為你的 AI 助手</p>
              </div>
            </div>
            <div className="mcp-onb-feature">
              <span className="mcp-onb-feature-icon">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <div>
                <strong>網頁搜尋</strong>
                <p>讓 Luna 搜尋網路資訊，取得最新資料</p>
              </div>
            </div>
            <div className="mcp-onb-feature">
              <span className="mcp-onb-feature-icon">🧠</span>
              <div>
                <strong>記憶伺服器</strong>
                <p>建立持久化記憶庫，跨對話保留知識</p>
              </div>
            </div>
          </div>

          <div className="mcp-onboarding-safety">
            <span className="mcp-onb-safety-icon">🔒</span>
            <p>{t('mcp.onboardingSafety')}</p>
          </div>

          <div className="mcp-onboarding-steps">
            <h4>快速開始</h4>
            <ol>
              <li>點擊下方推薦連接中的任一卡片</li>
              <li>確認 MCP 伺服器已在運作（或使用推薦 URL）</li>
              <li>點擊「測試連線」確認可以接通</li>
              <li>儲存後，Luna 就能使用該服務的能力</li>
            </ol>
          </div>
        </div>
        <div className="mcp-onboarding-foot">
          <button type="button" className="mcp-edit-btn mcp-edit-btn--save" onClick={onClose}>開始使用</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════
   ADD MCP CONNECTION MODAL
   ══════════════════════════════════════ */
function AddMcpModal({
  connection,
  prefill,
  onSave,
  onClose,
}: {
  connection: MCPConnection | null;
  prefill?: Partial<Pick<MCPConnection, 'name' | 'serverUrl' | 'transport' | 'type'>>;
  onSave: (data: Partial<MCPConnection>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(connection?.name || prefill?.name || '');
  const [serverUrl, setServerUrl] = useState(connection?.serverUrl || prefill?.serverUrl || '');
  const [transport, setTransport] = useState<MCPConnection['transport']>(connection?.transport || prefill?.transport || 'streamable-http');
  const [type, setType] = useState(connection?.type || prefill?.type || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleTest = async () => {
    if (!serverUrl.trim()) return;
    setTestStatus('testing');
    setTestError('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(serverUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
        signal: AbortSignal.any?.([controller.signal, AbortSignal.timeout(8000)]) ?? controller.signal,
      });

      if (res.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('failed');
        setTestError(`HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      setTestStatus('failed');
      if (err instanceof DOMException && err.name === 'AbortError') {
        setTestError('連線超時');
      } else {
        setTestError(err instanceof Error ? err.message.slice(0, 80) : '無法連線');
      }
    }
  };

  const handleSave = () => {
    const data: Partial<MCPConnection> = {
      name: name.trim(),
      serverUrl: serverUrl.trim(),
      transport,
    };
    if (type.trim()) data.type = type.trim().toLowerCase();
    onSave(data);
    onClose();
  };

  return createPortal(
    <div className="mcp-edit-overlay" onClick={onClose}>
      <div className="mcp-edit-sheet mcp-add-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mcp-edit-handle" />
        <div className="mcp-edit-head">
          <h3>{connection ? '編輯 MCP 連線' : t('mcp.addConnection')}</h3>
          <button type="button" className="mcp-edit-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="mcp-edit-body">
          <label className="mcp-field">
            <span>名稱</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="伺服器名稱" autoFocus />
          </label>
          <label className="mcp-field">
            <span>端點 URL</span>
            <input type="text" value={serverUrl} onChange={(e) => { setServerUrl(e.target.value); setTestStatus('idle'); }} placeholder="https://..." />
          </label>
          <label className="mcp-field">
            <span>傳輸方式</span>
            <div className="mcp-transport-toggle">
              <button
                type="button"
                className={transport === 'streamable-http' ? 'active' : ''}
                onClick={() => setTransport('streamable-http')}
              >HTTP</button>
              <button
                type="button"
                className={transport === 'sse' ? 'active' : ''}
                onClick={() => setTransport('sse')}
              >SSE</button>
            </div>
          </label>

          {/* ── Test connection ── */}
          <div className="mcp-test-row">
            <button type="button" className="mcp-test-btn" onClick={handleTest} disabled={!serverUrl.trim() || testStatus === 'testing'}>
              {testStatus === 'testing' ? t('mcp.testing') : t('mcp.testConnection')}
            </button>
            {testStatus === 'success' && <span className="mcp-test-result success">{t('mcp.testSuccess')}</span>}
            {testStatus === 'failed' && <span className="mcp-test-result failed">{t('mcp.testFailed')}{testError ? `: ${testError}` : ''}</span>}
          </div>

          {/* ── Advanced settings ── */}
          <button
            type="button"
            className={`mcp-advanced-toggle ${showAdvanced ? 'open' : ''}`}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <span>{t('mcp.advanced')}</span>
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {showAdvanced && (
            <label className="mcp-field">
              <span>{t('mcp.typeLabel')}</span>
              <input type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder={t('mcp.typePlaceholder')} />
            </label>
          )}
        </div>

        <div className="mcp-edit-foot">
          <button type="button" className="mcp-edit-btn mcp-edit-btn--cancel" onClick={onClose}>取消</button>
          <button type="button" className="mcp-edit-btn mcp-edit-btn--save" onClick={handleSave} disabled={!name.trim() || !serverUrl.trim()}>儲存</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ══════════════════════════════════════
   MAIN TOOLS CENTER
   ══════════════════════════════════════ */
export function ToolsCenter({ isOpen, onClose }: ToolsCenterProps) {
  const tools = useAppStore((s) => s.agentTools);
  const toggleTool = useAppStore((s) => s.toggleTool);
  const mcpConnections = useAppStore((s) => s.mcpConnections);
  const updateMcp = useAppStore((s) => s.updateMcp);
  const createMcp = useAppStore((s) => s.createMcp);
  const agentRuntimeLogs = useAppStore((s) => s.agentRuntimeLogs);

  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [editSheet, setEditSheet] = useState<MCPConnection | null | 'new'>(null);
  const [prefillData, setPrefillData] = useState<Partial<Pick<MCPConnection, 'name' | 'serverUrl' | 'transport' | 'type'>> | undefined>();
  const [showOnboarding, setShowOnboarding] = useState(false);

  if (!isOpen) return null;

  const enabledTools = tools.filter((t) => t.enabled).length;
  const enabledMcp = mcpConnections.filter((c) => c.enabled).length;

  const toggleExpand = (id: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleMcp = (id: string, enabled: boolean) => {
    updateMcp(id, { enabled });
  };

  const handleSaveMcp = (data: Partial<MCPConnection>) => {
    if (editSheet === 'new') {
      createMcp({
        id: crypto.randomUUID?.() || `mcp-${Date.now()}`,
        name: data.name || '',
        type: data.type || 'mcp',
        enabled: true,
        transport: (data.transport as MCPConnection['transport']) || 'streamable-http',
        serverUrl: data.serverUrl || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else if (editSheet && typeof editSheet !== 'string') {
      updateMcp(editSheet.id, data);
    }
    setEditSheet(null);
    setPrefillData(undefined);
  };

  return (
    <div className="liquid-modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="liquid-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div className="liquid-sheet-header">
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>能力中心</h2>
          <button type="button" className="liquid-btn-back" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 2 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="mcp-scroll-body">
          {/* ── Welcome banner ── */}
          <div className="mcp-welcome-banner">
            <div className="mcp-welcome-content">
              <span className="mcp-welcome-icon">🔌</span>
              <div className="mcp-welcome-text">
                <strong>擴展 Luna 的能力</strong>
                <p>連接外部 MCP 服務，讓 Luna 讀取檔案、搜尋網頁、建立記憶庫。</p>
              </div>
            </div>
            <button type="button" className="mcp-learn-btn" onClick={() => setShowOnboarding(true)}>
              {t('mcp.learnMore')}
            </button>
          </div>

          {/* ── Summary bar ── */}
          <div className="mcp-summary">
            <span>已啟用 {enabledTools + enabledMcp} 個能力</span>
            <span>{agentRuntimeLogs.length} 筆執行記錄</span>
          </div>

          {/* ═══════════ MCP CONNECTIONS ═══════════ */}
          <div className="mcp-section">
            <div className="mcp-section-head">
              <span className="mcp-section-title">已連接的服務</span>
              <button type="button" className="mcp-add-btn" onClick={() => { setPrefillData(undefined); setEditSheet('new'); }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                新增
              </button>
            </div>

            {mcpConnections.length === 0 ? (
              <div className="mcp-empty">尚無 MCP 連線。點擊「新增」手動設定 MCP 服務。</div>
            ) : (
              <div className="mcp-card-list">
                {mcpConnections.map((conn) => {
                  const serverTools = tools.filter((t) => t.endpoint === conn.serverUrl || (t.type === 'custom_http' && t.endpoint));
                  const isExpanded = expandedServers.has(conn.id);
                  return (
                    <div key={conn.id} className="mcp-card">
                      <button type="button" className="mcp-card-main" onClick={() => setEditSheet(conn)}>
                        <div className="mcp-card-left">
                          <span className={`mcp-status-dot ${conn.enabled ? 'active' : ''}`} />
                          <div className="mcp-card-meta">
                            <span className="mcp-card-name">{conn.name}</span>
                            <span className="mcp-card-url">{conn.serverUrl}</span>
                          </div>
                        </div>
                        <div className="mcp-card-right">
                          <span className="mcp-badge">{transportLabel(conn.transport)}</span>
                        </div>
                      </button>

                      <div className="mcp-card-actions">
                        <label className="liquid-switch">
                          <input
                            type="checkbox"
                            checked={conn.enabled}
                            onChange={() => handleToggleMcp(conn.id, !conn.enabled)}
                          />
                          <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                        </label>
                        {serverTools.length > 0 && (
                          <button
                            type="button"
                            className={`mcp-expand-btn ${isExpanded ? 'open' : ''}`}
                            onClick={() => toggleExpand(conn.id)}
                          >
                            <span>{serverTools.length} 個工具</span>
                            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                          </button>
                        )}
                      </div>

                      {isExpanded && serverTools.length > 0 && (
                        <div className="mcp-tools-list">
                          {serverTools.map((tool) => (
                            <div key={tool.id} className="mcp-tool-row">
                              <span className="mcp-tool-icon">{toolTypeIcon(tool.type)}</span>
                              <div className="mcp-tool-body">
                                <span className="mcp-tool-name">{tool.name}</span>
                                <span className="mcp-tool-desc">{tool.description}</span>
                                <div className="mcp-tool-tags">
                                  <span className="mcp-tag">{toolTypeLabel(tool.type)}</span>
                                  {tool.requireConfirmation && (
                                    <span className="mcp-tag mcp-tag--warn">需確認</span>
                                  )}
                                </div>
                              </div>
                              <label className="liquid-switch liquid-switch--sm">
                                <input
                                  type="checkbox"
                                  checked={tool.enabled}
                                  onChange={() => toggleTool(tool.id)}
                                />
                                <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══════════ BUILT-IN TOOLS ═══════════ */}
          <div className="mcp-section">
            <div className="mcp-section-head">
              <span className="mcp-section-title">內建工具</span>
            </div>
            <div className="mcp-tool-list-plain">
                {tools.map((tool) => (
                  <div key={tool.id} className="mcp-tool-row" style={{ opacity: tool.enabled ? 1 : 0.5 }}>
                    <span className="mcp-tool-icon">{toolTypeIcon(tool.type)}</span>
                    <div className="mcp-tool-body">
                      <span className="mcp-tool-name">{tool.name}</span>
                      <span className="mcp-tool-desc">{tool.description}</span>
                      <div className="mcp-tool-tags">
                        <span className="mcp-tag">{toolTypeLabel(tool.type)}</span>
                        {tool.requireConfirmation && (
                          <span className="mcp-tag mcp-tag--warn">需確認</span>
                        )}
                      </div>
                    </div>
                    <label className="liquid-switch liquid-switch--sm">
                      <input
                        type="checkbox"
                        checked={tool.enabled}
                        onChange={() => toggleTool(tool.id)}
                      />
                      <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                    </label>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit sheet */}
      {editSheet !== null && (
        <AddMcpModal
          connection={typeof editSheet === 'string' ? null : editSheet}
          prefill={prefillData}
          onSave={handleSaveMcp}
          onClose={() => { setEditSheet(null); setPrefillData(undefined); }}
        />
      )}

      {/* Onboarding modal */}
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

/* ── Tool type icon ── */
function toolTypeIcon(type: AgentToolType) {
  const shared = { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'moonread': return <svg {...shared}><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
    case 'memory': return <svg {...shared}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>;
    case 'web_search': return <svg {...shared}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case 'file_reader': return <svg {...shared}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case 'custom_http': return <svg {...shared}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
  }
}
