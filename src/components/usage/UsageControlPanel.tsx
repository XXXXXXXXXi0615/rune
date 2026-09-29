import { useState, useEffect, useMemo } from 'react';
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

function formatClockMinutes(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
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
  onOpenLockSettings?: (trigger: HTMLButtonElement) => void;
  lockSettingsOpen?: boolean;
}

export function UsageControlPanel({ showTrigger = true }: Props) {
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const todayTotalMs = useMemo(() => {
    const record = dailyRecords.find((r) => r.dateKey === today);
    let total = record?.totalDurationMs ?? 0;
    if (currentSession) {
      const elapsed = now - currentSession.startedAt;
      if (elapsed > 0) total += elapsed;
    }
    return total;
  }, [dailyRecords, currentSession, now, today]);

  const lockSettings = useUsageStore((s) => s.lockSettings);

  const openFloat = (tab: 'checkin' | 'hydration' | 'usage', trigger: HTMLButtonElement) => {
    window.dispatchEvent(new CustomEvent('today-status-open', { detail: { tab, trigger } }));
    openDailyTide(tab === 'hydration' ? 'hydration' : 'checkin');
  };
  const compactDuration = formatTimer(todayTotalMs).replace(/^0:/, '');

  return (
    <div className="usage-ctrl-panel" data-pet-safe-region data-testid="top-utility-island">
      {showTrigger && <div className="usage-ctrl-island-family">
      <button
        type="button"
        className="usage-ctrl-capsule"
        aria-label="開啟每日報備"
        aria-haspopup="dialog"
        onClick={(event) => openFloat('checkin', event.currentTarget)}
        data-testid="top-utility-main"
      ><span aria-hidden="true">{checkedIn ? '✓' : '○'}</span><span className="usage-ctrl-summary-wide">{checkedIn ? `連續 ${streak} 天` : '今日未報備'} · </span><span className="usage-ctrl-summary-narrow">{checkedIn ? `${streak}天 · ` : '· '}</span><time>{compactDuration}</time></button>
      <button type="button" className="usage-ctrl-water-entry" aria-label="開啟今日飲水" aria-haspopup="dialog" onClick={(event) => openFloat('hydration', event.currentTarget)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 2.7c3.2 3.9 6 7.2 6 10.3a6 6 0 1 1-12 0c0-3.1 2.8-6.4 6-10.3z" /></svg>
      </button>
      <button
        type="button"
        className="usage-ctrl-orb"
        aria-label="開啟今日使用"
        aria-haspopup="dialog"
        onClick={(event) => openFloat('usage', event.currentTarget)}
        data-testid="usage-ctrl-orb"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {lockSettings.enabled ? <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /> : <><path d="M5 19V12M12 19V5M19 19V9" /><path d="M3 19h18" /></>}
        </svg>
      </button></div>}

    </div>
  );
}

export function UsageStatusContent({ onOpenLockSettings, lockSettingsOpen }: Pick<Props, 'onOpenLockSettings' | 'lockSettingsOpen'>) {
  const [now, setNow] = useState(() => Date.now());
  const dailyRecords = useUsageStore((s) => s.dailyRecords);
  const currentSession = useUsageStore((s) => s.currentSession);
  const today = toLocalDateString(new Date(now));
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const todayRecord = useMemo(() => {
    const record = dailyRecords.find((r) => r.dateKey === today);
    if (!currentSession) return record;
    const elapsed = Math.max(0, now - currentSession.startedAt);
    if (!elapsed) return record;
    const copy = record ? { ...record, moduleDurationsMs: { ...record.moduleDurationsMs } } : { dateKey: today, moduleDurationsMs: {} as Record<UsageModuleId, number>, totalDurationMs: 0 };
    copy.moduleDurationsMs[currentSession.moduleId] = (copy.moduleDurationsMs[currentSession.moduleId] ?? 0) + elapsed;
    copy.totalDurationMs += elapsed;
    return copy;
  }, [dailyRecords, currentSession, now, today]);
  const todayTotalMs = todayRecord?.totalDurationMs ?? 0;
  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setDate(date.getDate() - (6 - index));
    const dateKey = toLocalDateString(date);
    return { dateKey, totalMs: dateKey === today ? todayTotalMs : dailyRecords.find((record) => record.dateKey === dateKey)?.totalDurationMs ?? 0 };
  }), [dailyRecords, now, today, todayTotalMs]);
  const trendMax = Math.max(1, ...last7Days.map((day) => day.totalMs));
  const lockSettings = useUsageStore((s) => s.lockSettings);
  const extensionExpiresAt = useUsageStore((s) => s.extensionExpiresAt);
  const extensionGrantedDateKey = useUsageStore((s) => s.extensionGrantedDateKey);
  const topModules = useMemo(() => todayRecord ? Object.entries(todayRecord.moduleDurationsMs).filter(([, ms]) => ms > 0).sort(([, a], [, b]) => b - a).slice(0, 5) : [], [todayRecord]);
  const limitMs = lockSettings.dailyLimitMinutes * 60000;
  const remainingMs = Math.max(0, limitMs - todayTotalMs);
  const isOverLimit = lockSettings.enabled && todayTotalMs >= limitMs;
  const extensionActive = extensionGrantedDateKey === today && extensionExpiresAt > now;
  const extensionRemainingMinutes = Math.max(1, Math.ceil((extensionExpiresAt - now) / 60000));

  /* Radial usage clock (Phase 1) — summary semantics only. The ring visualises
     used vs daily limit when a Time Lock limit exists; without one it stays an
     idle track and says so. It never starts/pauses anything. */
  const ringPercent = lockSettings.enabled ? Math.min(100, Math.max(0, (todayTotalMs / limitMs) * 100)) : 0;
  const ringCaptionLines = isOverLimit
    ? ['已超過每日上限']
    : lockSettings.enabled
      ? [`已用 ${Math.round(ringPercent)}%`, `上限 ${formatDuration(limitMs)}`]
      : ['尚未設定', '時間鎖上限'];
  const ringAriaLabel = lockSettings.enabled
    ? `今日使用 ${formatDuration(todayTotalMs)}，每日上限 ${formatDuration(limitMs)}，已用 ${Math.round(ringPercent)}%`
    : `今日使用 ${formatDuration(todayTotalMs)}，未設定每日上限`;

  return <div className="usage-ctrl-content" aria-label="今日使用" aria-hidden={lockSettingsOpen || undefined}>

          <div className="usage-ring-block">
            <div
              className={`usage-ring${isOverLimit ? ' is-over' : ''}${lockSettings.enabled ? '' : ' is-unbounded'}`}
              role="img"
              aria-label={ringAriaLabel}
            >
              <svg viewBox="0 0 128 128" aria-hidden="true" focusable="false">
                <circle className="usage-ring-ticks" cx="64" cy="64" r="60" pathLength={60} />
                <circle className="usage-ring-track" cx="64" cy="64" r="52" />
                <circle
                  className="usage-ring-progress"
                  cx="64" cy="64" r="52"
                  pathLength={100}
                  strokeDasharray={lockSettings.enabled ? `${ringPercent} ${100 - ringPercent}` : '0 100'}
                  transform="rotate(-90 64 64)"
                />
              </svg>
              <div className="usage-ring-center" aria-hidden="true">
                <span className="usage-ring-label">今日使用</span>
                <span className="usage-ring-value">{formatClockMinutes(todayTotalMs)}</span>
                <span className="usage-ring-caption">
                  {ringCaptionLines.map((line) => <span key={line}>{line}</span>)}
                </span>
              </div>
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
              onClick={(event) => onOpenLockSettings?.(event.currentTarget)}
              data-testid="usage-ctrl-lock-settings"
            >
              設定時間鎖
            </button>
          </div>
    </div>;
}
