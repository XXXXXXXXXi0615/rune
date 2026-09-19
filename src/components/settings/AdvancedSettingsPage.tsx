import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { PROVIDER_DEFAULTS, PROVIDER_TYPES, createProvider } from '@/config/providers';
import { providerRequiresApiKey, resolveActiveProvider } from '@/ai/providerRuntime';
import { testProviderConnection } from '@/ai/testConnection';
import { useProviderModels } from '@/ai/models';
import { t } from '@/i18n';
import type { ProviderConfig, ProviderType, AiRole, RoleConfig, MCPConnection } from '@/types';
import { ProviderLogo } from './ProviderLogo';

interface Props { isOpen: boolean; onClose: () => void; }

type ViewMode = 'main' | 'capability' | 'detail' | 'mcp';

const AI_ROLES: AiRole[] = ['chat', 'vision', 'embedding', 'speech'];

const CAPABILITY_LABELS: Record<AiRole, string> = {
  chat: '對話',
  vision: '看圖',
  embedding: '記憶',
  speech: '語音',
};

const CAPABILITY_ICONS: Record<AiRole, string> = {
  chat: 'M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  vision: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  embedding: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  speech: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
};

const CAPABILITY_COLORS: Record<AiRole, string> = {
  chat: '#B18DFF',
  vision: '#7AB8FF',
  embedding: '#5DB872',
  speech: '#F5C96A',
};

const MCP_ICON_MAP: Record<string, string> = {
  github: 'github', gmail: 'mail', 'google-calendar': 'calendar',
  notion: 'document', obsidian: 'gem', filesystem: 'folder',
};

function mcpIconFor(type: string): string {
  return MCP_ICON_MAP[type] || 'folder';
}

function McpSvgIcon({ name }: { name: string }) {
  const s = { width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'calendar': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'mail': return <svg viewBox="0 0 24 24" {...s}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case 'github': return <svg viewBox="0 0 24 24" {...s}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
    case 'document': return <svg viewBox="0 0 24 24" {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case 'gem': return <svg viewBox="0 0 24 24" {...s}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
    case 'folder': return <svg viewBox="0 0 24 24" {...s}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    default: return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

function McpRow({ mcp, onClick }: { mcp: MCPConnection; onClick: () => void }) {
  const icon = mcpIconFor(mcp.type);
  return (
    <button type="button" className="asvc-item" onClick={onClick} style={{ width: '100%' }}>
      <div className="amcp-icon"><McpSvgIcon name={icon} /></div>
      <div className="asvc-info">
        <span className="asvc-name">{mcp.name}</span>
      </div>
      <span className={`amcp-status amcp-status--${mcp.enabled ? 'on' : 'off'}`}>
        {mcp.enabled ? '已連接' : '未連接'}
      </span>
      <span className="asvc-arrow">
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6" /></svg>
      </span>
    </button>
  );
}

/* ── MCP Detail Panel (Danger Zone) ── */
function McpDetailPanel({
  mcp,
  onSave,
  onDelete,
  onCancel,
}: {
  mcp: MCPConnection | null;
  onSave: (draft: MCPConnection) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const isNew = !mcp;
  const [draft, setDraft] = useState<Partial<MCPConnection>>(
    mcp || { enabled: false, transport: 'streamable-http', type: '', name: '', serverUrl: '' },
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const patch = (p: Partial<MCPConnection>) => setDraft((d) => ({ ...d, ...p }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult('testing');
    await new Promise((r) => setTimeout(r, 1200));
    setTestResult(draft.enabled ? 'connected' : 'failed');
    setTesting(false);
  };

  const handleSave = () => {
    if (!draft.name?.trim() || !draft.serverUrl?.trim()) return;
    const now = Date.now();
    const conn: MCPConnection = {
      id: isNew ? crypto.randomUUID() : draft.id!,
      name: draft.name.trim(),
      type: (draft.type || '').trim().toLowerCase(),
      enabled: draft.enabled ?? false,
      transport: draft.transport ?? 'streamable-http',
      serverUrl: draft.serverUrl.trim(),
      headers: draft.headers,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    };
    onSave(conn);
  };

  const icon = mcpIconFor(draft.type || 'folder');

  return (
    <div className="adv-form">
      <div className="lcap-detail-head">
        <div className="amcp-icon"><McpSvgIcon name={icon} /></div>
        <div>
          <span className="lcap-detail-name">{draft.name || '新外部服務'}</span>
        </div>
      </div>

      <label className="adv-field">
        <span className="adv-field-label">名稱</span>
        <input className="adv-input" value={draft.name || ''} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. GitHub" />
      </label>

      <label className="adv-field">
        <span className="adv-field-label">類型 (identifier)</span>
        <input className="adv-input" value={draft.type || ''} onChange={(e) => patch({ type: e.target.value })} placeholder="e.g. github, gmail, filesystem" />
      </label>

      <label className="adv-field">
        <span className="adv-field-label">傳輸方式</span>
        <select className="arole-select" value={draft.transport ?? 'streamable-http'} onChange={(e) => patch({ transport: e.target.value as 'streamable-http' | 'sse' })}>
          <option value="streamable-http">streamable-http</option>
          <option value="sse">sse</option>
        </select>
      </label>

      <label className="adv-field">
        <span className="adv-field-label">Server URL</span>
        <input className="adv-input" value={draft.serverUrl || ''} onChange={(e) => patch({ serverUrl: e.target.value })} placeholder="https://mcp.example.com" />
      </label>

      <label className="adv-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="adv-field-label">已啟用</span>
        <label className="liquid-switch">
          <input type="checkbox" checked={draft.enabled ?? false} onChange={(e) => patch({ enabled: e.target.checked })} />
          <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
        </label>
      </label>

      {/* Test result */}
      {testResult !== 'idle' && (
        <div className={`adv-test-summary is-${testResult === 'connected' ? 'connected' : testResult === 'failed' ? 'failed' : 'testing'}`}>
          <div><span>服務</span><strong>{draft.name || '-'}</strong></div>
          <div><span>狀態</span><strong>
            {testResult === 'testing' ? '測試中…' : testResult === 'connected' ? '已連線' : '連線失敗'}
          </strong></div>
          {testResult === 'failed' && <p>無法連線至服務，請檢查 URL 或傳輸設定。</p>}
        </div>
      )}

      {/* Danger Zone */}
      <div className="adv-danger-zone">
        <div className="adv-danger-head">
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Danger Zone</span>
        </div>

        <div className="adv-danger-actions">
          <button type="button" className="liquid-btn" onClick={handleTest} disabled={testing}>
            {testing ? '測試中…' : '測試連線'}
          </button>
          <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleSave}>
            儲存
          </button>
          {!isNew && (
            deleteConfirm ? (
              <>
                <button type="button" className="liquid-btn liquid-btn--danger" onClick={() => { setDeleteConfirm(false); onDelete(); }}>
                  確認刪除 {draft.name}
                </button>
                <button type="button" className="liquid-btn" onClick={() => setDeleteConfirm(true)}>取消</button>
              </>
            ) : (
              <button type="button" className="liquid-btn liquid-btn--danger" onClick={() => setDeleteConfirm(true)}>
                刪除 MCP
              </button>
            )
          )}
        </div>
      </div>

      <div className="adv-form-actions">
        <button type="button" className="liquid-btn" onClick={onCancel}>返回</button>
      </div>
    </div>
  );
}

/* ── Capability Editor ── */
function CapabilityEditor({
  role,
  config,
  providers,
  onSave,
  onCancel,
}: {
  role: AiRole;
  config: RoleConfig;
  providers: ProviderConfig[];
  onSave: (patch: Partial<RoleConfig>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RoleConfig>({ ...config });
  const patch = (p: Partial<RoleConfig>) => setDraft((d) => ({ ...d, ...p }));
  const color = CAPABILITY_COLORS[role];
  const availableProviders = providers.filter((p) => p.enabled);

  return (
    <div className="adv-form">
      <div className="lcap-detail-head">
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color, flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d={CAPABILITY_ICONS[role]} />
        </svg>
        <span className="lcap-detail-name">{CAPABILITY_LABELS[role]}</span>
      </div>

      <div className="adv-field">
        <span className="adv-field-label">AI 服務</span>
        <select
          className="arole-select"
          value={draft.providerId}
          onChange={(e) => {
            const pid = e.target.value;
            patch({ providerId: pid });
            const prov = providers.find((p) => p.id === pid);
            if (prov && !draft.model) patch({ model: prov.model });
          }}
        >
          <option value="">-- 選擇服務 --</option>
          {availableProviders.length === 0 && (
            <option value="" disabled>請先新增 AI 服務</option>
          )}
          {availableProviders.map((p) => {
            const label = PROVIDER_DEFAULTS[p.type]?.label || p.type;
            return (
              <option key={p.id} value={p.id}>
                {p.name || label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="adv-field">
        <span className="adv-field-label">模型</span>
        <input className="adv-input" value={draft.model} onChange={(e) => patch({ model: e.target.value })} placeholder="輸入 Model ID" />
      </div>

      <div className="adv-form-actions">
        <button type="button" className="liquid-btn" onClick={onCancel}>取消</button>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={() => onSave(draft)}>儲存</button>
      </div>
    </div>
  );
}

/* ── Provider Detail Form ── */
function ProviderDetailForm({
  type,
  onSave,
  onCancel,
}: {
  type: ProviderType;
  onSave: (p: ProviderConfig) => void;
  onCancel: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSummary, setTestSummary] = useState<{ provider: string; model: string; latency: number; status: 'connected' | 'failed'; error?: string } | null>(null);
  const def = PROVIDER_DEFAULTS[type];
  const [draft, setDraft] = useState<ProviderConfig>(createProvider(type));

  const { models, loading: modelsLoading, error: modelsError, sync: syncModels } = useProviderModels(
    draft.type,
    draft.apiKey,
    draft.baseUrl || def.baseUrl,
  );

  const patch = (p: Partial<ProviderConfig>) => setDraft((d) => ({ ...d, ...p }));

  const handleTest = async () => {
    const startedAt = Date.now();
    setTesting(true);
    const missing = [
      !draft.baseUrl.trim() ? 'Base URL' : '',
      !draft.model.trim() ? 'Model' : '',
      providerRequiresApiKey(draft) && !draft.apiKey.trim() ? 'API Key' : '',
    ].filter(Boolean);
    if (missing.length > 0) {
      const error = `請先設定 ${missing.join('、')}`;
      setTestSummary({ provider: def.label, model: draft.model || '-', latency: 0, status: 'failed', error });
      setTesting(false);
      return;
    }
    const result = await testProviderConnection(draft);
    const latency = Date.now() - startedAt;
    const connected = result.success;
    const error = connected ? undefined : result.error || '不支援自動測試';
    setDraft((current) => ({
      ...current,
      connectionStatus: connected ? 'connected' : 'failed',
      lastTestedAt: Date.now(),
      lastTestLatencyMs: latency,
      lastConnectionError: error,
    }));
    setTestSummary({
      provider: def.label,
      model: draft.model || '-',
      latency,
      status: connected ? 'connected' : 'failed',
      error,
    });
    setTesting(false);
  };

  return (
    <div className="adv-form">
      <div className="lcap-detail-head">
        <ProviderLogo type={type} size={28} />
        <span className="lcap-detail-name">{def.label}</span>
      </div>

      <label className="adv-field">
        <span className="adv-field-label">Name</span>
        <input className="adv-input" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder={def.label} />
      </label>

      <label className="adv-field">
        <span className="adv-field-label">Base URL</span>
        <input className="adv-input" type="url" value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} placeholder={def.baseUrl} />
      </label>

      <label className="adv-field">
        <span className="adv-field-label">API Key</span>
        <div className="adv-input-row">
          <input className="adv-input" type={showKey ? 'text' : 'password'} value={draft.apiKey} autoComplete="off" spellCheck={false} onChange={(e) => patch({ apiKey: e.target.value })} placeholder="sk-..." style={{ flex: 1 }} />
          <button type="button" className="adv-input-btn" onClick={() => setShowKey((v) => !v)} tabIndex={-1}>
            <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              {showKey ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
            </svg>
          </button>
          {draft.apiKey && (
            <button type="button" className="adv-input-btn adv-input-btn--danger" onClick={() => patch({ apiKey: '', connectionStatus: 'untested' })} tabIndex={-1}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </label>

      <label className="adv-field">
        <span className="adv-field-label">Model</span>
        <div className="adv-input-row">
          <input className="adv-input" list={`detail-models-${type}`} value={draft.model} onChange={(e) => patch({ model: e.target.value })}
            placeholder={modelsLoading ? '載入模型中...' : modelsError ? '無法取得模型，可直接輸入 Model ID' : draft.model || '選擇或輸入 Model ID'}
            style={{ flex: 1 }} />
          <datalist id={`detail-models-${type}`}>
            {models.map((m) => <option key={m.sourceId} value={m.modelId} />)}
          </datalist>
          <button type="button" className="adv-input-btn" onClick={syncModels} disabled={modelsLoading} tabIndex={-1} title="同步模型">
            {modelsLoading ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>...</span>
            ) : (
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <path d="M21 12a9 9 0 1 1-9-9" /><path d="M12 3v9h9" /><path d="M21 3v6h-6" />
              </svg>
            )}
          </button>
          <button type="button" className="adv-input-btn adv-input-btn--accent" onClick={handleTest} disabled={testing} tabIndex={-1} title="測試連線">
            {testing
              ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>...</span>
              : <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
            }
          </button>
        </div>
        {modelsError && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
            無法取得模型，請檢查 API Key
          </div>
        )}
      </label>

      {testSummary && (
        <div className={`adv-test-summary is-${testSummary.status}`}>
          <div><span>Provider</span><strong>{testSummary.provider}</strong></div>
          <div><span>Model</span><strong>{testSummary.model}</strong></div>
          <div><span>Latency</span><strong>{testSummary.latency} ms</strong></div>
          <div><span>Status</span><strong>{testSummary.status === 'connected' ? '已連線' : '連線失敗'}</strong></div>
          {testSummary.error && <p>{testSummary.error}</p>}
        </div>
      )}

      <div className="adv-form-actions">
        <button type="button" className="liquid-btn" onClick={onCancel}>{t('adv.cancel')}</button>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={() => onSave(draft)}>儲存</button>
      </div>
    </div>
  );
}

export function AdvancedSettingsPage({ isOpen, onClose }: Props) {
  const providers = useAppStore((s) => s.providers || []);
  const addProvider = useAppStore((s) => s.addProvider);
  const updateProvider = useAppStore((s) => s.updateProvider);
  const aiRoles = useAppStore((s) => s.aiRoles);
  const setAiRole = useAppStore((s) => s.setAiRole);
  const mcpConnections = useAppStore((s) => s.mcpConnections || []);
  const createMcp = useAppStore((s) => s.createMcp);
  const updateMcp = useAppStore((s) => s.updateMcp);
  const deleteMcp = useAppStore((s) => s.deleteMcp);
  const showToast = useToastStore((s) => s.showToast);

  const [view, setView] = useState<ViewMode>('main');
  const [detailType, setDetailType] = useState<ProviderType | null>(null);
  const [capabilityRole, setCapabilityRole] = useState<AiRole | null>(null);
  const [mcpDetailId, setMcpDetailId] = useState<string | null>(null);

  const handleProviderCardClick = useCallback((type: ProviderType) => {
    setDetailType(type);
    setView('detail');
  }, []);

  const handleDetailSave = useCallback((p: ProviderConfig) => {
    const existing = providers.find((pr) => pr.type === detailType);
    const now = Date.now();
    if (existing) {
      updateProvider(existing.id, { ...p, updatedAt: now });
    } else {
      addProvider({ ...p, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    }
    showToast('已儲存');
    setView('main');
    setDetailType(null);
  }, [providers, detailType, addProvider, updateProvider, showToast]);

  const handleDetailCancel = useCallback(() => {
    setView('main');
    setDetailType(null);
  }, []);

  const handleCapabilityEdit = useCallback((role: AiRole) => {
    setCapabilityRole(role);
    setView('capability');
  }, []);

  const handleCapabilitySave = useCallback((patch: Partial<RoleConfig>) => {
    if (capabilityRole) {
      setAiRole(capabilityRole, patch);
      showToast('已儲存');
    }
    setView('main');
    setCapabilityRole(null);
  }, [capabilityRole, setAiRole, showToast]);

  const handleCapabilityCancel = useCallback(() => {
    setView('main');
    setCapabilityRole(null);
  }, []);

  const handleMcpClick = useCallback((id: string) => {
    setMcpDetailId(id);
    setView('mcp');
  }, []);

  const handleMcpNew = useCallback(() => {
    setMcpDetailId(null);
    setView('mcp');
  }, []);

  const handleMcpSave = useCallback((draft: MCPConnection) => {
    const existing = mcpConnections.find((c) => c.id === draft.id);
    if (existing) {
      updateMcp(draft.id, { ...draft });
    } else {
      createMcp(draft);
    }
    showToast('已儲存');
    setView('main');
    setMcpDetailId(null);
  }, [mcpConnections, createMcp, updateMcp, showToast]);

  const handleMcpDelete = useCallback(() => {
    if (mcpDetailId) {
      deleteMcp(mcpDetailId);
      showToast('已刪除外部服務');
    }
    setView('main');
    setMcpDetailId(null);
  }, [mcpDetailId, deleteMcp, showToast]);

  const handleMcpCancel = useCallback(() => {
    setView('main');
    setMcpDetailId(null);
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="adv-overlay" onClick={onClose}>
      <div className="adv" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('adv.title')}>
        <div className="adv-head">
          <button className="adv-back" onClick={view === 'detail' ? handleDetailCancel : view === 'capability' ? handleCapabilityCancel : view === 'mcp' ? handleMcpCancel : onClose} aria-label={t('skillDetail.back')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="adv-title">進階設定</h2>
            <p className="adv-subtitle">
              {view === 'detail' && detailType ? PROVIDER_DEFAULTS[detailType]?.label : ''}
              {view === 'capability' && capabilityRole ? CAPABILITY_LABELS[capabilityRole] : ''}
              {view === 'mcp' && (mcpDetailId ? mcpConnections.find((c) => c.id === mcpDetailId)?.name : '新增外部服務')}
              {view === 'main' ? '整合 Luna 的能力' : ''}
            </p>
          </div>
        </div>

        <div className="adv-body">
          {view === 'main' && (
            <>
              {/* ═══ 1. 已連接服務 ═══ */}
              {providers.filter((p) => p.connectionStatus === 'connected').length > 0 && (
                <div className="lcap-section" style={{ marginTop: 24 }}>
                  <div className="lcap-section-head">
                    <span className="lcap-section-title">已連接服務</span>
                    <span className="lcap-section-desc">已通過連線測試的 AI 服務</span>
                  </div>
                  <div className="asvc-list">
                    {providers
                      .filter((p) => p.connectionStatus === 'connected')
                      .map((p) => (
                        <button key={p.id} type="button" className="asvc-item" onClick={() => handleProviderCardClick(p.type)}>
                          <ProviderLogo type={p.type} size={20} />
                          <div className="asvc-info">
                            <span className="asvc-name">{p.name || PROVIDER_DEFAULTS[p.type]?.label || p.type}</span>
                          </div>
                          <span className="asvc-arrow">
                            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}><polyline points="9 18 15 12 9 6" /></svg>
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* ═══ 2. 新增服務 ═══ */}
              <div className="lcap-section" style={{ marginTop: 24, marginBottom: 0 }}>
                <div className="lcap-section-head">
                  <span className="lcap-section-title">新增服務</span>
                  <span className="lcap-section-desc">新增更多 AI 服務來擴充 Luna 的能力</span>
                </div>
                <div className="apgrid">
                  {PROVIDER_TYPES.map((pt) => {
                    const providerConfig = providers.find((p) => p.type === pt);
                    const hasConfig = Boolean(providerConfig);
                    const conn = providerConfig?.connectionStatus;
                    return (
                      <button
                        key={pt}
                        type="button"
                        className={`apgrid-card ${conn === 'connected' ? 'apgrid-card--connected' : ''} ${hasConfig && conn !== 'connected' ? 'apgrid-card--configured' : ''}`}
                        onClick={() => handleProviderCardClick(pt)}
                      >
                        <ProviderLogo type={pt} size={28} />
                        <span className="apgrid-name">{PROVIDER_DEFAULTS[pt].label}</span>
                        <span className={`apgrid-status is-${!hasConfig ? 'unconfigured' : conn === 'connected' ? 'connected' : conn === 'failed' ? 'failed' : 'configured'}`}>
                          {!hasConfig ? '未設定' : conn === 'connected' ? '已連線' : conn === 'failed' ? '連線失敗' : '已配置'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ═══ 外部服務 ═══ */}
              <div className="lcap-section" style={{ marginTop: 24 }}>
                <div className="lcap-section-head">
                  <span className="lcap-section-title">外部服務</span>
                  <span className="lcap-section-desc">連結外部工具與資料</span>
                </div>
                {mcpConnections.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)' }}>
                    <div style={{ fontSize: 13, marginBottom: 12 }}>尚無外部服務</div>
                    <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleMcpNew}>
                      + 新增外部服務
                    </button>
                  </div>
                ) : (
                  <>
                    {mcpConnections.filter((c) => c.enabled).length > 0 && (
                      <div className="lcap-section" style={{ marginTop: 8, marginBottom: 0 }}>
                        <div className="lcap-section-head" style={{ marginBottom: 4 }}>
                          <span className="lcap-section-title" style={{ fontSize: 12, color: 'var(--success)' }}>已連接</span>
                        </div>
                        <div className="asvc-list">
                          {mcpConnections.filter((c) => c.enabled).map((mcp) => (
                            <McpRow key={mcp.id} mcp={mcp} onClick={() => handleMcpClick(mcp.id)} />
                          ))}
                        </div>
                      </div>
                    )}
                    {mcpConnections.filter((c) => !c.enabled).length > 0 && (
                      <div className="lcap-section" style={{ marginTop: 8, marginBottom: 0 }}>
                        <div className="lcap-section-head" style={{ marginBottom: 4 }}>
                          <span className="lcap-section-title" style={{ fontSize: 12, color: 'var(--text-3)' }}>未連接</span>
                        </div>
                        <div className="asvc-list">
                          {mcpConnections.filter((c) => !c.enabled).map((mcp) => (
                            <McpRow key={mcp.id} mcp={mcp} onClick={() => handleMcpClick(mcp.id)} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="liquid-btn" onClick={handleMcpNew} style={{ width: '100%', justifyContent: 'center' }}>
                        + 新增外部服務
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {view === 'capability' && capabilityRole && (
            <CapabilityEditor
              role={capabilityRole}
              config={aiRoles[capabilityRole]}
              providers={providers}
              onSave={handleCapabilitySave}
              onCancel={handleCapabilityCancel}
            />
          )}

          {view === 'detail' && detailType && (
            <ProviderDetailForm
              type={detailType}
              onSave={handleDetailSave}
              onCancel={handleDetailCancel}
            />
          )}

          {view === 'mcp' && (() => {
            const mcp = mcpDetailId ? mcpConnections.find((c) => c.id === mcpDetailId) ?? null : null;
            return (
              <McpDetailPanel
                mcp={mcp}
                onSave={handleMcpSave}
                onDelete={handleMcpDelete}
                onCancel={handleMcpCancel}
              />
            );
          })()}
        </div>
      </div>
    </div>,
    document.body,
  );
}
