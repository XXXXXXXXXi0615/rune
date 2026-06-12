import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import {
  PROVIDER_DEFAULTS,
  PROVIDER_TYPES,
  createProvider,
} from '@/config/providers';
import type { ProviderConfig, ProviderType } from '@/types';

// ── Per-type colour & icon ──

const TYPE_COLORS: Record<ProviderType, string> = {
  openai:     '#10a37f',
  claude:     '#d4773c',
  gemini:     '#4a9ae8',
  deepseek:   '#536dfe',
  openrouter: '#7c3aed',
  ollama:     '#f0f0f0',
  custom:     '#888',
};

function TypeIcon({ type, size }: { type: ProviderType; size?: number }) {
  const s = size || 18;
  const c = TYPE_COLORS[type];
  return (
    <svg viewBox="0 0 36 36" style={{ width: s, height: s, flexShrink: 0, fill: 'none', stroke: c, strokeWidth: 1.5 }}>
      <circle cx="18" cy="18" r="14" />
      <path d="M18 6v24M6 18h24" />
    </svg>
  );
}

// ── Provider form (add / edit) ──

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ProviderConfig | null;
  onSave: (p: ProviderConfig) => void;
  onCancel: () => void;
}) {
  const isNew = !initial;
  const [draft, setDraft] = useState<ProviderConfig>(
    initial || createProvider('openai'),
  );
  const [showKey, setShowKey] = useState(false);

  const patch = (p: Partial<ProviderConfig>) => setDraft((d) => ({ ...d, ...p }));
  const handleType = (t: ProviderType) => {
    const def = PROVIDER_DEFAULTS[t];
    setDraft((d) => ({ ...d, type: t, baseUrl: def.baseUrl || d.baseUrl, name: d.name || def.label }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
      {/* Type selector */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="settings-label">Provider</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PROVIDER_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => handleType(t)}
              style={{
                padding: '5px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: draft.type === t ? 'var(--accent)' : 'var(--surface-2)',
                color: draft.type === t ? '#fff' : 'var(--text-2)',
                border: 'none', display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <TypeIcon type={t} size={14} />
              {PROVIDER_DEFAULTS[t].label}
            </button>
          ))}
        </div>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="settings-label">名稱</span>
        <input className="quick-sheet-input" value={draft.name}
          onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. My Claude" />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="settings-label">Base URL</span>
        <input className="quick-sheet-input" type="url" value={draft.baseUrl}
          onChange={(e) => patch({ baseUrl: e.target.value })}
          placeholder={PROVIDER_DEFAULTS[draft.type].baseUrl || 'https://...'} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="settings-label">API Key</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="quick-sheet-input" type={showKey ? 'text' : 'password'}
            value={draft.apiKey} autoComplete="off" spellCheck={false}
            onChange={(e) => patch({ apiKey: e.target.value })}
            placeholder="sk-..." style={{ flex: 1 }} />
          <button type="button" className="settings-btn settings-inline-btn"
            onClick={() => setShowKey((v) => !v)}>
            {showKey ? '隱藏' : '顯示'}
          </button>
        </div>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="settings-label">Model</span>
        <input className="quick-sheet-input" value={draft.model}
          onChange={(e) => patch({ model: e.target.value })}
          placeholder="gpt-4o / claude-sonnet-4-6 / deepseek-chat / ..." />
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
        <button type="button" className="btn-primary" onClick={() => onSave(draft)}>
          {isNew ? '新增' : '儲存'}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ──

export function ProviderCenter({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const providers = useAppStore((s) => s.providers || []);
  const addProvider = useAppStore((s) => s.addProvider);
  const updateProvider = useAppStore((s) => s.updateProvider);
  const deleteProvider = useAppStore((s) => s.deleteProvider);
  const setDefaultProvider = useAppStore((s) => s.setDefaultProvider);
  const showToast = useToastStore((s) => s.showToast);

  const [editing, setEditing] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleSave = useCallback((p: ProviderConfig) => {
    const now = Date.now();
    if (editing === 'new') {
      addProvider({ ...p, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      showToast('已新增 Provider');
    } else {
      updateProvider(p.id, { ...p, updatedAt: now });
      showToast('已儲存');
    }
    setEditing(null);
  }, [editing, addProvider, updateProvider, showToast]);

  const handleDelete = useCallback((id: string) => {
    deleteProvider(id);
    setDeleteConfirm(null);
    setEditing(null);
    showToast('已刪除');
  }, [deleteProvider, showToast]);

  const handleToggle = useCallback((id: string, enabled: boolean) => {
    updateProvider(id, { enabled, updatedAt: Date.now() });
  }, [updateProvider]);

  const handleSetDefault = useCallback((id: string) => {
    setDefaultProvider(id);
    showToast('已設為預設');
  }, [setDefaultProvider, showToast]);

  if (!isOpen) return null;

  const editingProvider = editing && editing !== 'new'
    ? providers.find((p) => p.id === editing) || null
    : null;
  const enabledCount = providers.filter((p) => p.enabled).length;

  return createPortal(
    <div className="ai-sheet-overlay" onClick={onClose}>
      <div className="ai-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 430, margin: '0 auto' }}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">Provider Center</span>
          {providers.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {enabledCount}/{providers.length} 已啟用
            </span>
          )}
        </div>

        <div className="ai-sheet-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {editing ? (
            <ProviderForm
              initial={editingProvider}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              {providers.length === 0 ? (
                /* ═══════ Empty state ═══════ */
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
                    尚未設定任何 Provider
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
                    新增一個 Provider 來開始設定 AI 連線
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setEditing('new')}
                    style={{ justifyContent: 'center', paddingLeft: 28, paddingRight: 28 }}
                  >
                    新增第一個 Provider
                  </button>
                </div>
              ) : (
                /* ═══════ Provider cards ═══════ */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {providers.map((p) => (
                    <div key={p.id} style={{
                      background: 'var(--surface-2)', borderRadius: 16, padding: '14px 16px',
                      opacity: p.enabled ? 1 : 0.55, transition: 'opacity 0.2s',
                    }}>
                      {/* Top row: icon + name + badges + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <TypeIcon type={p.type} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                            {p.isDefault && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                                background: 'var(--accent-soft)', padding: '1px 8px', borderRadius: 8,
                              }}>預設</span>
                            )}
                            <span style={{
                              fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 8,
                              background: p.enabled ? 'rgba(93,184,114,0.12)' : 'rgba(255,255,255,0.06)',
                              color: p.enabled ? 'var(--success)' : 'var(--text-3)',
                            }}>
                              {p.enabled ? '已啟用' : '已停用'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                            {p.model || '未設定 model'} · {PROVIDER_DEFAULTS[p.type].label}
                          </div>
                        </div>

                        {/* Enable toggle */}
                        <label className="liquid-switch" style={{ flexShrink: 0 }}>
                          <input type="checkbox" checked={p.enabled}
                            onChange={() => handleToggle(p.id, !p.enabled)} />
                          <span className="liquid-switch-track" /><span className="liquid-switch-knob" />
                        </label>
                      </div>

                      {/* Bottom row: actions */}
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {!p.isDefault && (
                          <button type="button" onClick={() => handleSetDefault(p.id)}
                            style={{
                              background: 'none', border: '1px solid var(--surface-3, #2a2a2a)',
                              borderRadius: 8, color: 'var(--text-2)', cursor: 'pointer',
                              padding: '3px 10px', fontSize: 11,
                            }}>
                            設為預設
                          </button>
                        )}
                        <button type="button" onClick={() => setEditing(p.id)}
                          style={{
                            background: 'none', border: '1px solid var(--surface-3, #2a2a2a)',
                            borderRadius: 8, color: 'var(--text-2)', cursor: 'pointer',
                            padding: '3px 10px', fontSize: 11,
                          }}>
                          編輯
                        </button>
                        {deleteConfirm === p.id ? (
                          <>
                            <button type="button" onClick={() => handleDelete(p.id)}
                              style={{
                                background: 'var(--danger)', border: 'none', borderRadius: 8,
                                color: '#fff', cursor: 'pointer', padding: '3px 10px', fontSize: 11,
                              }}>確認刪除</button>
                            <button type="button" onClick={() => setDeleteConfirm(null)}
                              style={{
                                background: 'var(--surface-2)', border: '1px solid var(--surface-3, #2a2a2a)',
                                borderRadius: 8, color: 'var(--text-2)', cursor: 'pointer',
                                padding: '3px 10px', fontSize: 11,
                              }}>取消</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setDeleteConfirm(p.id)}
                            style={{
                              background: 'none', border: '1px solid var(--surface-3, #2a2a2a)',
                              borderRadius: 8, color: 'var(--danger)', cursor: 'pointer',
                              padding: '3px 10px', fontSize: 11,
                            }}>
                            刪除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add button (always visible when not editing) */}
              <button
                type="button"
                className="btn-primary"
                onClick={() => setEditing('new')}
                style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
              >
                + 新增 Provider
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
