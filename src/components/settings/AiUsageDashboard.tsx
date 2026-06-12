import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';
import type { AiUsageLogEntry } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function formatTokens(n?: number): string {
  if (!n || n === 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function AiUsageDashboard({ isOpen, onClose }: Props) {
  const aiUsage = useAppStore((s) => s.aiUsage);
  const today = new Date().toISOString().slice(0, 10);
  const daily = aiUsage.daily[today] || { requestCount: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0, totalTokens: 0, errorCount: 0, estimatedTokens: 0 };
  const recentLogs = useMemo(() => [...(aiUsage.logs || [])].reverse().slice(0, 10) as AiUsageLogEntry[], [aiUsage.logs]);
  const cacheRate = daily.inputTokens > 0 ? Math.round((daily.cachedInputTokens / daily.inputTokens) * 100) : 0;
  const hasData = daily.requestCount > 0 || daily.totalTokens > 0;

  if (!isOpen) return null;

  return createPortal(
    <div className="lang-modal-overlay" onClick={onClose}>
      <div className="lang-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <h2 className="lang-modal-title">{t('ai.usageTitle')}</h2>

        {!hasData && recentLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14, fontStyle: 'italic' }}>
            {t('ai.noUsageYet')}
          </div>
        ) : (
          <>
            {/* Glass stats grid */}
            <div className="liquid-stats-grid">
              <div className="liquid-stat-card">
                <div className="liquid-stat-value">{daily.requestCount}</div>
                <div className="liquid-stat-label">{t('ai.requests')}</div>
              </div>
              <div className="liquid-stat-card">
                <div className="liquid-stat-value">{formatTokens(daily.totalTokens)}</div>
                <div className="liquid-stat-label">{t('ai.totalTokens')}</div>
              </div>
              <div className="liquid-stat-card">
                <div className="liquid-stat-value">{cacheRate}%</div>
                <div className="liquid-stat-label">{t('ai.cacheHit')}</div>
              </div>
            </div>

            {/* Detail row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)' }}>{t('ai.inputTokens')}: <strong>{formatTokens(daily.inputTokens)}</strong></span>
              <span style={{ color: 'var(--text-2)' }}>{t('ai.outputTokens')}: <strong>{formatTokens(daily.outputTokens)}</strong></span>
              <span style={{ color: 'var(--text-2)' }}>{t('ai.cachedTokens')}: <strong>{formatTokens(daily.cachedInputTokens)}</strong></span>
              <span style={{ color: 'var(--text-2)' }}>{t('ai.estimated')}: <strong>{formatTokens(daily.estimatedTokens)}</strong></span>
            </div>

            {daily.errorCount > 0 && (
              <div style={{ color: 'var(--danger)', fontSize: 12 }}>{t('ai.errors')}: {daily.errorCount}</div>
            )}

            {/* Recent requests */}
            {recentLogs.length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(180,170,160,0.20)', margin: '4px 0' }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>{t('ai.recentRequests')}</div>
                <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {recentLogs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-2)' }}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{log.source === 'test_connection' ? t('ai.sourceTest') : t('ai.sourceChat')}
                      </span>
                      <span style={{ fontFamily: 'var(--f-d)', color: log.status === 'error' ? 'var(--danger)' : 'var(--text)' }}>
                        {log.status === 'error' ? '!' : formatTokens(log.totalTokens)}{log.estimated ? '*' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <button type="button" className="liquid-btn lang-modal-cancel" onClick={onClose}>
          {t('sheet.cancel')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
