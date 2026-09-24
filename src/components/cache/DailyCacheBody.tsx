import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DailyCacheIcon } from '@/components/icons/DailyCacheIcon';
import {
  scanSafeCache,
  cleanSafeCache,
} from '@/services/cache/cacheCleaner';
import type { CacheScanResult, CacheScanCategory, CacheCleanResult } from '@/services/cache/types';
import {
  formatBytes,
  formatBytesCompact,
  formatLastCleaned,
  scanResultToBreakdown,
  type CacheBreakdown,
} from '@/services/cache/cacheMaintenanceMock';

type CacheStatus = 'idle' | 'scanning' | 'ready' | 'cleaning' | 'success' | 'partial_failure' | 'failure' | 'empty';

const CATEGORY_LABELS: Record<string, { label: string; desc: string }> = {
  stale_cache_storage: { label: '過期快取', desc: '舊版 Service Worker 快取' },
  expired_metadata: { label: '過期 metadata', desc: 'AI 回覆、設定值暫存' },
  temporary_previews: { label: '臨時預覽', desc: '未提交的圖片、音訊預覽' },
};

/**
 * Shared cache-management workspace (scan / clean / recently-deleted / expired).
 * Hosted by:
 *   - DailyCacheWindow (floating window chrome)
 *   - CacheManagementSettingsPanel (Settings → 資料與儲存空間 → 緩存管理)
 */
export function DailyCacheBody({ active }: { active: boolean }) {
  const [status, setStatus] = useState<CacheStatus>('idle');
  const [data, setData] = useState<CacheBreakdown | null>(null);
  const [rawCategories, setRawCategories] = useState<CacheScanCategory[]>([]);
  const [autoClean, setAutoClean] = useState(true);
  const [freedBytes, setFreedBytes] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'cache' | 'deleted'>('cache');

  // Recently deleted data
  const allConversations = useAppStore((s) => s.conversations || []);
  const allJournalEntries = useAppStore((s) => s.journalWorkspaceEntries || []);
  const deletedConversations = useMemo(() => allConversations.filter((c) => !!c.deletedAt), [allConversations]);
  const deletedJournalEntries = useMemo(() => allJournalEntries.filter((e) => !!e.deletedAt), [allJournalEntries]);
  const deletedCount = deletedConversations.length + deletedJournalEntries.length;

  const retentionDays = useAppStore((s) => s.cacheRetentionDays ?? 30);
  const restoreConversation = useAppStore((s) => s.restoreConversation);
  const permanentlyDeleteConversation = useAppStore((s) => s.permanentlyDeleteConversation);
  const restoreJournalEntries = useAppStore((s) => s.restoreJournalEntries);
  const permanentlyDeleteJournalEntries = useAppStore((s) => s.permanentlyDeleteJournalEntries);
  const cleanupExpired = useAppStore((s) => s.cleanupExpiredDeleted);

  const scanAbortRef = useRef<AbortController | null>(null);
  const cleanAbortRef = useRef<AbortController | null>(null);

  const cancelScan = useCallback(() => {
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
  }, []);

  const cancelClean = useCallback(() => {
    cleanAbortRef.current?.abort();
    cleanAbortRef.current = null;
  }, []);

  const handleScan = useCallback(async () => {
    cancelScan(); // cancel any in-flight scan
    setStatus('scanning');
    const ac = new AbortController();
    scanAbortRef.current = ac;
    try {
      const result: CacheScanResult = await scanSafeCache(ac.signal);
      if (ac.signal.aborted) return;
      const breakdown = scanResultToBreakdown(result);
      setData(breakdown);
      setRawCategories(result.categories);
      setAutoClean(true);
      setStatus(result.totalBytes > 0 ? 'ready' : 'empty');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStatus('failure');
    } finally {
      if (scanAbortRef.current === ac) scanAbortRef.current = null;
    }
  }, [cancelScan]);

  const handleClean = useCallback(async () => {
    cancelClean();
    setStatus('cleaning');
    const ac = new AbortController();
    cleanAbortRef.current = ac;
    try {
      const result: CacheCleanResult = await cleanSafeCache(rawCategories, ac.signal);
      if (ac.signal.aborted) return;
      setFreedBytes(result.releasedBytes);
      setFailedCount(result.failedCount);
      if (result.failedCount > 0 && result.releasedBytes === 0) {
        setStatus('failure');
      } else if (result.failedCount > 0) {
        setStatus('partial_failure');
      } else {
        setStatus('success');
      }
      setData((prev) => prev ? { ...prev, totalBytes: 0, temporaryBytes: 0, mediaBytes: 0, orphanBytes: 0 } : prev);
      setRawCategories([]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStatus('failure');
    } finally {
      if (cleanAbortRef.current === ac) cleanAbortRef.current = null;
    }
  }, [rawCategories, cancelClean]);

  const handleDismiss = useCallback(() => {
    cancelScan();
    cancelClean();
    setStatus('idle');
    setData(null);
    setRawCategories([]);
    setFreedBytes(0);
    setFailedCount(0);
  }, [cancelScan, cancelClean]);

  /* ── Auto-scan on first activation ── */
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (active && !prevActiveRef.current && status === 'idle') {
      cleanupExpired();
      handleScan();
    }
    prevActiveRef.current = active;
  }, [active, status, handleScan, cleanupExpired]);

  /* ── Cancel on deactivation ── */
  useEffect(() => {
    if (!active) {
      cancelScan();
      cancelClean();
    }
  }, [active, cancelScan, cancelClean]);

  const footerLabel = (() => {
    switch (status) {
      case 'idle': return '正在準備';
      case 'scanning': return '正在檢查';
      case 'cleaning': return '正在整理';
      case 'ready': return '立即整理';
      case 'success':
      case 'partial_failure': return '完成';
      case 'failure': return '重新嘗試';
      case 'empty': return '今天已經很乾淨';
    }
  })();

  const footerDisabled = status === 'idle' || status === 'scanning' || status === 'cleaning' || status === 'empty';

  const summaryTag = (() => {
    if (rawCategories.length > 0) {
      const hasEstimated = rawCategories.some((c) => c.items.some((i) => i.estimated));
      return hasEstimated ? '估計可釋放' : '可安全釋放';
    }
    return '可安全釋放';
  })();

  return (
    <>
      <div className="dc-scroll-body">
        {/* Tab switcher */}
        <div className="dc-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`dc-tab${activeTab === 'cache' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('cache')}
            aria-selected={activeTab === 'cache'}
          >
            快取清理
          </button>
          <button
            type="button"
            role="tab"
            className={`dc-tab${activeTab === 'deleted' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('deleted')}
            aria-selected={activeTab === 'deleted'}
          >
            最近刪除
            {deletedCount > 0 && <span className="dc-tab-badge">{deletedCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            className="dc-tab"
            onClick={() => { cleanupExpired(); handleScan(); }}
            aria-label="強制清理過期項目"
          >
            清理過期
          </button>
        </div>

        {activeTab === 'cache' && (
        <>
        <p className="dc-subtitle">整理可安全清理的暫存資料</p>

        {status === 'idle' && (
          <div className="dc-progress">
            <div className="dc-progress-icon"><DailyCacheIcon size={32} /></div>
            <span className="dc-progress-text">正在準備檢查...</span>
          </div>
        )}

        {status === 'scanning' && (
          <div className="dc-progress">
            <div className="dc-progress-spinner" />
            <span className="dc-progress-text">正在檢查可整理內容...</span>
          </div>
        )}

        {status === 'cleaning' && (
          <div className="dc-progress">
            <div className="dc-progress-spinner" />
            <span className="dc-progress-text">正在整理中...</span>
          </div>
        )}

        {status === 'ready' && data && (
          <>
            <div className="dc-summary">
              <span className="dc-summary-tag">{summaryTag}</span>
              <span className="dc-summary-value">{formatBytes(data.totalBytes)}</span>
              <span className="dc-summary-count">{rawCategories.filter(c => c.totalBytes > 0).length} 類可整理內容</span>
            </div>

            <div className="dc-cat-list">
              {rawCategories.map((cat) => {
                const meta = CATEGORY_LABELS[cat.categoryId] || { label: cat.label, desc: '' };
                const hasEstimated = cat.items.some((i) => i.estimated);
                return (
                  <div key={cat.categoryId} className="dc-cat-row">
                    <div className="dc-cat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
                      </svg>
                    </div>
                    <div className="dc-cat-body">
                      <span className="dc-cat-label">{meta.label}{hasEstimated ? '*' : ''}</span>
                      <span className="dc-cat-desc">{meta.desc}</span>
                    </div>
                    <span className="dc-cat-value">{formatBytesCompact(cat.totalBytes)}</span>
                  </div>
                );
              })}
            </div>

            <div className="dc-meta-row">
              <span className="dc-meta-label">上次整理</span>
              <span className="dc-meta-value">{formatLastCleaned(null)}</span>
            </div>

            <div className="dc-toggle-row">
              <span className="dc-toggle-label">每日自動整理</span>
              <button type="button" className={`dc-toggle ${autoClean ? 'dc-toggle--on' : ''}`} onClick={() => setAutoClean(!autoClean)} role="switch" aria-checked={autoClean} aria-label="每日自動整理">
                <span className="dc-toggle-knob" />
              </button>
            </div>
          </>
        )}

        {status === 'success' && (
          <div className="dc-result">
            <div className="dc-result-icon dc-result-icon--success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="dc-result-title">整理完成</span>
            <span className="dc-result-sub">已釋放 {formatBytes(freedBytes)}</span>
          </div>
        )}

        {status === 'partial_failure' && (
          <div className="dc-result">
            <div className="dc-result-icon dc-result-icon--warn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <span className="dc-result-title">部分清理失敗</span>
            <span className="dc-result-sub">已釋放 {formatBytes(freedBytes)}，{failedCount} 項無法清除</span>
          </div>
        )}

        {status === 'failure' && (
          <div className="dc-result">
            <div className="dc-result-icon dc-result-icon--error">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <span className="dc-result-title">暫時無法完成整理</span>
            <span className="dc-result-sub">請稍後再試</span>
          </div>
        )}

        {status === 'empty' && (
          <div className="dc-result">
            <div className="dc-result-icon dc-result-icon--empty"><DailyCacheIcon size={24} /></div>
            <span className="dc-result-title">今天已經很乾淨</span>
            <span className="dc-result-sub">沒有需要清理的暫存資料</span>
          </div>
        )}
        </>
        )}

        {activeTab === 'deleted' && (
          <div className="dc-recovery-section" data-testid="daily-cache-recovery">
            <div className="dc-recovery-overview">
              <div className="dc-recovery-stat">
                <span className="dc-recovery-stat-label">聊天</span>
                <span className="dc-recovery-stat-value">{deletedConversations.length}</span>
              </div>
              <div className="dc-recovery-stat">
                <span className="dc-recovery-stat-label">手記</span>
                <span className="dc-recovery-stat-value">{deletedJournalEntries.length}</span>
              </div>
              <div className="dc-recovery-stat">
                <span className="dc-recovery-stat-label">保留天數</span>
                <span className="dc-recovery-stat-value">{retentionDays}</span>
              </div>
            </div>

            {deletedCount === 0 ? (
              <div className="dc-result">
                <div className="dc-result-icon dc-result-icon--empty"><DailyCacheIcon size={24} /></div>
                <span className="dc-result-title">最近刪除為空</span>
                <span className="dc-result-sub">沒有最近刪除的內容</span>
              </div>
            ) : (
              <div className="dc-deleted-list">
                {/* Deleted conversations */}
                {deletedConversations.map((conv) => {
                  const remainingMs = (conv.purgeAt ?? 0) - Date.now();
                  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                  return (
                    <div key={conv.id} className="dc-deleted-item" data-testid={`deleted-conv-${conv.id}`}>
                      <div className="dc-deleted-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div className="dc-deleted-item-info">
                        <span className="dc-deleted-item-title">{conv.customTitle || conv.title || '對話'}</span>
                        <span className="dc-deleted-item-meta">
                          {conv.messages?.length ?? 0} 則訊息 · 剩餘 {remainingDays} 天
                        </span>
                      </div>
                      <div className="dc-deleted-item-actions">
                        <button type="button" className="dc-deleted-btn dc-deleted-btn--restore"
                          onClick={() => restoreConversation(conv.id)}
                          aria-label={`恢復 ${conv.title}`}>
                          恢復
                        </button>
                        <button type="button" className="dc-deleted-btn dc-deleted-btn--perm"
                          onClick={() => { if (confirm('永久刪除此對話？此操作無法復原。')) permanentlyDeleteConversation(conv.id); }}
                          aria-label={`永久刪除 ${conv.title}`}>
                          徹底刪除
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Deleted journal entries */}
                {deletedJournalEntries.map((entry) => {
                  const remainingMs = (entry.purgeAt ?? 0) - Date.now();
                  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                  return (
                    <div key={entry.id} className="dc-deleted-item" data-testid={`deleted-journal-${entry.id}`}>
                      <div className="dc-deleted-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="dc-deleted-item-info">
                        <span className="dc-deleted-item-title">{entry.title || '無標題手記'}</span>
                        <span className="dc-deleted-item-meta">
                          {entry.kind === 'shared' ? '分享' : entry.kind === 'diary' ? '日記' : entry.kind === 'memory' ? '記憶' : entry.kind === 'ai_diary' ? 'AI日記' : '片段'}
                          {entry.tags?.length ? ` · ${entry.tags.slice(0, 2).join(', ')}` : ''}
                          {' · '}剩餘 {remainingDays} 天
                        </span>
                      </div>
                      <div className="dc-deleted-item-actions">
                        <button type="button" className="dc-deleted-btn dc-deleted-btn--restore"
                          onClick={() => restoreJournalEntries([entry.id])}
                          aria-label={`恢復 ${entry.title || '手記'}`}>
                          恢復
                        </button>
                        <button type="button" className="dc-deleted-btn dc-deleted-btn--perm"
                          onClick={() => { if (confirm('永久刪除此手記？此操作無法復原。')) permanentlyDeleteJournalEntries([entry.id]); }}
                          aria-label={`永久刪除 ${entry.title || '手記'}`}>
                          徹底刪除
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Bulk clear */}
                <div className="dc-deleted-bulk">
                  <button type="button" className="dc-deleted-btn dc-deleted-btn--perm"
                    onClick={() => {
                      const total = deletedConversations.length + deletedJournalEntries.length;
                      if (total > 0 && confirm(`將永久刪除：\n${deletedConversations.length} 個聊天\n${deletedJournalEntries.length} 篇手記\n\n此操作無法復原。`)) {
                        for (const c of deletedConversations) permanentlyDeleteConversation(c.id);
                        permanentlyDeleteJournalEntries(deletedJournalEntries.map((e) => e.id));
                      }
                    }}>
                    清空最近刪除
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dc-footer">
        <button type="button" className="dc-footer-btn" onClick={status === 'ready' ? handleClean : status === 'failure' ? handleScan : handleDismiss} disabled={footerDisabled}>
          {footerLabel}
        </button>
        <div className="dc-footer-safety">
          <span className="dc-footer-safety-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </span>
          <span className="dc-footer-safety-text">不會刪除聊天、記憶、手記、原始圖片或音訊</span>
        </div>
      </div>
    </>
  );
}
