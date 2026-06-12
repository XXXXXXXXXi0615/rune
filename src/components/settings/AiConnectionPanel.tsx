import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { AiConnectionConfig, AiConnectionModel, AiConnectionProvider, AiConnectionStatus } from '@/types';

type ProviderPreset = {
  label: string;
  descriptionKey: string;
  compatibilityMode: AiConnectionConfig['compatibilityMode'];
  defaultBaseUrl: string;
  modelsEndpoint: string;
  chatEndpoint: string;
  experimental?: boolean;
};

const PROVIDER_PRESETS: Record<AiConnectionProvider, ProviderPreset> = {
  openai: {
    label: 'OpenAI',
    descriptionKey: 'ai.provider.openai.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  'openai-compatible': {
    label: 'OpenAI-compatible',
    descriptionKey: 'ai.provider.compatible.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: '',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  deepseek: {
    label: 'DeepSeek',
    descriptionKey: 'ai.provider.deepseek.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  gemini: {
    label: 'Gemini',
    descriptionKey: 'ai.provider.gemini.desc',
    compatibilityMode: 'native-gemini',
    defaultBaseUrl: '',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    experimental: true,
  },
  claude: {
    label: 'Claude',
    descriptionKey: 'ai.provider.claude.desc',
    compatibilityMode: 'native-claude',
    defaultBaseUrl: '',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    experimental: true,
  },
  openrouter: {
    label: 'OpenRouter',
    descriptionKey: 'ai.provider.openrouter.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  groq: {
    label: 'Groq',
    descriptionKey: 'ai.provider.groq.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  siliconflow: {
    label: 'SiliconFlow',
    descriptionKey: 'ai.provider.siliconflow.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  ollama: {
    label: 'Ollama',
    descriptionKey: 'ai.provider.ollama.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
  'custom-relay': {
    label: '自訂中轉站',
    descriptionKey: 'ai.provider.customRelay.desc',
    compatibilityMode: 'openai-compatible',
    defaultBaseUrl: '',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  },
};

const PROVIDERS = Object.keys(PROVIDER_PRESETS) as AiConnectionProvider[];

const STATUS_KEYS: Record<AiConnectionStatus, string> = {
  not_configured: 'ai.status.notConfigured',
  configured: 'ai.status.configured',
  testing: 'ai.status.testing',
  ok: 'ai.status.ok',
  error: 'ai.status.error',
};

function endpointUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const cleanEndpoint = endpoint.trim().startsWith('/') ? endpoint.trim() : `/${endpoint.trim()}`;
  return `${cleanBase}${cleanEndpoint}`;
}

function parseModels(payload: unknown, provider: string): AiConnectionModel[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown; models?: unknown }).data ?? (payload as { models?: unknown }).models;
  if (!Array.isArray(data)) return [];
  return data
    .map((item): AiConnectionModel | null => {
      if (typeof item === 'string') return { id: item, provider };
      if (!item || typeof item !== 'object') return null;
      const id = (item as { id?: unknown; name?: unknown }).id ?? (item as { name?: unknown }).name;
      if (typeof id !== 'string' || !id.trim()) return null;
      const label = (item as { label?: unknown }).label;
      return { id: id.trim(), label: typeof label === 'string' ? label : id.trim(), provider };
    })
    .filter((item): item is AiConnectionModel => Boolean(item));
}

function validateDraft(draft: AiConnectionConfig, needsModel: boolean): string | null {
  if (!draft.baseUrl.trim()) return t('ai.error.baseUrl');
  if (draft.provider !== 'ollama' && !draft.apiKey.trim()) return t('ai.error.apiKey');
  if (needsModel && !draft.model.trim()) return t('ai.error.model');
  return null;
}

function AiIcon({ status }: { status: AiConnectionStatus }) {
  if (status === 'ok') {
    return (
      <svg viewBox="0 0 24 24" className="ai-entry-icon ok" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.4l2.4 2.4L16.5 8.8" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg viewBox="0 0 24 24" className="ai-entry-icon error" aria-hidden="true">
        <path d="M12 3l9 16H3L12 3z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="ai-entry-icon" aria-hidden="true">
      <path d="M10 13a5 5 0 007.1 0l2-2a5 5 0 00-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 00-7.1 0l-2 2A5 5 0 0012 20.1l1.1-1.1" />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: AiConnectionProvider }) {
  const initial = PROVIDER_PRESETS[provider].label.charAt(0).toUpperCase();
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true"
      style={{ width: 20, height: 20, flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }}>
      <circle cx="18" cy="18" r="15" />
      <path d="M18 7v22M7 18h22M10.5 10.5l15 15M25.5 10.5l-15 15" />
    </svg>
  );
}

export function AiConnectionEntry({ onOpen }: { onOpen: () => void }) {
  const providers = useAppStore((s) => s.providers || []);
  const enabled = providers.filter((p) => p.enabled);
  const def = providers.find((p) => p.isDefault && p.enabled) || enabled[0];
  const total = providers.length;

  const subtitle = total === 0
    ? '尚未設定任何 Provider'
    : def
      ? `${def.name} · ${def.model || "未設定 model"}`
      : `${total} 個 provider · 全部未啟用`;

  const dotClass = enabled.length > 0 ? 'liquid-ai-dot--ok' : total > 0 ? 'liquid-ai-dot--configured' : 'liquid-ai-dot--not_configured';

  return (
    <div className="liquid-row" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div className="liquid-row-left">
        <div className="liquid-icon-capsule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M12 2a4 4 0 0 1 4 4v1h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2V6a4 4 0 0 1 4-4z" />
            <circle cx="12" cy="13" r="2" />
          </svg>
        </div>
        <div className="liquid-row-text">
          <div className="liquid-row-label">{t('ai.title')}</div>
          <div className="liquid-row-hint">{subtitle}</div>
        </div>
      </div>
      <div className="liquid-row-right">
        <span className={`liquid-ai-dot ${dotClass}`} />
        <svg className="liquid-chevron" viewBox="0 0 24 24">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  );
}
export function AiConnectionPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const aiConnection = useAppStore((s) => s.aiConnection);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useToastStore((s) => s.showToast);
  const [draft, setDraft] = useState<AiConnectionConfig>(aiConnection);
  const [showKey, setShowKey] = useState(false);
  const [manualModel, setManualModel] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(aiConnection);
     
    setManualModel('');
     
    setShowKey(false);
  }, [aiConnection, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentPreset = PROVIDER_PRESETS[draft.provider] || PROVIDER_PRESETS.openai;
  const statusLabel = t(STATUS_KEYS[draft.status] || STATUS_KEYS.not_configured);
  const hasModels = draft.availableModels.length > 0;
  const isTesting = draft.status === 'testing';
  const isNativeUnsupported = draft.compatibilityMode === 'native-gemini' || draft.compatibilityMode === 'native-claude';
  const lastTestedText = useMemo(() => {
    if (!draft.lastTestedAt) return '';
    return new Date(draft.lastTestedAt).toLocaleString();
  }, [draft.lastTestedAt]);

  if (!isOpen) return null;

  const patchDraft = (patch: Partial<AiConnectionConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const setError = (message: string) => {
    patchDraft({ status: 'error', errorMessage: message });
    showToast(message);
  };

  const selectProvider = (provider: AiConnectionProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setDraft((current) => ({
      ...current,
      provider,
      compatibilityMode: preset.compatibilityMode,
      baseUrl: preset.defaultBaseUrl || current.baseUrl,
      modelsEndpoint: preset.modelsEndpoint,
      chatEndpoint: preset.chatEndpoint,
      errorMessage: undefined,
      availableModels: current.provider === provider ? current.availableModels : [],
    }));
  };

  const fetchModels = async () => {
    if (isNativeUnsupported) {
      setError(t('ai.nativeUnsupported'));
      return;
    }
    const validationError = validateDraft(draft, false);
    if (validationError) {
      setError(validationError);
      return;
    }

    patchDraft({ status: 'testing', errorMessage: undefined });
    try {
      const headers: HeadersInit = { Accept: 'application/json' };
      if (draft.apiKey.trim()) headers.Authorization = `Bearer ${draft.apiKey}`;
      const response = await fetch(endpointUrl(draft.baseUrl, draft.modelsEndpoint || currentPreset.modelsEndpoint), {
        method: 'GET',
        headers,
      });
      if (!response.ok) throw new Error(t('ai.error.fetchModels'));
      const models = parseModels(await response.json(), draft.provider);
      if (models.length === 0) throw new Error(t('ai.fetchModelsManual'));
      setDraft((current) => ({
        ...current,
        availableModels: models,
        model: current.model || models[0]?.id || '',
        status: 'ok',
        lastTestedAt: Date.now(),
        errorMessage: undefined,
      }));
      showToast(t('ai.modelsFetched'));
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('ai.error.fetchModels');
      setDraft((current) => ({ ...current, status: 'error', errorMessage: message }));
      showToast(message);
    }
  };

  const testConnection = async () => {
    if (isNativeUnsupported) {
      setError(t('ai.nativeUnsupported'));
      return;
    }
    const validationError = validateDraft(draft, true);
    if (validationError) {
      setError(validationError);
      return;
    }

    patchDraft({ status: 'testing', errorMessage: undefined });
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (draft.apiKey.trim()) headers.Authorization = `Bearer ${draft.apiKey}`;
      const response = await fetch(endpointUrl(draft.baseUrl, draft.chatEndpoint || currentPreset.chatEndpoint), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: draft.model,
          messages: [{ role: 'user', content: 'ping' }],
          stream: false,
          temperature: 0,
        }),
      });
      if (!response.ok) throw new Error(t('ai.error.connection'));
      setDraft((current) => ({ ...current, status: 'ok', lastTestedAt: Date.now(), errorMessage: undefined }));
      showToast(t('ai.testSuccess'));
    } catch {
      const message = t('ai.error.testFailed');
      setDraft((current) => ({ ...current, status: 'error', errorMessage: message }));
      showToast(message);
    }
  };

  const saveSettings = () => {
    const hasRequiredFields = Boolean(draft.baseUrl.trim() && draft.model.trim() && (draft.provider === 'ollama' || draft.apiKey.trim()));
    const nextStatus: AiConnectionStatus = hasRequiredFields
      ? (draft.status === 'ok' || draft.status === 'error' ? draft.status : 'configured')
      : 'not_configured';
    updateSettings({
      aiConnection: {
        ...draft,
        enabled: hasRequiredFields,
        baseUrl: draft.baseUrl.trim(),
        model: draft.model.trim(),
        modelsEndpoint: draft.modelsEndpoint.trim() || currentPreset.modelsEndpoint,
        chatEndpoint: draft.chatEndpoint.trim() || currentPreset.chatEndpoint,
        status: nextStatus,
        errorMessage: nextStatus === 'not_configured' ? undefined : draft.errorMessage,
      },
    });
    showToast(t('ai.saved'));
    onClose();
  };

  const addManualModel = () => {
    const nextModel = manualModel.trim();
    if (!nextModel) return;
    setDraft((current) => ({
      ...current,
      model: nextModel,
      availableModels: current.availableModels.some((model) => model.id === nextModel)
        ? current.availableModels
        : [...current.availableModels, { id: nextModel, label: nextModel, provider: current.provider }],
    }));
    setManualModel('');
  };

  return createPortal(
    <div className="ai-sheet-overlay" onClick={onClose}>
      <div className="ai-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{t('ai.title')}</span>
        </div>

        <div className="ai-sheet-body">
          <section className={`ai-status-card ${draft.status}`}>
            <div>
              <div className="settings-label">{t('ai.connectionStatus')}</div>
              <div className="settings-hint">{statusLabel}</div>
              {lastTestedText && <div className="settings-hint">{t('ai.lastTestedAt')}: {lastTestedText}</div>}
              {draft.errorMessage && <div className="ai-error compact" role="status">{draft.errorMessage}</div>}
            </div>
            <span className="ai-status-dot" aria-hidden="true" />
          </section>

          <section className="ai-field">
            <span className="settings-label">{t('ai.provider')}</span>
            <div className="provider-grid">
              {PROVIDERS.map((provider) => {
                const preset = PROVIDER_PRESETS[provider];
                return (
                  <button
                    key={provider}
                    type="button"
                    className={`provider-card ${draft.provider === provider ? 'active' : ''}`}
                    onClick={() => selectProvider(provider)}
                  >
                    <ProviderIcon provider={provider} />
                    <span className="provider-name">{provider === 'custom-relay' ? t('ai.customRelay') : preset.label}</span>
                    <span className="provider-desc">{t(preset.descriptionKey)}</span>
                    {preset.experimental && <span className="provider-badge">{t('ai.experimental')}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {isNativeUnsupported && (
            <div className="ai-error compact">{t('ai.nativeUnsupported')}</div>
          )}

          <label className="ai-field">
            <span className="settings-label">{t('ai.apiKey')}</span>
            <div className="ai-input-row">
              <input
                className="quick-sheet-input"
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => patchDraft({ apiKey: event.target.value })}
                placeholder={draft.provider === 'ollama' ? t('ai.apiKeyOptional') : 'sk-...'}
              />
              <button type="button" className="settings-btn settings-inline-btn" onClick={() => setShowKey((value) => !value)}>
                {showKey ? t('ai.hideKey') : t('ai.showKey')}
              </button>
              <button type="button" className="settings-btn settings-inline-btn" onClick={() => patchDraft({ apiKey: '' })}>
                {t('ai.clearKey')}
              </button>
            </div>
            <span className="settings-hint">{t('ai.securityHint')}</span>
          </label>

          <label className="ai-field">
            <span className="settings-label">{t('ai.baseUrl')}</span>
            <input
              className="quick-sheet-input"
              type="url"
              value={draft.baseUrl}
              onChange={(event) => patchDraft({ baseUrl: event.target.value })}
              placeholder={currentPreset.defaultBaseUrl || 'https://relay.example.com/v1'}
            />
          </label>

          <label className="ai-field">
            <span className="settings-label">{t('ai.model')}</span>
            {hasModels && (
              <select className="quick-sheet-input" value={draft.model} onChange={(event) => patchDraft({ model: event.target.value })}>
                {draft.availableModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.label || model.id}</option>
                ))}
              </select>
            )}
            <div className="ai-input-row manual-model-row">
              <input
                className="quick-sheet-input"
                type="text"
                value={hasModels ? manualModel : draft.model}
                onChange={(event) => hasModels ? setManualModel(event.target.value) : patchDraft({ model: event.target.value })}
                placeholder={t('ai.manualModel')}
              />
              {hasModels && (
                <button type="button" className="settings-btn settings-inline-btn" onClick={addManualModel}>
                  {t('sheet.save')}
                </button>
              )}
            </div>
            {!hasModels && <span className="settings-hint">{t('ai.fetchModelsManual')}</span>}
          </label>

          <div className="ai-action-grid">
            <button type="button" className="btn-ghost" onClick={fetchModels} disabled={isTesting}>
              {isTesting ? t('ai.status.testing') : t('ai.fetchModels')}
            </button>
            <button type="button" className="btn-ghost" onClick={testConnection} disabled={isTesting}>
              {t('ai.testConnection')}
            </button>
          </div>

          <details className="ai-advanced">
            <summary>{t('ai.advanced')}</summary>
            <div className="ai-advanced-body">
              <div className="settings-row">
                <span className="settings-label">{t('ai.streaming')}</span>
                <label className="switch">
                  <input type="checkbox" checked={draft.streamingEnabled} onChange={(event) => patchDraft({ streamingEnabled: event.target.checked })} aria-label={t('ai.streaming')} />
                  <span className="slider" />
                </label>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">{t('ai.thinkingUi')}</div>
                  <div className="settings-hint">{t('ai.thinkingHint')}</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={draft.thinkingUiEnabled} onChange={(event) => patchDraft({ thinkingUiEnabled: event.target.checked })} aria-label={t('ai.thinkingUi')} />
                  <span className="slider" />
                </label>
              </div>
              <label className="ai-field">
                <span className="settings-label">{t('ai.temperature')}</span>
                <input className="quick-sheet-input" type="number" min={0} max={2} step={0.1} value={draft.temperature} onChange={(event) => patchDraft({ temperature: Number(event.target.value) })} />
              </label>
              <label className="ai-field">
                <span className="settings-label">{t('ai.maxTokens')}</span>
                <input className="quick-sheet-input" type="number" min={1} value={draft.maxTokens ?? ''} onChange={(event) => patchDraft({ maxTokens: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
              <label className="ai-field">
                <span className="settings-label">{t('ai.contextMessages')}</span>
                <input className="quick-sheet-input" type="number" min={1} max={100} value={draft.contextMessageLimit} onChange={(event) => patchDraft({ contextMessageLimit: Number(event.target.value) })} />
              </label>
              <label className="ai-field">
                <span className="settings-label">{t('ai.modelsEndpoint')}</span>
                <input className="quick-sheet-input" type="text" value={draft.modelsEndpoint} onChange={(event) => patchDraft({ modelsEndpoint: event.target.value })} />
              </label>
              <label className="ai-field">
                <span className="settings-label">{t('ai.chatEndpoint')}</span>
                <input className="quick-sheet-input" type="text" value={draft.chatEndpoint} onChange={(event) => patchDraft({ chatEndpoint: event.target.value })} />
              </label>
            </div>
          </details>
        </div>

        <div className="ai-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('sheet.cancel')}</button>
          <button type="button" className="btn-primary" onClick={saveSettings} disabled={isTesting}>{t('ai.saveSettings')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
