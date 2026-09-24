import { useState, useCallback } from 'react';
import { PROVIDER_DEFAULTS, PROVIDER_TYPES, createProvider } from '@/config/providers';
import { providerRequiresApiKey } from '@/ai/providerRuntime';
import { testProviderConnection } from '@/ai/testConnection';
import { LunartideThinkingOrb } from '@/features/agentActivity/LunartideThinkingOrb';
import { emitAgentActivity } from '@/features/agentActivity/agentActivityState';
import { useProviderModels } from '@/ai/models';
import { t } from '@/i18n';
import type { ProviderConfig, ProviderType } from '@/types';
import { ProviderLogo } from './ProviderLogo';

// ---- Types ----

export type TestStatus = 'idle' | 'testing' | 'success' | 'failed' | 'unsupported';

interface WizardState {
  step: 1 | 2 | 3 | 4 | 5;
  type: ProviderType;
  apiKey: string;
  showKey: boolean;
  model: string;
  testStatus: TestStatus;
  testError: string;
  modelsLoading: boolean;
  unsupportedOptIn: boolean;
  testLatency: number | null;
}

const STEP_LABELS = [
  { 'zh-TW': '選擇服務', en: 'Select Service' },
  { 'zh-TW': 'API Key', en: 'API Key' },
  { 'zh-TW': '選擇模型', en: 'Select Model' },
  { 'zh-TW': '測試連線', en: 'Test Connection' },
  { 'zh-TW': '完成', en: 'Finish' },
];

// ---- Sub-components ----

function StepIndicator({ step, total = 5 }: { step: number; total?: number }) {
  return (
    <div className="wiz-steps" aria-label="Wizard step indicator">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`wiz-step-dot ${i + 1 === step ? 'wiz-step-dot--active' : ''} ${i + 1 < step ? 'wiz-step-dot--done' : ''}`} />
      ))}
    </div>
  );
}

function ProviderTypeCard({
  type,
  selected,
  onClick,
}: {
  type: ProviderType;
  selected: boolean;
  onClick: () => void;
}) {
  const def = PROVIDER_DEFAULTS[type];
  return (
    <button
      type="button"
      className={`wiz-pcard ${selected ? 'wiz-pcard--active' : ''}`}
      onClick={onClick}
    >
      <span className="wiz-pcard-icon">
        <ProviderLogo type={type} size={28} />
      </span>
      <span className="wiz-pcard-label">{def.label}</span>
    </button>
  );
}

// ---- Main Component ----

interface ProviderWizardProps {
  onComplete: (provider: ProviderConfig) => void;
  onCancel: () => void;
}

export function ProviderWizard({ onComplete, onCancel }: ProviderWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    type: 'openai',
    apiKey: '',
    showKey: false,
    model: '',
    testStatus: 'idle',
    testError: '',
    modelsLoading: false,
    unsupportedOptIn: false,
    testLatency: null,
  });

  const def = PROVIDER_DEFAULTS[state.type];
  const { models, loading: modelsLoading, error: modelsError, sync: syncModels } = useProviderModels(
    state.step >= 3 ? state.type : state.type,
    state.step >= 2 ? state.apiKey : '',
    def.baseUrl,
  );

  const lang = (zh: string, en: string) => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('lunartide_data') || '{}'); } catch { return {}; } })();
    return stored?.language === 'en' ? en : zh;
  };

  const goTo = (step: WizardState['step']) => setState((s) => ({ ...s, step }));
  const next = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, 5) as WizardState['step'] }));
  const prev = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) as WizardState['step'] }));

  const canNext = () => {
    switch (state.step) {
      case 1: return true;
      case 2: {
        const temp = createProvider(state.type);
        temp.apiKey = state.apiKey;
        return !providerRequiresApiKey(temp) || state.apiKey.trim().length > 0;
      }
      case 3: return state.model.trim().length > 0;
      case 4: return state.testStatus === 'success' || (state.testStatus === 'unsupported' && state.unsupportedOptIn);
      default: return true;
    }
  };

  const handleTest = useCallback(async () => {
    const activityRequestId = `provider-test:${crypto.randomUUID()}`;
    emitAgentActivity({ type: 'request_started', requestId: activityRequestId });
    setState((s) => ({ ...s, testStatus: 'testing', testError: '' }));
    const temp = createProvider(state.type);
    temp.apiKey = state.apiKey.trim();
    temp.model = state.model.trim();
    const startedAt = Date.now();
    const result = await testProviderConnection(temp);
    const testLatency = Date.now() - startedAt;
    if (result.success) {
      emitAgentActivity({ type: 'request_completed', requestId: activityRequestId });
      setState((s) => ({ ...s, testStatus: 'success', testLatency }));
    } else if ('unsupported' in result && result.unsupported) {
      emitAgentActivity({ type: 'request_completed', requestId: activityRequestId });
      setState((s) => ({ ...s, testStatus: 'unsupported', unsupportedOptIn: false, testLatency }));
    } else {
      emitAgentActivity({ type: 'request_failed', requestId: activityRequestId });
      setState((s) => ({ ...s, testStatus: 'failed', testError: result.error || '未知錯誤', testLatency }));
    }
  }, [state.type, state.apiKey]);

  const handleComplete = () => {
    const provider = createProvider(state.type);
    provider.apiKey = state.apiKey;
    provider.model = state.model;
    provider.connectionStatus = state.testStatus === 'success' ? 'connected' : state.testStatus === 'failed' ? 'failed' : 'untested';
    provider.lastTestedAt = state.testLatency === null ? undefined : Date.now();
    provider.lastTestLatencyMs = state.testLatency ?? undefined;
    provider.lastConnectionError = state.testError || undefined;
    onComplete(provider);
  };

  const stepLabel = (stepNum: number) => {
    const s = STEP_LABELS[stepNum - 1];
    return lang(s['zh-TW'], s.en);
  };

  return (
    <div className="wiz">
      {/* Header */}
      <div className="wiz-head">
        <StepIndicator step={state.step} />
        <span className="wiz-head-title">{stepLabel(state.step)}</span>
        {state.step > 1 && (
          <button type="button" className="wiz-back" onClick={prev}>
            ← {lang('上一步', 'Back')}
          </button>
        )}
      </div>

      {/* Step 1: Select Provider */}
      {state.step === 1 && (
        <div className="wiz-body">
          <p className="wiz-desc">{lang('選擇你要連接的 AI 服務商', 'Choose which AI service to connect')}</p>
          <div className="wiz-pgrid">
            {PROVIDER_TYPES.map((t) => (
              <ProviderTypeCard
                key={t}
                type={t}
                selected={state.type === t}
                onClick={() => setState((s) => ({ ...s, type: t, apiKey: '', model: '', testStatus: 'idle', testError: '', unsupportedOptIn: false, testLatency: null }))}
              />
            ))}
          </div>
          <div className="wiz-actions">
            <button type="button" className="liquid-btn" onClick={onCancel}>
              {t('adv.cancel')}
            </button>
            <button type="button" className="liquid-btn liquid-btn--accent" onClick={next}>
              {lang('下一步', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: API Key */}
      {state.step === 2 && (
        <div className="wiz-body">
          <p className="wiz-desc">
            {lang(`輸入你的 ${def.label} API Key`, `Enter your ${def.label} API Key`)}
          </p>
          <div className="wiz-input-row">
            <input
              className="adv-input wiz-input"
              type={state.showKey ? 'text' : 'password'}
              value={state.apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('adv.apiKeyPlaceholder')}
              onChange={(e) => setState((s) => ({ ...s, apiKey: e.target.value, testStatus: 'idle', testError: '' }))}
              autoFocus
            />
            <button type="button" className="adv-input-btn" onClick={() => setState((s) => ({ ...s, showKey: !s.showKey }))} tabIndex={-1}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                {state.showKey ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
            {state.apiKey && (
              <button type="button" className="adv-input-btn adv-input-btn--danger" onClick={() => setState((s) => ({ ...s, apiKey: '', testStatus: 'idle', testError: '' }))} tabIndex={-1}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
          <p className="wiz-hint">
            {lang('API Key 只會保存在你的本機瀏覽器。', 'Your API Key is stored only in your local browser.')}
          </p>
          <div className="wiz-actions">
            <button type="button" className="liquid-btn" onClick={prev}>
              {lang('上一步', 'Back')}
            </button>
            <button
              type="button"
              className="liquid-btn liquid-btn--accent"
              onClick={next}
              disabled={!canNext()}
              style={!canNext() ? { opacity: 0.4, pointerEvents: 'none' } : {}}
            >
              {lang('下一步', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Select Model */}
      {state.step === 3 && (
        <div className="wiz-body">
          <p className="wiz-desc">
            {lang('選擇模型或手動輸入名稱', 'Select a model or type one manually')}
          </p>
          <input
            className="adv-input wiz-input"
            list={`wizard-models-${state.type}`}
            value={state.model}
            placeholder={lang('載入模型中...', 'Loading models...')}
            onChange={(e) => setState((s) => ({ ...s, model: e.target.value }))}
            autoFocus
          />
          <datalist id={`wizard-models-${state.type}`}>
            {models.map((m) => <option key={m.sourceId} value={m.modelId} />)}
          </datalist>
          <div className="wiz-model-actions">
            <button
              type="button"
              className="liquid-btn"
              onClick={syncModels}
              disabled={modelsLoading}
              style={modelsLoading ? { opacity: 0.5 } : {}}
            >
              {modelsLoading ? (
                <>{lang('載入模型中...', 'Loading models...')}</>
              ) : (
                <>{lang('同步模型', 'Sync')}</>
              )}
            </button>
          </div>

          {/* Loading state */}
          {modelsLoading && (
            <p className="wiz-hint" style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
              {lang('載入模型中...', 'Loading models...')}
            </p>
          )}

          {/* Error state */}
          {!modelsLoading && modelsError && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p className="wiz-hint" style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>
                {lang('無法取得模型', 'Failed to fetch models')}
              </p>
              <p className="wiz-hint" style={{ color: 'var(--text-3)', fontSize: 11, margin: '4px 0 0' }}>
                {lang('請檢查 API Key', 'Please check your API Key')}
              </p>
            </div>
          )}

          {/* Models grid */}
          {!modelsLoading && !modelsError && models.length > 0 && (
            <div className="wiz-model-list">
              {models.map((m) => (
                <button
                  key={m.sourceId}
                  type="button"
                  className={`wiz-model-item ${state.model === m.modelId ? 'wiz-model-item--selected' : ''}`}
                  onClick={() => setState((s) => ({ ...s, model: m.modelId }))}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!modelsLoading && !modelsError && models.length === 0 && state.apiKey.trim().length > 0 && (
            <p className="wiz-hint">
              {lang('無法自動讀取模型，請手動輸入模型名稱。', 'Cannot auto-read models. Please enter the model name manually.')}
            </p>
          )}

          <div className="wiz-actions">
            <button type="button" className="liquid-btn" onClick={prev}>
              {lang('上一步', 'Back')}
            </button>
            <button
              type="button"
              className="liquid-btn liquid-btn--accent"
              onClick={next}
              disabled={!canNext()}
              style={!canNext() ? { opacity: 0.4, pointerEvents: 'none' } : {}}
            >
              {lang('下一步', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Test Connection */}
      {state.step === 4 && (
        <div className="wiz-body">
          <p className="wiz-desc">
            {lang('測試連線確保設定正確', 'Test the connection to verify your settings')}
          </p>
          <div className="wiz-test-area">
            {state.testStatus === 'testing' ? (
              <div className="wiz-test-status wiz-test-status--testing">
                <LunartideThinkingOrb activity="working" decorative />
                <span>{t('adv.testing')}</span>
              </div>
            ) : state.testStatus === 'success' ? (
              <div className="wiz-test-status wiz-test-status--ok">
                <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M20 6L9 17l-5-5" /></svg>
                <span>{t('adv.testSuccess')}</span>
                <span className="wiz-test-meta">{def.label} · {state.model} · {state.testLatency ?? '-'} ms</span>
              </div>
            ) : state.testStatus === 'failed' ? (
              <div className="wiz-test-status wiz-test-status--fail">
                <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M18 6L6 18M6 6l12 12" /></svg>
                <span>{t('adv.testFailed')}</span>
                <span className="wiz-test-meta">{def.label} · {state.model} · {state.testLatency ?? '-'} ms</span>
                {state.testError && <span className="wiz-test-error">{state.testError}</span>}
              </div>
            ) : state.testStatus === 'unsupported' ? (
              <div className="wiz-test-status wiz-test-status--unsupported">
                <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{lang('無法自動驗證，請儲存後於聊天頁測試。', 'Cannot auto-verify. Save and test on the chat page.')}</span>
                {!state.unsupportedOptIn && (
                  <button
                    type="button"
                    className="liquid-btn"
                    onClick={() => setState((s) => ({ ...s, unsupportedOptIn: true }))}
                    style={{ marginTop: 8, fontSize: 12, padding: '4px 12px' }}
                  >
                    {lang('仍要繼續', 'Continue Anyway')}
                  </button>
                )}
                {state.unsupportedOptIn && (
                  <span className="wiz-test-optin-confirmed">{lang('已確認，可繼續', 'Confirmed, you may proceed')}</span>
                )}
              </div>
            ) : (
              <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleTest} style={{ justifyContent: 'center', paddingLeft: 24, paddingRight: 24 }}>
                {lang('開始測試', 'Start Test')}
              </button>
            )}
          </div>
          <div className="wiz-actions">
            <button type="button" className="liquid-btn" onClick={prev}>
              {lang('上一步', 'Back')}
            </button>
            <button
              type="button"
              className="liquid-btn liquid-btn--accent"
              onClick={next}
              disabled={!canNext()}
              style={!canNext() ? { opacity: 0.4, pointerEvents: 'none' } : {}}
            >
              {lang('下一步', 'Next')}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {state.step === 5 && (
        <div className="wiz-body">
          <div className="wiz-done">
            <svg viewBox="0 0 24 24" style={{ width: 48, height: 48, fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.5 }}><path d="M20 6L9 17l-5-5" /></svg>
            <h3 className="wiz-done-title">{lang('設定完成！', 'Setup Complete!')}</h3>
            <p className="wiz-done-desc">
              {lang(`已設定 ${def.label} 連線，模型：${state.model || '-'}`, `${def.label} connection configured, model: ${state.model || '-'}`)}
            </p>
            <div className="wiz-summary">
              <div className="wiz-summary-row">
                <span className="wiz-summary-label">{lang('服務', 'Service')}</span>
                <span className="wiz-summary-value">{def.label}</span>
              </div>
              <div className="wiz-summary-row">
                <span className="wiz-summary-label">{lang('模型', 'Model')}</span>
                <span className="wiz-summary-value">{state.model || '-'}</span>
              </div>
            </div>
          </div>
          <div className="wiz-actions">
            <button type="button" className="liquid-btn" onClick={onCancel}>
              {t('adv.cancel')}
            </button>
            <button type="button" className="liquid-btn liquid-btn--accent" onClick={handleComplete} style={{ flex: 2, justifyContent: 'center' }}>
              {lang('儲存並開始使用', 'Save & Start Using')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
