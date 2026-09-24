import { useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import type { AiUsageLogEntry } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

type FilterDays = 1 | 7 | 30;

function fmtTokens(n?: number): string {
  if (n == null) return '無資料';
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtMs(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.round(n)} ms`;
}

export function AiUsageDashboard({ isOpen, onClose, embedded = false }: Props) {
  const aiUsage = useAppStore((s) => s.aiUsage);
  const clearAiUsageLogs = useAppStore((s) => s.clearAiUsageLogs);

  const [filterDays, setFilterDays] = useState<FilterDays>(7);
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [confirmClear, setConfirmClear] = useState(false);

  const now = Date.now();

  const filteredLogs = useMemo(() => {
    let logs = (aiUsage.logs || []) as AiUsageLogEntry[];
    const cutoff = now - filterDays * 86400000;
    logs = logs.filter(l => l.createdAt >= cutoff);
    if (providerFilter) logs = logs.filter(l => l.provider === providerFilter);
    if (modelFilter) logs = logs.filter(l => l.model === modelFilter);
    return logs.sort((a, b) => b.createdAt - a.createdAt);
  }, [aiUsage.logs, filterDays, providerFilter, modelFilter, now]);

  const stats = useMemo(() => {
    const logs = filteredLogs;
    const total = logs.length;
    const success = logs.filter(l => l.status === 'success').length;
    const fail = logs.filter(l => l.status === 'error').length;
    const rate = total > 0 ? success / total : 0;

    let input = 0, cached = 0, output = 0, estimatedCost = 0;
    let inputCount = 0, cachedCount = 0, outputCount = 0, costCount = 0;
    let totalLatency = 0, latencyCount = 0;
    for (const l of logs) {
      if (l.status === 'success') {
        if (l.inputTokens != null) { input += l.inputTokens; inputCount++; }
        if (l.outputTokens != null) { output += l.outputTokens; outputCount++; }
        if (l.cachedInputTokens != null) { cached += l.cachedInputTokens; cachedCount++; }
        if (l.estimatedCostUsd != null) { estimatedCost += l.estimatedCostUsd; costCount++; }
      }
      if (l.latencyMs != null && l.latencyMs > 0) {
        totalLatency += l.latencyMs;
        latencyCount++;
      }
    }
    const uncached = inputCount > 0 && cachedCount > 0 ? Math.max(0, input - cached) : undefined;
    const cacheRate = (input > 0 && cachedCount > 0) ? cached / input : null;
    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;

    const recentErrors = logs.filter(l => l.status === 'error').slice(0, 5);

    /* Provider distribution */
    const provMap = new Map<string, number>();
    const modelMap = new Map<string, number>();
    for (const l of logs) {
      provMap.set(l.provider, (provMap.get(l.provider) || 0) + 1);
      modelMap.set(`${l.provider}:${l.model}`, (modelMap.get(`${l.provider}:${l.model}`) || 0) + 1);
    }
    const provDist = [...provMap.entries()].sort((a, b) => b[1] - a[1]);
    const modelDist = [...modelMap.entries()].sort((a, b) => b[1] - a[1]);

    /* Available providers/models for filters */
    const availProviders = [...new Set(logs.map(l => l.provider))].sort();
    const availModels = [...new Set(logs.map(l => l.model))].sort();

    return { total, success, fail, rate, input: inputCount ? input : undefined, cached: cachedCount ? cached : undefined, uncached, output: outputCount ? output : undefined, estimatedCost: costCount ? estimatedCost : undefined, cacheRate, avgLatency, recentErrors, provDist, modelDist, availProviders, availModels };
  }, [filteredLogs]);

  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      filterDays,
      logs: filteredLogs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lunartide_api_usage_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, filterDays]);

  const handleClear = useCallback(() => {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearAiUsageLogs();
    setConfirmClear(false);
  }, [confirmClear, clearAiUsageLogs]);

  const handleDismissClear = useCallback(() => setConfirmClear(false), []);

  if (!isOpen) return null;

  const hasData = filteredLogs.length > 0;

  const dayLabels: Record<FilterDays, string> = { 1: '今天', 7: '7 天', 30: '30 天' };

  const content = (
    <div
      className={embedded ? 'settings-usage-content' : 'lang-modal'}
      onClick={(e) => e.stopPropagation()}
      style={embedded ? undefined : { maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}
    >
      {!embedded && <h2 className="lang-modal-title">API 請求統計</h2>}

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {([1, 7, 30] as FilterDays[]).map(d => (
          <button key={d} type="button"
            className={`liquid-btn${filterDays === d ? ' liquid-btn--accent' : ''}`}
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={() => setFilterDays(d)}>
            {dayLabels[d]}
          </button>
        ))}
        {stats.availProviders.length > 1 && (
          <select value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setModelFilter(''); }}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--glass-bg)', color: 'var(--text)', maxWidth: 120 }}>
            <option value="">全部 Provider</option>
            {stats.availProviders.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {stats.availModels.length > 1 && (
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--glass-bg)', color: 'var(--text)', maxWidth: 140 }}>
            <option value="">全部模型</option>
            {stats.availModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {!hasData ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>尚無請求記錄。</div>
      ) : (
        <>
          {/* Request stats */}
          <div className="liquid-stats-grid" style={{ marginBottom: 8 }}>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{stats.total}</div>
              <div className="liquid-stat-label">請求總數</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value" style={{ color: 'var(--success, #5c9)' }}>{stats.success}</div>
              <div className="liquid-stat-label">成功</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value" style={{ color: stats.fail > 0 ? 'var(--danger)' : undefined }}>{stats.fail}</div>
              <div className="liquid-stat-label">失敗</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{fmtPct(stats.rate)}</div>
              <div className="liquid-stat-label">成功率</div>
            </div>
          </div>

          {/* Token stats */}
          <div className="liquid-stats-grid" style={{ marginBottom: 8 }}>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{fmtTokens(stats.input)}</div>
              <div className="liquid-stat-label">輸入 Token</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{fmtTokens(stats.cached)}</div>
              <div className="liquid-stat-label">快取命中 Token</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{fmtTokens(stats.uncached)}</div>
              <div className="liquid-stat-label">未快取 Token</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{fmtTokens(stats.output)}</div>
              <div className="liquid-stat-label">輸出 Token</div>
            </div>
          </div>

          {/* Cache hit rate + avg latency */}
          <div className="liquid-stats-grid" style={{ marginBottom: 8 }}>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">
                {stats.cacheRate != null ? fmtPct(stats.cacheRate) : '—'}
              </div>
              <div className="liquid-stat-label">快取命中率</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">
                {stats.avgLatency > 0 ? fmtMs(stats.avgLatency) : '—'}
              </div>
              <div className="liquid-stat-label">平均延遲</div>
            </div>
            <div className="liquid-stat-card">
              <div className="liquid-stat-value">{stats.estimatedCost == null ? '無資料' : `$${stats.estimatedCost.toFixed(4)}`}</div>
              <div className="liquid-stat-label">估算成本 USD</div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
            帳戶餘額：目前 Provider 未提供可安全統一讀取的餘額能力。
          </div>

          {stats.cacheRate == null && stats.total > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
              部份 Provider 不支援快取明細
            </div>
          )}

          {/* Provider distribution */}
          {stats.provDist.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Provider 分佈</div>
              {stats.provDist.map(([name, count]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', width: 80, flexShrink: 0, textAlign: 'right' }}>{name}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${(count / stats.total) * 100}%`, minWidth: count > 0 ? 4 : 0 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text)', width: 30, flexShrink: 0 }}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Model distribution */}
          {stats.modelDist.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>模型分佈</div>
              {stats.modelDist.slice(0, 8).map(([full, count]) => {
                const [prov, ...modelParts] = full.split(':');
                const model = modelParts.join(':');
                return (
                  <div key={full} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', width: 120, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={model}>{model}</span>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent-sub, #88a)', width: `${(count / stats.total) * 100}%`, minWidth: count > 0 ? 3 : 0 }} />
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text)', width: 24, flexShrink: 0 }}>{count}</span>
                  </div>
                );
              })}
              {stats.modelDist.length > 8 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>……還有 {stats.modelDist.length - 8} 個模型</div>
              )}
            </div>
          )}

          {/* Recent errors */}
          {stats.recentErrors.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)', marginBottom: 4 }}>最近錯誤</div>
              {stats.recentErrors.map(e => (
                <div key={e.id} style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>{new Date(e.createdAt).toLocaleString()}</span>
                  <span>{e.provider}/{e.model}</span>
                  <span style={{ color: 'var(--danger)' }}>{e.errorMessage || 'Unknown'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent requests (compact) */}
          {filteredLogs.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>最近請求 ({filteredLogs.length})</div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredLogs.slice(0, 50).map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-2)' }}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{log.provider}/{log.model}
                    </span>
                    <span style={{ color: log.status === 'error' ? 'var(--danger)' : 'var(--text)' }}>
                      {log.status === 'error' ? '✕' : <>{fmtTokens(log.totalTokens ?? log.estimatedTotalTokens)}{log.estimated ? '（估算）' : ''}</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data management */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="liquid-btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleExport}>
              匯出 JSON
            </button>
            {confirmClear ? (
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>確定清除？</span>
                <button type="button" className="liquid-btn liquid-btn--danger" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={handleClear}>確認</button>
                <button type="button" className="liquid-btn" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={handleDismissClear}>取消</button>
              </span>
            ) : (
              <button type="button" className="liquid-btn" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}
                onClick={handleClear}>清除統計</button>
            )}
          </div>
        </>
      )}

      {!embedded && (
        <button type="button" className="liquid-btn lang-modal-cancel" onClick={onClose} style={{ marginTop: 12 }}>
          關閉
        </button>
      )}
    </div>
  );

  if (embedded) return content;

  return createPortal(
    <div className="lang-modal-overlay" onClick={onClose}>
      {content}
    </div>,
    document.body,
  );
}
