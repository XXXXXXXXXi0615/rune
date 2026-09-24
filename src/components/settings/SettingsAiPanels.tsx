import { useState } from 'react';
import { useProviderModels } from '@/ai/models';
import { PROVIDER_DEFAULTS } from '@/config/providers';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import type { ProviderConfig } from '@/types';
import { AiUsageDashboard } from './AiUsageDashboard';
import { ProviderCenter } from './ProviderCenter';
import { ProviderLogo } from './ProviderLogo';

export function SettingsProvidersPanel() {
  return <ProviderCenter isOpen embedded onClose={() => {}} />;
}

function ProviderModelRow({ provider }: { provider: ProviderConfig }) {
  const updateProvider = useAppStore((state) => state.updateProvider);
  const showToast = useToastStore((state) => state.showToast);
  const [model, setModel] = useState(provider.model);
  const { models, loading, error, sync } = useProviderModels(
    provider.type,
    provider.apiKey,
    provider.baseUrl || PROVIDER_DEFAULTS[provider.type].baseUrl,
  );

  const save = () => {
    updateProvider(provider.id, { model: model.trim(), updatedAt: Date.now() });
    showToast('模型已更新');
  };

  return (
    <div className="settings-model-card">
      <div className="settings-model-head">
        <ProviderLogo type={provider.type} size={24} />
        <div>
          <strong>{provider.name}</strong>
          <span>{PROVIDER_DEFAULTS[provider.type].label}</span>
        </div>
        <span className={`settings-model-status ${provider.enabled ? 'active' : ''}`}>
          {provider.enabled ? '已啟用' : '已停用'}
        </span>
      </div>
      <label className="settings-panel-field">
        <span>Model</span>
        <input
          value={model}
          list={`settings-models-${provider.id}`}
          onChange={(event) => setModel(event.target.value)}
          placeholder={loading ? '同步模型中…' : '選擇或輸入模型'}
        />
        <datalist id={`settings-models-${provider.id}`}>
          {models.map((item) => <option key={item.sourceId} value={item.modelId}>{item.name}</option>)}
        </datalist>
      </label>
      {error && <p className="settings-panel-error">{error}</p>}
      <div className="settings-panel-actions">
        <button type="button" className="liquid-btn" onClick={sync} disabled={loading}>
          {loading ? '同步中…' : '同步模型'}
        </button>
        <button type="button" className="liquid-btn liquid-btn--accent" onClick={save}>保存模型</button>
      </div>
    </div>
  );
}

export function SettingsModelsPanel() {
  const providers = useAppStore((state) => state.providers || []);

  if (providers.length === 0) {
    return <div className="settings-panel-empty">先在 AI Provider 中新增服務，才能同步模型。</div>;
  }

  return (
    <div className="settings-module-stack">
      {providers.map((provider) => <ProviderModelRow key={provider.id} provider={provider} />)}
    </div>
  );
}

export function SettingsUsagePanel() {
  return <AiUsageDashboard isOpen embedded onClose={() => {}} />;
}
