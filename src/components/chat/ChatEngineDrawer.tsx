import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  useChatRuntimeStore,
  DEFAULT_SETTINGS,
  type ConversationRuntimeSettings,
  type ConversationContextState,
  type LongTermMemory,
  errorTypeLabel,
} from '@/store/useChatRuntimeStore';
import { useAppStore } from '@/store/useAppStore';
import { resolveChatProvider } from '@/ai/providerRuntime';
import { getModelCapabilities, GENERATION_STYLES, styleDefaults, type GenerationStyle } from '@/ai/modelCapabilities';
import { useAgentActivityStore } from '@/features/agentActivity/agentActivityState';
import { labelForActivity } from '@/features/agentActivity/agentActivityMapping';
import { LunartideThinkingOrb } from '@/features/agentActivity/LunartideThinkingOrb';

/* ── Types ── */

interface ChatEngineDrawerProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
}

type TabKey = 'model' | 'generation' | 'context' | 'diagnostics';

/* ── Helpers ── */

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/* ── Engine Drawer ── */

export function ChatEngineDrawer({ open, conversationId, onClose }: ChatEngineDrawerProps) {
  const agentActivity = useAgentActivityStore((state) => state.activity);
  const [tab, setTab] = useState<TabKey>('model');
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      setTimeout(() => { (prevFocusRef.current as HTMLElement)?.focus(); }, 0);
    };
  }, [open, onClose]);

  if (!open || !conversationId) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'model', label: '模型' },
    { key: 'generation', label: '生成' },
    { key: 'context', label: '上下文與記憶' },
    { key: 'diagnostics', label: '診斷' },
  ];

  const content = (
    <div className={`ce-drawer-panel${isMobile ? ' ce-drawer-panel--sheet' : ''}`} ref={panelRef} role="dialog" aria-modal="true" aria-label="會話引擎設定">
      <div className="ce-drawer-head">
        <div><h2 className="ce-drawer-title">會話引擎設定</h2>{labelForActivity(agentActivity) && <LunartideThinkingOrb activity={agentActivity} labelOnly />}</div>
        <button type="button" className="ce-drawer-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="ce-drawer-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`ce-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ce-drawer-body">
        {tab === 'model' && <ModelInfoPanel conversationId={conversationId} />}
        {tab === 'generation' && <GenerationSettingsPanel conversationId={conversationId} />}
        {tab === 'context' && <ContextSettingsPanel conversationId={conversationId} />}
        {tab === 'diagnostics' && <DiagnosticsPanel conversationId={conversationId} />}
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="ce-overlay" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>{content}</div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
      <div className="ce-backdrop" onClick={onClose} />
      {content}
    </>,
    document.body,
  );
}

/* ── Model Info Panel ── */

function ModelInfoPanel({ conversationId }: { conversationId: string }) {
  const { providers, aiRoles } = useAppStore();
  const { provider, configured, reason } = resolveChatProvider(aiRoles, providers || []);
  const caps = provider ? getModelCapabilities(provider.model) : getModelCapabilities('');
  const settings = useChatRuntimeStore((s) => s.getSettings(conversationId));
  const sessionUsage = useChatRuntimeStore((s) => s.getSessionUsage(conversationId));
  const contextState = useChatRuntimeStore((s) => s.getContextState(conversationId));

  const activeLtm = contextState.longTermMemories.filter((m) => !m.paused);
  const summary = contextState.summaryVersions.find((v) => v.version === contextState.currentVersion);

  return (
    <div className="ce-section">
      <div className="ce-info-grid">
        <div className="ce-info-item">
          <span className="ce-info-label">Provider</span>
          <span className="ce-info-value">{provider?.name || provider?.type || '—'}</span>
        </div>
        <div className="ce-info-item">
          <span className="ce-info-label">模型</span>
          <span className="ce-info-value">{provider?.model || '—'}</span>
        </div>
        <div className="ce-info-item">
          <span className="ce-info-label">狀態</span>
          <span className={`ce-status-dot${configured ? ' is-ready' : ' is-off'}`}>
            {configured ? '已連線' : reason === 'missing-api-key' ? '缺少金鑰' : reason === 'missing-model' ? '缺少模型' : '未配置'}
          </span>
        </div>
        <div className="ce-info-item">
          <span className="ce-info-label">生成風格</span>
          <span className="ce-info-value">{GENERATION_STYLES.find((s) => s.value === settings.generationStyle)?.label || settings.generationStyle}</span>
        </div>
        <div className="ce-info-item">
          <span className="ce-info-label">上下文用量</span>
          <span className="ce-info-value">
            {sessionUsage.totalInputTokens.toLocaleString()} / {(caps.maxOutputTokens * 4).toLocaleString()} Tokens
          </span>
        </div>
        <div className="ce-info-item">
          <span className="ce-info-label">長期記憶</span>
          <span className="ce-info-value">{activeLtm.length} 則（{activeLtm.filter((m) => m.pinned).length} 已置頂）</span>
        </div>
        {summary && (
          <div className="ce-info-item ce-info-full">
            <span className="ce-info-label">目前摘要 v{summary.version}</span>
            <span className="ce-info-value ce-summary-preview">{summary.content.slice(0, 120)}{summary.content.length > 120 ? '…' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Generation Settings Panel ── */

function GenerationSettingsPanel({ conversationId }: { conversationId: string }) {
  const settings = useChatRuntimeStore((s) => s.getSettings(conversationId));
  const update = useChatRuntimeStore((s) => s.updateSettings);
  const reset = useChatRuntimeStore((s) => s.resetToProviderDefaults);
  const { providers, aiRoles } = useAppStore();
  const { provider } = resolveChatProvider(aiRoles, providers || []);
  const caps = provider ? getModelCapabilities(provider.model) : getModelCapabilities('');
  const [advanced, setAdvanced] = useState(false);

  const isCustom = settings.generationStyle === 'custom';

  return (
    <div className="ce-section">
      <div className="ce-field-group">
        <label className="ce-field-label">生成風格</label>
        <div className="ce-style-grid">
          {GENERATION_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              className={`ce-style-chip${settings.generationStyle === style.value ? ' active' : ''}`}
              onClick={() => update(conversationId, { generationStyle: style.value })}
              title={style.description}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {isCustom && caps.supportsTemperature && (
        <div className="ce-field-group">
          <label className="ce-field-label">Temperature <span className="ce-field-val">{settings.temperature.toFixed(1)}</span></label>
          <input type="range" min={caps.temperatureRange[0] * 10} max={caps.temperatureRange[1] * 10} step={1}
            value={Math.round(settings.temperature * 10)}
            onChange={(e) => update(conversationId, { temperature: Number(e.target.value) / 10 })}
            className="ce-slider" />
        </div>
      )}

      {isCustom && caps.supportsMaxOutputTokens && (
        <div className="ce-field-group">
          <label className="ce-field-label">
            最大輸出 Tokens <span className="ce-field-val">{settings.maxOutputTokens.toLocaleString()}</span>
          </label>
          <input type="range" min={256} max={caps.maxOutputTokens} step={256}
            value={settings.maxOutputTokens}
            onChange={(e) => update(conversationId, { maxOutputTokens: Number(e.target.value) })}
            className="ce-slider" />
        </div>
      )}

      <button type="button" className="ce-link-btn" onClick={() => setAdvanced(!advanced)}>
        {advanced ? '▾ 收起進階設定' : '▸ 進階設定'}
      </button>

      {advanced && isCustom && (
        <div className="ce-advanced-group">
          {caps.supportsTopP && (
            <div className="ce-field-group">
              <label className="ce-field-label">Top P <span className="ce-field-val">{settings.topP.toFixed(2)}</span></label>
              <input type="range" min={caps.topPRange[0] * 100} max={caps.topPRange[1] * 100} step={1}
                value={Math.round(settings.topP * 100)}
                onChange={(e) => update(conversationId, { topP: Number(e.target.value) / 100 })}
                className="ce-slider" />
            </div>
          )}

          {caps.supportsFrequencyPenalty && (
            <div className="ce-field-group">
              <label className="ce-field-label">
                Frequency Penalty <span className="ce-field-val">{(settings.frequencyPenalty ?? 0).toFixed(1)}</span>
              </label>
              <input type="range" min={caps.frequencyPenaltyRange[0] * 10} max={caps.frequencyPenaltyRange[1] * 10} step={1}
                value={Math.round((settings.frequencyPenalty ?? 0) * 10)}
                onChange={(e) => update(conversationId, { frequencyPenalty: Number(e.target.value) / 10 })}
                className="ce-slider" />
            </div>
          )}

          {caps.supportsPresencePenalty && (
            <div className="ce-field-group">
              <label className="ce-field-label">
                Presence Penalty <span className="ce-field-val">{(settings.presencePenalty ?? 0).toFixed(1)}</span>
              </label>
              <input type="range" min={caps.presencePenaltyRange[0] * 10} max={caps.presencePenaltyRange[1] * 10} step={1}
                value={Math.round((settings.presencePenalty ?? 0) * 10)}
                onChange={(e) => update(conversationId, { presencePenalty: Number(e.target.value) / 10 })}
                className="ce-slider" />
            </div>
          )}

          {caps.supportsSeed && (
            <div className="ce-field-group">
              <label className="ce-field-label">Seed</label>
              <div className="ce-number-stepper">
                <button onClick={() => update(conversationId, { seed: Math.max(0, (settings.seed ?? 0) - 1) })}>−</button>
                <input type="number" value={settings.seed ?? ''} placeholder="隨機"
                  onChange={(e) => update(conversationId, { seed: e.target.value ? Number(e.target.value) : null })}
                  className="ce-stepper-input" />
                <button onClick={() => update(conversationId, { seed: (settings.seed ?? 0) + 1 })}>+</button>
              </div>
            </div>
          )}

          {caps.supportsReasoningControl && (
            <div className="ce-field-group">
              <label className="ce-field-label">推理強度</label>
              <div className="ce-style-grid">
                {caps.reasoningModes.map((mode) => (
                  <button key={mode} type="button"
                    className={`ce-style-chip${settings.reasoningEffort === mode ? ' active' : ''}`}
                    onClick={() => update(conversationId, { reasoningEffort: mode as 'low' | 'medium' | 'high' })}>
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!caps.supportsTemperature && (
            <p className="ce-field-hint">目前模型不支援 Temperature 調整。</p>
          )}
          {!caps.supportsTopP && (
            <p className="ce-field-hint">目前模型不支援 Top P 調整。</p>
          )}
          {!caps.supportsFrequencyPenalty && !caps.supportsPresencePenalty && (
            <p className="ce-field-hint">目前模型不支援頻率懲罰。</p>
          )}
        </div>
      )}

      <div className="ce-actions-row">
        <button type="button" className="ce-action-btn" onClick={() => reset(conversationId)}>
          恢復供應商預設值
        </button>
      </div>
    </div>
  );
}

/* ── Context Settings Panel ── */

function ContextSettingsPanel({ conversationId }: { conversationId: string }) {
  const settings = useChatRuntimeStore((s) => s.getSettings(conversationId));
  const contextState = useChatRuntimeStore((s) => s.getContextState(conversationId));
  const update = useChatRuntimeStore((s) => s.updateSettings);
  const addLtm = useChatRuntimeStore((s) => s.addLongTermMemory);
  const updateLtm = useChatRuntimeStore((s) => s.updateLongTermMemory);
  const deleteLtm = useChatRuntimeStore((s) => s.deleteLongTermMemory);
  const restoreVersion = useChatRuntimeStore((s) => s.restoreSummaryVersion);
  const [newMemory, setNewMemory] = useState('');
  const [editMemoryId, setEditMemoryId] = useState<string | null>(null);
  const [editMemoryText, setEditMemoryText] = useState('');

  const summary = contextState.summaryVersions.find((v) => v.version === contextState.currentVersion);
  const versions = contextState.summaryVersions;
  const longTermMemories = contextState.longTermMemories;

  return (
    <div className="ce-section">
      {/* Context Strategy */}
      <div className="ce-field-group">
        <label className="ce-field-label">上下文策略</label>
        <div className="ce-style-grid">
          {(['smart', 'recent', 'full'] as const).map((strat) => (
            <button key={strat} type="button"
              className={`ce-style-chip${settings.contextStrategy === strat ? ' active' : ''}`}
              onClick={() => update(conversationId, { contextStrategy: strat })}>
              {strat === 'smart' ? '智能' : strat === 'recent' ? '最近 N 輪' : '盡可能完整'}
            </button>
          ))}
        </div>
      </div>

      {settings.contextStrategy === 'recent' && (
        <div className="ce-field-group">
          <label className="ce-field-label">保留最近 {settings.recentRounds} 輪原始對話</label>
          <div className="ce-number-stepper">
            <button onClick={() => update(conversationId, { recentRounds: Math.max(2, settings.recentRounds - 2) })}>−2</button>
            <button onClick={() => update(conversationId, { recentRounds: Math.max(1, settings.recentRounds - 1) })}>−</button>
            <span className="ce-stepper-val">{settings.recentRounds}</span>
            <button onClick={() => update(conversationId, { recentRounds: settings.recentRounds + 1 })}>+</button>
            <button onClick={() => update(conversationId, { recentRounds: settings.recentRounds + 2 })}>+2</button>
          </div>
        </div>
      )}

      {/* Compression */}
      <div className="ce-divider" />
      <h4 className="ce-subhead">上下文整理</h4>

      <div className="ce-toggle-row">
        <span>自動整理</span>
        <button type="button" className={`ce-toggle${settings.autoCompress ? ' active' : ''}`}
          onClick={() => update(conversationId, { autoCompress: !settings.autoCompress })}>
          <span className="ce-toggle-knob" />
        </button>
      </div>

      {settings.autoCompress && (
        <>
          <div className="ce-field-group">
            <label className="ce-field-label">
              壓縮閾值 <span className="ce-field-val">{settings.compressThreshold}%</span>
            </label>
            <input type="range" min={60} max={90} step={5}
              value={settings.compressThreshold}
              onChange={(e) => update(conversationId, { compressThreshold: Number(e.target.value) })}
              className="ce-slider" />
          </div>

          <div className="ce-field-group">
            <label className="ce-field-label">保留最近對話輪數</label>
            <div className="ce-number-stepper">
              <button onClick={() => update(conversationId, { retainRecentRounds: Math.max(2, settings.retainRecentRounds - 2) })}>−2</button>
              <button onClick={() => update(conversationId, { retainRecentRounds: Math.max(1, settings.retainRecentRounds - 1) })}>−</button>
              <span className="ce-stepper-val">{settings.retainRecentRounds}</span>
              <button onClick={() => update(conversationId, { retainRecentRounds: settings.retainRecentRounds + 1 })}>+</button>
              <button onClick={() => update(conversationId, { retainRecentRounds: settings.retainRecentRounds + 2 })}>+2</button>
            </div>
          </div>
        </>
      )}

      <div className="ce-actions-row">
        <button type="button" className="ce-action-btn" onClick={() => {}} disabled>
          立即整理
        </button>
      </div>

      {/* Summary Versions */}
      {versions.length > 0 && (
        <div className="ce-divider-spacer" />
      )}
      {summary && (
        <div className="ce-summary-card">
          <div className="ce-summary-head">
            <span className="ce-label">目前摘要 v{summary.version}</span>
            <span className="ce-label-dim">{new Date(summary.updatedAt).toLocaleString()}</span>
          </div>
          <p className="ce-summary-text">{summary.content}</p>
          <div className="ce-actions-row">
            <button type="button" className="ce-action-btn-sm">編輯</button>
            <button type="button" className="ce-action-btn-sm">重新生成</button>
          </div>
        </div>
      )}

      {versions.length > 1 && (
        <div className="ce-versions-list">
          <span className="ce-label">歷史版本</span>
          {versions.filter((v) => v.version !== contextState.currentVersion).slice(-5).reverse().map((v) => (
            <button key={v.id} type="button" className="ce-version-item"
              onClick={() => restoreVersion(conversationId, v.version)}>
              <span>v{v.version}</span>
              <span>{new Date(v.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      {contextState.lastCompressError && (
        <p className="ce-error-msg">整理失敗：{contextState.lastCompressError}</p>
      )}

      {/* Long-term Memory */}
      <div className="ce-divider" />
      <h4 className="ce-subhead">長期記憶</h4>

      <div className="ce-ltm-input-row">
        <input type="text" className="ce-input" placeholder="新增長期記憶…" value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newMemory.trim()) {
              addLtm(conversationId, {
                id: `ltm-${Date.now()}`,
                content: newMemory.trim(),
                pinned: false,
                paused: false,
                sourceMessageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setNewMemory('');
            }
          }} />
        <button type="button" className="ce-action-btn-sm"
          onClick={() => {
            if (newMemory.trim()) {
              addLtm(conversationId, {
                id: `ltm-${Date.now()}`,
                content: newMemory.trim(),
                pinned: false,
                paused: false,
                sourceMessageIds: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setNewMemory('');
            }
          }}>新增</button>
      </div>

      {longTermMemories.map((mem) => (
        <div key={mem.id} className={`ce-memory-card${mem.paused ? ' is-paused' : ''}${mem.pinned ? ' is-pinned' : ''}`}>
          {editMemoryId === mem.id ? (
            <div className="ce-ltm-edit-row">
              <input type="text" className="ce-input" value={editMemoryText}
                onChange={(e) => setEditMemoryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateLtm(conversationId, mem.id, { content: editMemoryText });
                    setEditMemoryId(null);
                  }
                  if (e.key === 'Escape') setEditMemoryId(null);
                }} />
              <button type="button" className="ce-action-btn-sm"
                onClick={() => { updateLtm(conversationId, mem.id, { content: editMemoryText }); setEditMemoryId(null); }}>儲存</button>
            </div>
          ) : (
            <>
              <p className="ce-memory-text">{mem.content}</p>
              <div className="ce-memory-actions">
                <button onClick={() => updateLtm(conversationId, mem.id, { pinned: !mem.pinned })}>
                  {mem.pinned ? '取消置頂' : '置頂'}
                </button>
                <button onClick={() => updateLtm(conversationId, mem.id, { paused: !mem.paused })}>
                  {mem.paused ? '恢復' : '暫停'}
                </button>
                <button onClick={() => { setEditMemoryId(mem.id); setEditMemoryText(mem.content); }}>編輯</button>
                <button className="ce-btn-danger" onClick={() => deleteLtm(conversationId, mem.id)}>刪除</button>
              </div>
              {mem.sourceMessageIds.length > 0 && (
                <span className="ce-memory-source">來源：{mem.sourceMessageIds.length} 則訊息</span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Diagnostics Panel ── */

function DiagnosticsPanel({ conversationId }: { conversationId: string }) {
  const sessionUsage = useChatRuntimeStore((s) => s.getSessionUsage(conversationId));
  const recentRequests = useChatRuntimeStore((s) => s.getRecentRequests(conversationId));
  const lastRequest = recentRequests[0];
  const clearSessionExecutionCache = useChatRuntimeStore((s) => s.clearSessionExecutionCache);
  const [cleared, setCleared] = useState(false);

  return (
    <div className="ce-section">
      {/* Last Request */}
      <h4 className="ce-subhead">本次請求</h4>
      {lastRequest ? (
        <div className="ce-info-grid">
          <div className="ce-info-item"><span className="ce-info-label">Provider</span><span className="ce-info-value">{lastRequest.provider}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">Model</span><span className="ce-info-value">{lastRequest.model}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">輸入 Tokens</span><span className="ce-info-value">{lastRequest.inputTokens.toLocaleString()}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">輸出 Tokens</span><span className="ce-info-value">{lastRequest.outputTokens.toLocaleString()}</span></div>
          {lastRequest.cachedInputTokens !== undefined ? (
            <>
              <div className="ce-info-item"><span className="ce-info-label">快取復用 Tokens</span><span className="ce-info-value">{lastRequest.cachedInputTokens.toLocaleString()}</span></div>
              {lastRequest.cachedWriteTokens !== undefined && (
                <div className="ce-info-item"><span className="ce-info-label">快取寫入 Tokens</span><span className="ce-info-value">{lastRequest.cachedWriteTokens.toLocaleString()}</span></div>
              )}
              {lastRequest.cacheHitRate !== undefined && (
                <div className="ce-info-item"><span className="ce-info-label">快取命中率</span><span className="ce-info-value">{Math.round(lastRequest.cacheHitRate * 100)}%</span></div>
              )}
            </>
          ) : (
            <div className="ce-info-item ce-info-full">
              <span className="ce-info-label">快取統計</span>
              <span className="ce-info-value ce-hint">目前供應商未提供快取統計</span>
            </div>
          )}
          <div className="ce-info-item"><span className="ce-info-label">延遲</span><span className="ce-info-value">{lastRequest.latencyMs}ms</span></div>
          <div className="ce-info-item"><span className="ce-info-label">估算費用</span><span className="ce-info-value">${lastRequest.estimatedCost.toFixed(6)}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">使用摘要</span><span className="ce-info-value">{lastRequest.usedSummary ? '是' : '否'}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">原始對話輪數</span><span className="ce-info-value">{lastRequest.rawRoundsUsed}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">長期記憶使用</span><span className="ce-info-value">{lastRequest.longTermMemoriesUsed} 則</span></div>
          {lastRequest.error && (
            <div className="ce-info-item ce-info-full ce-error-item">
              <span className="ce-info-label">錯誤</span>
              <span className="ce-info-value">{lastRequest.errorType ? errorTypeLabel(lastRequest.errorType) : '發生錯誤'}：{lastRequest.error}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="ce-empty-hint">尚無請求記錄</p>
      )}

      {/* Session Stats */}
      <div className="ce-divider" />
      <h4 className="ce-subhead">目前會話</h4>
      {sessionUsage.requestCount > 0 ? (
        <div className="ce-info-grid">
          <div className="ce-info-item"><span className="ce-info-label">總輸入 Tokens</span><span className="ce-info-value">{sessionUsage.totalInputTokens.toLocaleString()}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">總輸出 Tokens</span><span className="ce-info-value">{sessionUsage.totalOutputTokens.toLocaleString()}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">總快取復用</span><span className="ce-info-value">{sessionUsage.totalCachedTokens.toLocaleString()}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">請求次數</span><span className="ce-info-value">{sessionUsage.requestCount}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">平均延遲</span><span className="ce-info-value">{sessionUsage.requestCount > 0 ? Math.round(sessionUsage.totalLatencyMs / sessionUsage.requestCount) : 0}ms</span></div>
          <div className="ce-info-item"><span className="ce-info-label">整理次數</span><span className="ce-info-value">{sessionUsage.compressCount}</span></div>
          <div className="ce-info-item"><span className="ce-info-label">估算費用</span><span className="ce-info-value">${sessionUsage.estimatedCost.toFixed(6)}</span></div>
        </div>
      ) : (
        <p className="ce-empty-hint">尚無會話統計</p>
      )}

      {/* History */}
      {recentRequests.length > 1 && (
        <>
          <div className="ce-divider" />
          <h4 className="ce-subhead">請求記錄</h4>
          <div className="ce-request-list">
            {recentRequests.slice(1, 11).map((req) => (
              <div key={req.id} className="ce-request-item">
                <span>{req.model}</span>
                <span>{req.inputTokens}+{req.outputTokens} tokens</span>
                <span>{req.latencyMs}ms</span>
                <span>${req.estimatedCost.toFixed(6)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="ce-divider" />
      <h4 className="ce-subhead">本机执行缓存</h4>
      <p className="ce-empty-hint">只清除 Token 估算、请求诊断、临时 Prompt 组装结果与附件衍生解析。摘要、长期记忆、消息与会话设置都会保留。</p>
      <p className="ce-empty-hint">服务端 Prompt Cache 由供应商管理，本操作只清除月潮本机缓存与统计。</p>
      <button type="button" className="ce-btn-secondary" onClick={() => { clearSessionExecutionCache(conversationId); setCleared(true); }}>{cleared ? '已清除本会话执行缓存' : '清除本会话执行缓存'}</button>
    </div>
  );
}

export default ChatEngineDrawer;
