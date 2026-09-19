import { useState, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/store/useToastStore';
import { sendChatMessage } from '@/ai/client';
import { t } from '@/i18n';
import type { AiConfig } from '@/types';

interface AiConfigDrawerProps {
  onDone: () => void;
}

export function AiConfigDrawer({ onDone }: AiConfigDrawerProps) {
  const aiConfig = useAppStore((s) => s.aiConfig);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const showToast = useToastStore((s) => s.showToast);
  const abortRef = useRef<AbortController | null>(null);

  const [enabled, setEnabled] = useState(aiConfig.enabled);
  const [provider, setProvider] = useState(aiConfig.provider);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [model, setModel] = useState(aiConfig.model);
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl);
  const [temperature, setTemperature] = useState(aiConfig.temperature);
  const [maxTokens, setMaxTokens] = useState(aiConfig.maxTokens);
  const [systemPrompt, setSystemPrompt] = useState(aiConfig.systemPrompt);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [memoryContextEnabled, setMemoryContextEnabled] = useState(aiConfig.memoryContextEnabled);
  const [devMockEnabled, setDevMockEnabled] = useState(aiConfig.devMockEnabled || false);

  const handleSave = () => {
    const config: AiConfig = {
      enabled,
      mode: 'proxy',
      provider,
      model,
      apiKey,
      baseUrl,
      proxyUrl: aiConfig.proxyUrl,
      temperature,
      maxTokens,
      topP: aiConfig.topP,
      reasoningEffort: aiConfig.reasoningEffort,
      reasoningSummary: aiConfig.reasoningSummary,
      systemPrompt,
      memoryContextEnabled,
      devMockEnabled,
    };
    updateSettings({ aiConfig: config });
    onDone();
  };

  const handleTest = async () => {
    if (!apiKey) {
      setTestResult('請先輸入 API Key');
      return;
    }
    setTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const generator = sendChatMessage(
        [{ role: 'user', content: 'hi' }],
        {
          provider,
          model,
          apiKey,
          baseUrl,
          temperature: 0.7,
          maxTokens: 32,
          topP: 0.9,
          systemPrompt: '',
        },
        controller.signal,
      );
      const first = await generator.next();
      controller.abort();
      if (first.done) {
        showToast('連線失敗：未收到回應');
        setTestResult('連線失敗：未收到回應');
      } else {
        showToast('AI 連線成功');
        setTestResult('連線成功！');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Our own abort — success was already handled above
        return;
      }
      const message = err instanceof Error ? err.message : '未知錯誤';
      showToast(`連線失敗：${message}`);
      setTestResult(`連線失敗：${message}`);
    } finally {
      abortRef.current = null;
      setTesting(false);
    }
  };

  return (
    <div className="drawer-form">
      <div className="ai-config-body">
        {/* Enable toggle */}
        <div className="ai-config-field">
          <div className="ai-config-toggle">
            <span className="ai-config-toggle-label">啟用 AI</span>
            <div
              className={`ai-config-switch${enabled ? ' on' : ''}`}
              onClick={() => setEnabled((v) => !v)}
            />
          </div>
        </div>

        {/* Memory context toggle */}
        <div className="ai-config-field">
          <div className="ai-config-toggle">
            <div>
              <span className="ai-config-toggle-label">使用近期記憶作為回覆背景</span>
              <div className="settings-hint" style={{ marginTop: 2 }}>
                開啟後，AI 會參考最近的月潮雲匣記錄，但不會直接朗讀或暴露內容。
              </div>
            </div>
            <div
              className={`ai-config-switch${memoryContextEnabled ? ' on' : ''}`}
              onClick={() => setMemoryContextEnabled((v) => !v)}
            />
          </div>
        </div>

        {/* Dev mock toggle */}
        <div className="ai-config-field">
          <div className="ai-config-toggle">
            <div>
              <span className="ai-config-toggle-label">{t('settings.devMockLabel')}</span>
              <div className="settings-hint" style={{ marginTop: 2 }}>{t('settings.devMockHint')}</div>
            </div>
            <div
              className={`ai-config-switch${devMockEnabled ? ' on' : ''}`}
              onClick={() => setDevMockEnabled((v) => !v)}
            />
          </div>
        </div>

        {/* Provider */}
        <div className="ai-config-field">
          <label>Provider</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* API Key */}
        <div className="ai-config-field">
          <label>API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        {/* Model */}
        <div className="ai-config-field">
          <label>Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="輸入 Model ID"
          />
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          className={`ai-config-advanced-toggle${showAdvanced ? ' open' : ''}`}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? '收起' : '展開'}進階設定
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <div className={`ai-config-advanced${showAdvanced ? ' expanded' : ''}`}>
          {/* Base URL */}
          <div className="ai-config-field">
            <label>Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>

          {/* Temperature */}
          <div className="ai-config-field">
            <label>Temperature</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          {/* Max Tokens */}
          <div className="ai-config-field">
            <label>Max Tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              min={1}
              max={128000}
              step={1}
            />
          </div>

          {/* System Prompt */}
          <div className="ai-config-field">
            <label>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant."
            />
          </div>
        </div>
      </div>

      <div className="drawer-form-actions">
        <button className="btn-ghost" onClick={onDone}>
          取消
        </button>
        <button className="btn-ghost" onClick={handleTest} disabled={testing}>
          {testing ? '測試中...' : '測試連線'}
        </button>
        <button className="btn-primary" onClick={handleSave}>
          儲存
        </button>
      </div>
      {testResult && (
        <div style={{
          textAlign: 'center',
          fontSize: 'var(--fs-caption)',
          color: testResult.includes('成功') ? 'var(--accent)' : 'var(--danger)',
          marginTop: 'var(--sp-8)',
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
}
