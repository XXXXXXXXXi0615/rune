import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { ProviderConfig } from '@/types';
import { ProviderLogo } from './ProviderLogo';
import { createProvider } from '@/config/providers';
import {
  getProviderAdapterMeta,
  listProviderAdapterMeta,
  connectionStateLabel,
  normalizeConnectionState,
  type ProviderAdapterMeta,
  type ProviderConnectionState,
} from '@/ai/providerAdapter';
import {
  getCredentialStore,
  makeCredentialId,
} from '@/ai/credentialStore';
import {
  applyModelSourceSelection,
  resolvePersistedModelSource,
  useProviderModels,
} from '@/ai/models';
import { getModelCapabilities } from '@/ai/modelCapabilities';
import './ProviderConfigWindow.css';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';

interface ProviderConfigWindowProps {
  provider: ProviderConfig | null;
  onClose: () => void;
}

export function ProviderConfigWindow({ provider, onClose }: ProviderConfigWindowProps) {
  const addProvider = useAppStore((s) => s.addProvider);
  const updateProvider = useAppStore((s) => s.updateProvider);
  const deleteProvider = useAppStore((s) => s.deleteProvider);
  const setDefaultProvider = useAppStore((s) => s.setDefaultProvider);
  const showToast = useToastStore((s) => s.showToast);

  const isNew = !provider;

  const [draft, setDraft] = useState<ProviderConfig>(() =>
    provider ? { ...provider, apiKey: '' } : createProvider('openai'),
  );
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState(() => {
    if (!provider) return false;
    const preset = getProviderAdapterMeta(provider.type).defaultBaseUrl;
    return provider.type === 'custom' || provider.baseUrl !== preset;
  });
  const [providerSearch, setProviderSearch] = useState('');
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
  const [activeProviderIndex, setActiveProviderIndex] = useState(0);
  const [connState, setConnState] = useState<ProviderConnectionState>('idle');
  const [connError, setConnError] = useState('');
  const [confirmClearKey, setConfirmClearKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [existingCredential, setExistingCredential] = useState(provider?.hasCredential ?? false);
  const savingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const adapterMeta = getProviderAdapterMeta(draft.type);
  const modelCapabilities = getModelCapabilities(draft.model);

  const patch = useCallback(
    (p: Partial<ProviderConfig>) => setDraft((d) => ({ ...d, ...p })),
    [],
  );

  const { models, loading: modelsLoading, error: modelsError, sync: syncModels } = useProviderModels(
    draft.type,
    keyInput,
    draft.baseUrl || adapterMeta.defaultBaseUrl,
  );

  const currentSource = useMemo(
    () => resolvePersistedModelSource(draft.type, draft.model),
    [draft.type, draft.model],
  );

  const providerOptions = useMemo(() => listProviderAdapterMeta(), []);
  const filteredProviderOptions = useMemo(() => {
    const needle = providerSearch.trim().toLocaleLowerCase();
    if (!needle) return providerOptions;
    return providerOptions.filter((option) =>
      [option.id, option.displayName].some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [providerOptions, providerSearch]);
  const currentModelWasDiscovered = models.some((model) => model.modelId === draft.model);

  const resolveKeyForRuntime = useCallback(async (): Promise<string> => {
    if (keyInput.length > 0) return keyInput;
    const credId = draft.credentialId || makeCredentialId(draft.id);
    const store = await getCredentialStore();
    const stored = await store.getCredential(credId);
    return stored || '';
  }, [keyInput, draft.credentialId, draft.id]);

  const handleProviderSelect = useCallback((meta: ProviderAdapterMeta) => {
    const providerChanged = meta.id !== draft.type;
    const defaults = createProvider(meta.id);
    setDraft((prev) => ({
      ...applyModelSourceSelection(prev, { providerId: meta.id, modelId: providerChanged ? '' : prev.model }),
      name: isNew ? meta.displayName : prev.name,
      baseUrl: providerChanged ? meta.defaultBaseUrl : prev.baseUrl,
      connectionStatus: 'untested',
      lastTestedAt: undefined,
      lastTestLatencyMs: undefined,
      lastConnectionError: undefined,
      modelsEndpoint: defaults.modelsEndpoint,
      chatEndpoint: defaults.chatEndpoint,
      ...(providerChanged ? {
        apiKey: '', hasCredential: false, credentialId: undefined, credentialUpdatedAt: undefined,
      } : {}),
    }));
    if (providerChanged) {
      setKeyInput('');
      setExistingCredential(false);
      setConfirmClearKey(false);
    }
    setConnState('idle');
    setConnError('');
    if (providerChanged) setCustomEndpoint(false);
    if (meta.id === 'custom') setCustomEndpoint(true);
    setProviderSearch('');
    setProviderSelectorOpen(false);
    setActiveProviderIndex(0);
  }, [draft.type, isNew]);

  const handleTestConnection = useCallback(async () => {
    const key = await resolveKeyForRuntime();
    if (!key) {
      showToast('請先輸入 API Key');
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setConnState('testing');
    setConnError('');
    const start = Date.now();
    try {
      const base = (draft.baseUrl || adapterMeta.defaultBaseUrl).replace(/\/$/, '');
      const path = adapterMeta.chatEndpointPath || '/models';
      const url = `${base}${path}`;
      const method = 'GET';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (draft.type === 'gemini') {
        headers['x-goog-api-key'] = key;
      } else if (draft.type !== 'ollama') {
        headers['Authorization'] = `Bearer ${key}`;
      }
      const fullUrl = `${base}${path}`;

      const response = await fetch(fullUrl, { method, headers, signal });
      const latency = Date.now() - start;

      if (signal.aborted) return;

      if (response.ok || response.status === 200) {
        setConnState('connected');
        patch({ connectionStatus: 'connected', lastTestedAt: Date.now(), lastTestLatencyMs: latency, lastConnectionError: undefined });
        showToast('連線成功');
      } else if (response.status === 401 || response.status === 403) {
        setConnState('unauthorized');
        setConnError('API Key 無效或權限不足');
      } else if (response.status === 404) {
        setConnState('model_not_found');
        setConnError('端點或模型不存在');
      } else if (response.status === 429) {
        setConnState('rate_limited');
        setConnError('超過請求頻率限制');
      } else {
        setConnState('unknown');
        setConnError(`伺服器回應 ${response.status}`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setConnState(normalizeConnectionState(msg));
      setConnError(msg);
    }
  }, [resolveKeyForRuntime, draft.baseUrl, draft.type, adapterMeta, showToast, patch]);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const now = Date.now();

    const credStore = await getCredentialStore();
    const credId = draft.credentialId || makeCredentialId(draft.id);
    const merged = { ...draft, credentialId: credId };

    if (keyInput.length > 0) {
      await credStore.setCredential(credId, keyInput);
      merged.hasCredential = true;
      merged.credentialUpdatedAt = now;
      merged.apiKey = '';
    } else if (existingCredential) {
      merged.hasCredential = true;
      merged.apiKey = '';
    } else {
      merged.hasCredential = false;
      merged.apiKey = '';
    }

    if (confirmClearKey && existingCredential) {
      await credStore.deleteCredential(credId);
      merged.hasCredential = false;
      merged.credentialUpdatedAt = undefined;
      merged.apiKey = '';
      merged.credentialId = undefined as any;
      setConfirmClearKey(false);
      setExistingCredential(false);
    }

    if (isNew) {
      addProvider({ ...merged, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
    } else {
      updateProvider(draft.id, { ...merged, updatedAt: now });
    }
    showToast(isNew ? '已新增提供者' : '已儲存');
    savingRef.current = false;
    setKeyInput('');
    onClose();
  }, [draft, keyInput, existingCredential, confirmClearKey, isNew, addProvider, updateProvider, showToast, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const missingTestRequirements = [
    draft.type !== 'ollama' && !existingCredential && keyInput.length === 0 ? 'API Key' : null,
    !(draft.baseUrl || adapterMeta.defaultBaseUrl) ? '端點' : null,
  ].filter(Boolean) as string[];

  return (
    <MobileShellOverlay onClose={onClose} variant="fullscreen" dismissOnBackdrop={false}>
    <div className="pcw-backdrop" data-clawd-safe="provider-config">
      <section
        className="pcw-shell"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? '新增提供者' : `設定 ${adapterMeta.displayName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pcw-header">
          <div className="pcw-header__left">
            <ProviderLogo type={draft.type} size={28} />
            <div>
              <p className="pcw-header__kicker">提供者設定</p>
              <h2 className="pcw-header__title">{adapterMeta.displayName}</h2>
            </div>
          </div>
          <div className="pcw-header__right">
            {connState !== 'idle' && (
              <span className={`pcw-status-badge pcw-status--${connState}`}>
                {connectionStateLabel(connState)}
              </span>
            )}
            <button type="button" className="pcw-header__close" onClick={onClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="pcw-body">
          <div className="pcw-section pcw-provider-model-flow">
            <div className="pcw-provider-selector">
              <span className="pcw-field__label" id="pcw-provider-label">Provider</span>
              <div className="pcw-provider-combobox">
                <ProviderLogo type={draft.type} size={20} />
                <input
                  className="pcw-provider-search"
                  role="combobox"
                  aria-labelledby="pcw-provider-label"
                  aria-expanded={providerSelectorOpen}
                  aria-controls="pcw-provider-list"
                  aria-autocomplete="list"
                  value={providerSearch}
                  placeholder={adapterMeta.displayName}
                  onFocus={() => setProviderSelectorOpen(true)}
                  onClick={() => setProviderSelectorOpen(true)}
                  onChange={(event) => {
                    setProviderSearch(event.target.value);
                    setProviderSelectorOpen(true);
                    setActiveProviderIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setProviderSelectorOpen(true);
                      setActiveProviderIndex((index) => Math.min(index + 1, Math.max(0, filteredProviderOptions.length - 1)));
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveProviderIndex((index) => Math.max(0, index - 1));
                    } else if (event.key === 'Enter' && providerSelectorOpen && filteredProviderOptions[activeProviderIndex]) {
                      event.preventDefault();
                      handleProviderSelect(filteredProviderOptions[activeProviderIndex]);
                    } else if (event.key === 'Escape' && providerSelectorOpen) {
                      event.preventDefault();
                      event.stopPropagation();
                      setProviderSelectorOpen(false);
                    }
                  }}
                />
              </div>
              {providerSelectorOpen && (
                <div className="pcw-provider-menu" id="pcw-provider-list" role="listbox">
                  {filteredProviderOptions.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={option.id === draft.type}
                      className={`pcw-provider-option ${index === activeProviderIndex ? 'is-active' : ''}`}
                      data-provider-id={option.id}
                      onMouseEnter={() => setActiveProviderIndex(index)}
                      onClick={() => handleProviderSelect(option)}
                    >
                      <ProviderLogo type={option.id} size={18} />
                      <span>{option.displayName}</span>
                      <small>{option.id}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="pcw-field" data-source-id={currentSource.sourceId}>
              <span className="pcw-field__label">Model ID</span>
              <div className="pcw-model-id-row">
                <input
                  className="pcw-field__input"
                  value={draft.model}
                  list={`pcw-dynamic-models-${draft.type}`}
                  onChange={(event) => patch({ model: event.target.value, connectionStatus: 'untested' })}
                  placeholder="選擇或輸入 Model ID"
                />
                <button
                  type="button"
                  className="pcw-model-refresh"
                  onClick={syncModels}
                  disabled={modelsLoading}
                  aria-label={`重新取得 ${adapterMeta.displayName} 模型`}
                >
                  {modelsLoading ? '…' : '↻'}
                </button>
              </div>
              <datalist id={`pcw-dynamic-models-${draft.type}`}>
                {models.map((model) => <option key={model.sourceId} value={model.modelId}>{model.name}</option>)}
              </datalist>
              {modelsError && <span className="pcw-field__hint">無法取得模型，可直接輸入 Model ID。</span>}
              {!modelsError && draft.model && !currentModelWasDiscovered && (
                <span className="pcw-field__hint">目前設定 · 未出現在最近取得的模型列表</span>
              )}
            </label>

            {draft.type === 'custom' && (
              <label className="pcw-field" data-testid="provider-custom-path">
                <span className="pcw-field__label">Endpoint</span>
                <input
                  className="pcw-field__input"
                  type="url"
                  value={draft.baseUrl}
                  onChange={(event) => patch({ baseUrl: event.target.value, connectionStatus: 'untested' })}
                  placeholder="https://..."
                />
              </label>
            )}
          </div>

          <div className="pcw-section">
            <label className="pcw-field">
              <span className="pcw-field__label">顯示名稱</span>
              <input
                className="pcw-field__input"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={adapterMeta.displayName}
              />
            </label>
          </div>

          <div className="pcw-section">
            <label className="pcw-field">
              <span className="pcw-field__label">API Key</span>
              {adapterMeta.apiKeyHelpText && (
                <span className="pcw-field__hint">{adapterMeta.apiKeyHelpText}</span>
              )}
              {existingCredential && !confirmClearKey && (
                <span className="pcw-field__hint" style={{ color: '#4a9e6e' }}>
                  已保存憑證，留空將保持不變
                </span>
              )}
              {!isNew && !existingCredential && (
                <span className="pcw-field__hint">瀏覽器模式不會永久保存 API Key</span>
              )}
              <div className="pcw-key-row">
                <input
                  className="pcw-field__input"
                  type={showKey ? 'text' : 'password'}
                  value={keyInput}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    setConnState('idle');
                    setConnError('');
                    setConfirmClearKey(false);
                  }}
                  placeholder={
                    existingCredential
                      ? '留空保持現有憑證'
                      : adapterMeta.apiKeyPlaceholder || 'API Key'
                  }
                />
                <button
                  type="button"
                  className="pcw-btn pcw-btn--inline"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? '隱藏' : '顯示'}
                >
                  {showKey ? '隱藏' : '顯示'}
                </button>
                {existingCredential && !confirmClearKey && (
                  <button
                    type="button"
                    className="pcw-btn pcw-btn--danger"
                    onClick={() => setConfirmClearKey(true)}
                  >
                    清除憑證
                  </button>
                )}
                {confirmClearKey && (
                  <>
                    <button
                      type="button"
                      className="pcw-btn pcw-btn--danger"
                      onClick={() => {
                        setKeyInput('');
                        setExistingCredential(false);
                        setConfirmClearKey(false);
                        setConnState('idle');
                      }}
                    >
                      確認清除
                    </button>
                    <button
                      type="button"
                      className="pcw-btn pcw-btn--inline"
                      onClick={() => setConfirmClearKey(false)}
                    >
                      取消
                    </button>
                  </>
                )}
                {!existingCredential && keyInput.length > 0 && (
                  <button
                    type="button"
                    className="pcw-btn pcw-btn--inline"
                    onClick={() => setKeyInput('')}
                    style={{ color: 'var(--text-3)' }}
                  >
                    清空
                  </button>
                )}
              </div>
            </label>
          </div>

          <div className="pcw-section">
            <button
              type="button"
              className={`pcw-advanced-toggle ${advancedOpen ? 'is-open' : ''}`}
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              <span>進階選項</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {advancedOpen && (
              <div className="pcw-advanced-body">
                {!isNew && <div className="pcw-management-row">
                  {!draft.isDefault && <button type="button" className="pcw-btn pcw-btn--secondary" onClick={() => { setDefaultProvider(draft.id); patch({ isDefault: true }); showToast('已設為預設'); }}>設為預設</button>}
                  <button type="button" className="pcw-btn pcw-btn--danger" onClick={() => {
                    if (!confirmDelete) { setConfirmDelete(true); return; }
                    deleteProvider(draft.id); showToast('已刪除'); onClose();
                  }}>{confirmDelete ? '確認刪除提供者' : '刪除提供者'}</button>
                  {confirmDelete && <button type="button" className="pcw-btn pcw-btn--ghost" onClick={() => setConfirmDelete(false)}>取消刪除</button>}
                </div>}
                <section className="pcw-advanced-group" aria-labelledby="pcw-generation-heading">
                  <h4 id="pcw-generation-heading">生成</h4>
                  <label className="pcw-switch-row">
                    <div><span>串流輸出</span><small>即時顯示 AI 回覆</small></div>
                    <label className="pcw-switch">
                      <input type="checkbox" checked={draft.streamingEnabled} onChange={(e) => patch({ streamingEnabled: e.target.checked })} />
                      <span className="pcw-switch__slider" />
                    </label>
                  </label>
                  {modelCapabilities.supportsTemperature && (
                    <label className="pcw-field">
                      <div className="pcw-range-head">
                        <span className="pcw-field__label">Temperature</span>
                        <span className="pcw-range-value">{draft.temperature.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={modelCapabilities.temperatureRange[0]}
                        max={modelCapabilities.temperatureRange[1]}
                        step="0.1"
                        value={draft.temperature}
                        onChange={(e) => patch({ temperature: parseFloat(e.target.value) })}
                        className="pcw-range"
                      />
                    </label>
                  )}
                  {modelCapabilities.supportsMaxOutputTokens && (
                    <label className="pcw-field">
                      <span className="pcw-field__label">最大輸出 Tokens</span>
                      <input
                        className="pcw-field__input"
                        type="number"
                        min={1}
                        max={modelCapabilities.maxOutputTokens}
                        value={draft.maxTokens}
                        onChange={(e) => patch({ maxTokens: parseInt(e.target.value, 10) || 4096 })}
                      />
                    </label>
                  )}
                </section>

                <section className="pcw-advanced-group" aria-labelledby="pcw-connection-heading">
                  <h4 id="pcw-connection-heading">連線</h4>
                  <div className="pcw-endpoint-summary">
                    <span><strong>Endpoint</strong><small>{draft.type === 'custom' ? '由上方 Endpoint 設定' : customEndpoint ? '自訂 Endpoint' : `自動 · ${adapterMeta.displayName} 官方端點`}</small></span>
                    {!customEndpoint && draft.type !== 'custom' && (
                      <button type="button" className="pcw-btn pcw-btn--inline" onClick={() => setCustomEndpoint(true)}>覆寫 Endpoint</button>
                    )}
                  </div>
                  {customEndpoint && draft.type !== 'custom' && (
                    <label className="pcw-field">
                      <span className="pcw-field__label">Base URL</span>
                      <input
                        className="pcw-field__input"
                        type="url"
                        value={draft.baseUrl}
                        onChange={(e) => patch({ baseUrl: e.target.value, connectionStatus: 'untested' })}
                        placeholder={adapterMeta.defaultBaseUrl || 'https://...'}
                      />
                      <button
                        type="button"
                        className="pcw-restore-endpoint"
                        onClick={() => {
                          patch({ baseUrl: adapterMeta.defaultBaseUrl, connectionStatus: 'untested' });
                          setCustomEndpoint(false);
                        }}
                      >
                        恢復自動
                      </button>
                    </label>
                  )}
                </section>

                <section className="pcw-advanced-group" aria-labelledby="pcw-context-heading">
                  <h4 id="pcw-context-heading">對話上下文</h4>
                  <label className="pcw-field">
                    <span className="pcw-field__label">上下文保留訊息數</span>
                    <input
                      className="pcw-field__input"
                      type="number"
                      min={1}
                      max={200}
                      value={draft.contextMessageLimit}
                      onChange={(e) => patch({ contextMessageLimit: parseInt(e.target.value, 10) || 20 })}
                    />
                  </label>
                </section>
              </div>
            )}
          </div>

          {connError && (
            <div className="pcw-conn-error">{connError}</div>
          )}
        </div>

        <footer className="pcw-footer">
          <div className="pcw-footer__left">
            <div className="pcw-test-control"><button
              type="button"
              className="pcw-btn pcw-btn--secondary"
              onClick={handleTestConnection}
              disabled={connState === 'testing' || missingTestRequirements.length > 0}
            >
              {connState === 'testing' ? '測試中…' : '測試連線'}
            </button>{missingTestRequirements.length > 0 && <small>需要：{missingTestRequirements.join('、')}</small>}</div>
          </div>
          <div className="pcw-footer__right">
            <button type="button" className="pcw-btn pcw-btn--ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="pcw-btn pcw-btn--primary" onClick={handleSave}>
              {isNew ? '新增提供者' : '儲存變更'}
            </button>
          </div>
        </footer>
      </section>
    </div>
    </MobileShellOverlay>
  );
}
