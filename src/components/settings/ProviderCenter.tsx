import { useCallback, useState } from 'react';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { useAppStore } from '@/store/useAppStore';
import { PROVIDER_DEFAULTS } from '@/config/providers';
import type { ProviderConfig } from '@/types';
import { ProviderLogo } from './ProviderLogo';
import { ProviderConfigWindow } from './ProviderConfigWindow';
import { connectionStateLabel, normalizeConnectionState } from '@/ai/providerAdapter';
import {
  getCredentialStore,
  hasAcknowledgedWebFallback,
  storageStateLabel,
} from '@/ai/credentialStore';

function credUiLabel(hasCred: boolean, apiKeyPresent: boolean): { label: string; color: string } {
  if (hasCred && hasAcknowledgedWebFallback()) {
    return { label: '已保存（本機）', color: '#c8912a' };
  }
  if (hasCred) {
    const caps = (() => {
      try { return (window as any).__lunartide_cred_caps; } catch { return null; }
    })();
    if (caps?.persistence === 'memory') {
      return { label: '本次工作階段可用', color: '#c8912a' };
    }
    return { label: '已保存且可用', color: 'var(--success)' };
  }
  if (apiKeyPresent) {
    return { label: '憑證遷移中', color: 'var(--text-4)' };
  }
  return { label: '需要設定憑證', color: 'var(--text-4)' };
}

function ProviderStatusBadge({ provider }: { provider: ProviderConfig }) {
  const status = provider.connectionStatus || 'untested';
  const lastError = provider.lastConnectionError;
  const connState = normalizeConnectionState(lastError || (status === 'connected' ? '' : undefined));
  const label = status === 'connected' ? '已連接' : status === 'failed' ? connectionStateLabel(connState) : '尚未測試';
  const cls = status === 'connected' ? 'is-ok' : status === 'failed' ? 'is-error' : '';
  return (
    <span className={`ah-lunaris-companion-status ${cls}`}>
      {label}
    </span>
  );
}

export function ProviderCenter({
  isOpen,
  onClose,
  embedded = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}) {
  const providers = useAppStore((s) => s.providers || []);
  const updateProvider = useAppStore((s) => s.updateProvider);

  const [configProvider, setConfigProvider] = useState<ProviderConfig | null>(null);
  const [showNew, setShowNew] = useState(false);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    updateProvider(id, { enabled, updatedAt: Date.now() });
  }, [updateProvider]);

  if (!isOpen) return null;

  const enabledCount = providers.filter((p) => p.enabled).length;

  const content = (
    <div className={embedded ? 'settings-embedded-provider' : 'ai-sheet'} onClick={(e) => e.stopPropagation()} style={embedded ? undefined : { maxWidth: 430, margin: '0 auto' }}>
      {!embedded && (
        <div className="quick-sheet-handle" />
      )}
      {!embedded && (
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">提供者</span>
          {providers.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {enabledCount}/{providers.length} 已啟用
            </span>
          )}
        </div>
      )}

      <div className={embedded ? 'settings-panel-scroll' : 'ai-sheet-body'} style={embedded ? undefined : { maxHeight: '62vh', overflowY: 'auto' }}>
        {providers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', opacity: 0.5,
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 1.5 }}>
                <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
                <circle cx="12" cy="13" r="2" />
              </svg>
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 4, fontWeight: 500 }}>
              尚未設定任何提供者
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
              新增一個提供者來開始設定 AI 連線
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowNew(true)}
              style={{ justifyContent: 'center', paddingLeft: 28, paddingRight: 28 }}
            >
              新增提供者
            </button>
          </div>
        ) : (
          <>
            <div className="provider-card-list">
              {providers.map((p) => {
                const hasCred = p.hasCredential ?? Boolean(p.apiKey);
                const defaultModel = p.model || '未設定模型';
                return (
                  <div key={p.id} className="provider-card" data-enabled={p.enabled || undefined}>
                    <div className="provider-card__main">
                      <ProviderLogo type={p.type} size={18} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="provider-card__identity">
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                          {p.isDefault && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 8px', borderRadius: 8 }}>預設</span>
                          )}
                        </div>
                        <div className="provider-card__model">
                          {defaultModel}
                        </div>
                        <div className="provider-card__state" style={{ color: credUiLabel(hasCred, Boolean(p.apiKey)).color }}>
                          <ProviderStatusBadge provider={p} /> · {credUiLabel(hasCred, Boolean(p.apiKey)).label}
                        </div>
                      </div>

                      <label className="liquid-switch" style={{ flexShrink: 0 }}>
                        <input type="checkbox" checked={p.enabled}
                          onChange={() => handleToggle(p.id, !p.enabled)} />
                        <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                      </label>
                    </div>

                    <button type="button" className="provider-card__manage" onClick={() => setConfigProvider(p)}>管理</button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowNew(true)}
              style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
            >
              + 新增提供者
            </button>
          </>
        )}
      </div>

      {configProvider && (
        <ProviderConfigWindow
          provider={configProvider}
          onClose={() => setConfigProvider(null)}
        />
      )}

      {showNew && (
        <ProviderConfigWindow
          provider={null}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );

  if (embedded) return content;

  return (
    <MobileShellOverlay onClose={onClose} variant="sheet">
    <div className="ai-sheet-overlay" data-clawd-safe="provider-center">
      {content}
    </div>
    </MobileShellOverlay>
  );
}
