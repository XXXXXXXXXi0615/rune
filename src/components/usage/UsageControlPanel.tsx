import { useState, useRef, useEffect, useMemo, type RefObject } from 'react';
import { useUsageStore } from '@/store/useUsageStore';
import { toLocalDateString } from '@/utils/date';
import { MODULE_LABELS_SHORT, type UsageModuleId } from '@/types/usage';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useTideRailStore } from '@/store/useTideRailStore';
import './UsageControlPanel.css';

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 分';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} 分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 時 ${m} 分` : `${h} 小時`;
}

function formatTimer(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  showTrigger?: boolean;
  onOpenLockSettings?: () => void;
  lockSettingsOpen?: boolean;
  lockSettingsTriggerRef?: RefObject<HTMLButtonElement | null>;
}

export function UsageControlPanel({ showTrigger = true, onOpenLockSettings, lockSettingsOpen = false, lockSettingsTriggerRef }: Props) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const records = useCheckInStore((s) => s.records);
  const streak = useCheckInStore((s) => s.getCurrentPerfectStreak());
  const openDailyTide = useTideRailStore((s) => s.openWindow);

  // Subscribe to canonical store references only — these change ONLY on real
  // store updates, giving React useSyncExternalStore a stable snapshot.
  const dailyRecords = useUsageStore((s) => s.dailyRecords);
  const currentSession = useUsageStore((s) => s.currentSession);

  const today = toLocalDateString(new Date(now));
  const checkedIn = records.some((record) => record.kind === 'clock_in' && record.date === today);
  const todayCheckIn = records.find((record) => record.kind === 'clock_in' && record.date === today);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = useMemo(() => {
    const record = dailyRecords.find((r) => r.dateKey === today);
    if (!currentSession) return record;
    const mod = currentSession.moduleId;
    const elapsed = Math.max(0, now - currentSession.startedAt);
    if (elapsed <= 0) return record;
    const copy = record
      ? { ...record, moduleDurationsMs: { ...record.moduleDurationsMs } }
      : { dateKey: today, moduleDurationsMs: {} as Record<UsageModuleId, number>, totalDurationMs: 0 };
    copy.moduleDurationsMs[mod] = (copy.moduleDurationsMs[mod] ?? 0) + elapsed;
    copy.totalDurationMs += elapsed;
    return copy;
  }, [dailyRecords, currentSession, now, today]);

  const todayTotalMs = useMemo(() => {
    const record = dailyRecords.find((r) => r.dateKey === today);
    let total = record?.totalDurationMs ?? 0;
    if (currentSession) {
      const elapsed = now - currentSession.startedAt;
      if (elapsed > 0) total += elapsed;
    }
    return total;
  }, [dailyRecords, currentSession, now, today]);

  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    const dateKey = toLocalDateString(date);
    const stored = dailyRecords.find((record) => record.dateKey === dateKey)?.totalDurationMs ?? 0;
    return { dateKey, totalMs: dateKey === today ? todayTotalMs : stored };
  }), [dailyRecords, now, today, todayTotalMs]);
  const trendMax = Math.max(1, ...last7Days.map((day) => day.totalMs));

  const lockSettings = useUsageStore((s) => s.lockSettings);
  const extensionExpiresAt = useUsageStore((s) => s.extensionExpiresAt);
  const extensionGrantedDateKey = useUsageStore((s) => s.extensionGrantedDateKey);

  // Top modules today (sorted by duration)
  const topModules = useMemo(() => {
    if (!todayRecord) return [];
    return Object.entries(todayRecord.moduleDurationsMs)
      .filter(([, ms]) => ms > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [todayRecord]);

  const limitMinutes = lockSettings.dailyLimitMinutes;
  const limitMs = limitMinutes * 60 * 1000;
  const remainingMs = Math.max(0, limitMs - todayTotalMs);
  const isOverLimit = lockSettings.enabled && todayTotalMs >= limitMs;
  const extensionActive = extensionGrantedDateKey === today && extensionExpiresAt > now;
  const extensionRemainingMinutes = Math.max(1, Math.ceil((extensionExpiresAt - now) / 60000));

  const closePanel = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => orbRef.current?.focus());
  };

  useEffect(() => {
    if (!open || lockSettingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lockSettingsOpen]);

  useEffect(() => {
    if (!open || lockSettingsOpen) return;
    const onOutside = (e: PointerEvent) => {
      if (!hostRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open, lockSettingsOpen]);

  const togglePanel = () => open ? closePanel() : setOpen(true);
  const compactDuration = formatTimer(todayTotalMs).replace(/^0:/, '');

  return (
    <div className="usage-ctrl-panel" ref={hostRef} data-open={open || undefined} data-pet-safe-region data-testid="top-utility-island">
      {showTrigger && <div className="usage-ctrl-island-family">
      <button
        ref={orbRef}
        type="button"
        className="usage-ctrl-capsule"
        aria-label={open ? '關閉今日狀態' : '開啟今日狀態'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={togglePanel}
        data-testid="top-utility-main"
      ><span aria-hidden="true">{checkedIn ? '✓' : '○'}</span><span className="usage-ctrl-summary-wide">{checkedIn ? `連續 ${streak} 天` : '今日未報備'} · </span><span className="usage-ctrl-summary-narrow">{checkedIn ? `${streak}天 · ` : '· '}</span><time>{compactDuration}</time></button>
      <button
        type="button"
        className="usage-ctrl-orb"
        aria-label={open ? '關閉今日狀態' : '開啟今日狀態'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={togglePanel}
        data-testid="usage-ctrl-orb"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {lockSettings.enabled ? <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /> : <><path d="M5 19V12M12 19V5M19 19V9" /><path d="M3 19h18" /></>}
        </svg>
      </button></div>}

      {open && (
        <>
          <div className="usage-ctrl-backdrop" aria-hidden="true" onClick={() => closePanel()} />
          <section
            className="usage-ctrl-palette"
            role="dialog"
            aria-label="今日狀態"
            aria-hidden={lockSettingsOpen || undefined}
            data-subdued={lockSettingsOpen || undefined}
            data-testid="usage-ctrl-palette"
          >
          <div className="usage-ctrl-grab" aria-hidden="true" />
          <header className="usage-ctrl-header">
            <div>
              <small>TODAY</small>
              <h2>今日狀態</h2>
            </div>
            <button type="button" className="usage-ctrl-close" onClick={() => closePanel()} aria-label="關閉今日狀態">×</button>
          </header>

          <section className="usage-ctrl-checkin" aria-label="每日報備">
            <span className={`usage-ctrl-checkin-mark${checkedIn ? ' is-done' : ''}`} aria-hidden="true">{checkedIn ? '✓' : '☾'}</span>
            <div><strong>{checkedIn ? '今日已報備' : '今日未報備'}</strong><small>{todayCheckIn?.clockInAt ? `${new Intl.DateTimeFormat('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(todayCheckIn.clockInAt))} · ` : ''}連續 {streak} 天</small></div>
            {/* Phase D: the consolidated 報備 window is the single entry — both states open
                it; the canonical `clockIn` action lives inside the window. */}
            {checkedIn
              ? <button type="button" onClick={() => { openDailyTide('checkin'); closePanel(false); }}>查看</button>
              : <button type="button" onClick={() => { openDailyTide('checkin'); closePanel(false); }} data-testid="top-utility-checkin">報備</button>}
          </section>

          <div className="usage-ctrl-today">
            <div className="usage-ctrl-today-label">今日使用</div>
            <div className={`usage-ctrl-today-value${isOverLimit ? ' is-over' : ''}`}>
              {formatTimer(todayTotalMs)}
            </div>
          </div>

          <div className="usage-ctrl-chart-section">
            <div className="usage-ctrl-section-label">最近 7 天</div>
            <div className="usage-ctrl-chart" aria-label="最近七天使用趨勢">
              {last7Days.map((day) => <span key={day.dateKey} className={day.dateKey === today ? 'is-today' : undefined} style={{ height: `${Math.max(4, day.totalMs / trendMax * 34)}px` }} />)}
            </div>
          </div>

          {/* Top modules */}
          <div className="usage-ctrl-modules">
            {topModules.length > 0 && (
              <>
                <div className="usage-ctrl-modules-title">今日使用最多</div>
                {topModules.map(([modId, ms]) => (
                  <div key={modId} className="usage-ctrl-module-row">
                    <span>{MODULE_LABELS_SHORT[modId as UsageModuleId] ?? modId}</span>
                    <span>{formatDuration(ms)}</span>
                  </div>
                ))}
              </>
            )}
            {topModules.length === 0 && (
              <div className="usage-ctrl-empty">今天尚無使用記錄</div>
            )}
          </div>

          {/* Time lock status */}
          <div className="usage-ctrl-lock">
            <div className="usage-ctrl-lock-row">
              <span className="usage-ctrl-lock-status">
                <span className={`usage-ctrl-lock-dot${lockSettings.enabled ? ' is-on' : ' is-off'}`} />
                時間鎖{lockSettings.enabled ? ' 開啟' : ' 關閉'}
              </span>
              {lockSettings.enabled && (
                <span>
                  {extensionActive
                    ? `臨時延長中 · 剩餘 ${extensionRemainingMinutes} 分`
                    : `每日上限 ${formatDuration(limitMs)} · 剩餘 ${formatDuration(remainingMs)}`}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="usage-ctrl-actions">
            <button
              type="button"
              className="usage-ctrl-btn"
              ref={lockSettingsTriggerRef}
              onClick={() => onOpenLockSettings?.()}
              data-testid="usage-ctrl-lock-settings"
            >
              設定時間鎖
            </button>
          </div>
          </section>
        </>
      )}
    </div>
  );
}
