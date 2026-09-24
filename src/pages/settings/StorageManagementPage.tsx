import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cacheRegistry, type CacheCategoryId } from '@/features/storage/cacheRegistry';
import { clearRegisteredCaches, estimateCaches } from '@/features/storage/cacheService';
import { estimateDeviceStorage, formatStorageSize } from '@/features/storage/storageEstimate';
import { useStorageManagementStore } from '@/store/useStorageManagementStore';
import { useToastStore } from '@/store/useToastStore';

interface CategoryEstimate { bytes: number | null; approximate: boolean }

function CacheConfirmDialog({ bytes, running, currentLabel, onCancel, onConfirm }: { bytes: number | null; running: boolean; currentLabel?: string; onCancel(): void; onConfirm(): void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>('button');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !running) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, running]);
  return <div className="storage-confirm-backdrop" onMouseDown={() => !running && onCancel()}>
    <div ref={dialogRef} className="storage-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="storage-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
      <h2 id="storage-confirm-title">清除暂存资料？</h2>
      <p>将移除可重新下载或重新产生的暂存内容。你的聊天、记忆、任务、设置与原始图片不会被删除。</p>
      {running && <div className="storage-clear-progress" role="status">正在清理：{currentLabel || '准备中'}</div>}
      <footer><button type="button" onClick={onCancel} disabled={running}>取消</button><button type="button" className="is-danger" onClick={onConfirm} disabled={running}>清除 {formatStorageSize(bytes, true)}</button></footer>
    </div>
  </div>;
}

export function StorageManagementPage() {
  const navigate = useNavigate();
  const selectedIds = useStorageManagementStore((state) => state.selectedIds);
  const lastCleanedAt = useStorageManagementStore((state) => state.lastCleanedAt);
  const running = useStorageManagementStore((state) => state.running);
  const currentCategory = useStorageManagementStore((state) => state.currentCategory);
  const toggleCategory = useStorageManagementStore((state) => state.toggleCategory);
  const setSelectedIds = useStorageManagementStore((state) => state.setSelectedIds);
  const setRunState = useStorageManagementStore((state) => state.setRunState);
  const complete = useStorageManagementStore((state) => state.complete);
  const showToast = useToastStore((state) => state.showToast);
  const [device, setDevice] = useState<{ usage: number | null; quota: number | null }>({ usage: null, quota: null });
  const [estimates, setEstimates] = useState<Record<string, CategoryEstimate>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const [storage, categories] = await Promise.all([estimateDeviceStorage(), estimateCaches()]);
    setDevice(storage);
    setEstimates(Object.fromEntries(categories.map((item) => [item.id, { bytes: item.bytes, approximate: item.approximate }])));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (Object.keys(estimates).length !== cacheRegistry.length) return;
    const available = new Set(cacheRegistry.filter((item) => estimates[item.id]?.bytes !== 0).map((item) => item.id));
    const next = selectedIds.filter((id) => available.has(id));
    if (next.length !== selectedIds.length) setSelectedIds(next);
  }, [estimates, selectedIds, setSelectedIds]);

  const clearableBytes = useMemo(() => selectedIds.reduce<number | null>((sum, id) => {
    const value = estimates[id]?.bytes;
    return sum === null || value === null || value === undefined ? null : sum + value;
  }, 0), [estimates, selectedIds]);
  const currentLabel = cacheRegistry.find((item) => item.id === currentCategory)?.label;
  const hasClearableSelection = selectedIds.some((id) => estimates[id]?.bytes === null || (estimates[id]?.bytes ?? 0) > 0);
  const clearButtonLabel = hasClearableSelection ? `清除 ${formatStorageSize(clearableBytes, true)}` : '目前没有可清理的暂存资料';
  const lastResult = useStorageManagementStore((state) => state.lastResult);

  const closeConfirm = useCallback(() => {
    if (running) return;
    setConfirmOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [running]);
  const runClear = async () => {
    if (running || selectedIds.length === 0) return;
    setRunState(true);
    const result = await clearRegisteredCaches(selectedIds, (id) => setRunState(true, id));
    complete(result);
    setConfirmOpen(false);
    await refresh();
    showToast(result.errors.length ? `已清除 ${formatStorageSize(result.clearedBytes)}，另有 ${result.errors.length} 项无法清理。` : `已清除 ${formatStorageSize(result.clearedBytes)} 暂存资料`);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return <div className="storage-management-page">
    <section className="storage-overview-card">
      <div><span>浏览器估算空间</span><strong>{formatStorageSize(device.usage, true)}</strong><small>{device.quota === null ? '无法估算容量上限' : `估算配额 ${formatStorageSize(device.quota, true)}`}</small></div>
      <div><span>可安全清理资料</span><strong>{formatStorageSize(clearableBytes, true)}</strong><small>Rune 已登記的可重建資料</small></div>
      <div><span>上次清理时间</span><strong>{lastCleanedAt ? new Date(lastCleanedAt).toLocaleString('zh-TW') : '尚未清理'}</strong><small>不会自动删除个人内容</small></div>
    </section>

    <button type="button" className="storage-cache-entry" onClick={() => navigate('/settings/data/cache')} aria-label="前往緩存管理">
      <span className="storage-cache-entry-copy"><strong>緩存管理</strong><small>掃描暫存、清理過期項目與最近刪除</small></span>
      <span className="storage-cache-entry-arrow" aria-hidden="true">→</span>
    </button>

    <section className="storage-primary-action-card">
      <div><strong>清除暂存资料</strong><p>聊天、记忆、任务、设置与原始图片都会保留。</p></div>
      <button ref={triggerRef} type="button" className="storage-clear-primary" disabled={running || !hasClearableSelection} onClick={() => setConfirmOpen(true)}>{clearButtonLabel}</button>
    </section>

    <section className="storage-cache-section">
      <header><div><h2>可清理分类</h2><p>选择这次要清理的可重建内容。</p></div><span>已选择 {selectedIds.length} 项</span></header>
      <div className="storage-cache-list">
        {cacheRegistry.map((cleaner) => {
          const bytes = estimates[cleaner.id]?.bytes ?? null;
          const empty = bytes === 0;
          return <label key={cleaner.id} className={`storage-cache-row${empty ? ' is-empty' : ''}`}>
          <input type="checkbox" checked={selectedIds.includes(cleaner.id)} onChange={() => toggleCategory(cleaner.id)} disabled={running || empty} />
          <span className="storage-cache-check" aria-hidden="true" />
          <span className="storage-cache-copy"><strong>{cleaner.label}</strong><small>{cleaner.description}</small></span>
          <span className="storage-cache-size">{empty ? '没有可清理内容' : formatStorageSize(bytes, estimates[cleaner.id]?.approximate)}</span>
        </label>;})}
      </div>
      <footer className="storage-cache-footer">
        <button type="button" className="storage-clear-selection" disabled={running || selectedIds.length === 0} onClick={() => setSelectedIds([])}>取消选择</button>
        <button type="button" className="storage-clear-primary" disabled={running || !hasClearableSelection} onClick={() => setConfirmOpen(true)}>{clearButtonLabel}</button>
      </footer>
      {lastResult?.errors.length ? <div className="storage-error-summary"><button type="button" onClick={() => setShowDetails((value) => !value)}>查看失败详情</button>{showDetails && <ul>{lastResult.errors.map((error) => <li key={error.id}>{error.id}：{error.message}</li>)}</ul>}</div> : null}
    </section>

    <details className="storage-protection-card"><summary><span><strong>不会删除的资料</strong><small>聊天、记忆、任务、设置与原始图片都会保留。</small></span></summary><ul>{['聊天与消息', '长期记忆与会话摘要', '任务、日历与时光', 'AI 模型设置与账号凭证', '草稿与个人设置', '自定义主题与背景原图', '照片、收藏与音乐资料'].map((label) => <li key={label}>{label}</li>)}</ul></details>
    <details className="storage-danger-zone"><summary><span><strong>进阶资料管理</strong><small>与安全清理分开的重设与删除操作</small></span></summary><p>清除聊天、长期记忆、自定义主题、本机图片与重置 Rune 尚未开放，未来会使用独立的加强确认流程。</p><span className="storage-coming-soon">尚未开放</span></details>
    {confirmOpen && <CacheConfirmDialog bytes={clearableBytes} running={running} currentLabel={currentLabel} onCancel={closeConfirm} onConfirm={() => void runClear()} />}
  </div>;
}
