import { useState, useCallback, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useUsageStore } from '@/store/useUsageStore';
import { PRESET_LIMITS } from '@/types/usage';
import { toLocalDateString } from '@/utils/date';
import './UsageLockSettings.css';

interface Props {
  onClose: () => void;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 分鐘';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分鐘`;
}

export function UsageLockSettingsSheet({ onClose }: Props) {
  const lockSettings = useUsageStore((s) => s.lockSettings);
  const setLockSettings = useUsageStore((s) => s.setLockSettings);
  const dailyRecords = useUsageStore((s) => s.dailyRecords);
  const currentSession = useUsageStore((s) => s.currentSession);
  const todayTotalMs = useMemo(() => {
    const today = toLocalDateString();
    const persisted = dailyRecords.find((record) => record.dateKey === today)?.totalDurationMs ?? 0;
    if (!currentSession) return persisted;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    return persisted + Math.max(0, Date.now() - Math.max(currentSession.startedAt, startOfToday));
  }, [currentSession, dailyRecords]);

  const [enabled, setEnabled] = useState(lockSettings.enabled);
  const [limit, setLimit] = useState(lockSettings.dailyLimitMinutes);
  const [customValue, setCustomValue] = useState('');
  const [allowExt, setAllowExt] = useState(lockSettings.allowTemporaryExtension);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const isPreset = PRESET_LIMITS.includes(limit as any);
  const isCustom = !isPreset;

  const handleSave = useCallback(() => {
    let minutes = limit;
    if (isCustom && customValue) {
      const parsed = parseInt(customValue, 10);
      if (!isNaN(parsed) && parsed > 0) minutes = parsed;
    }
    setLockSettings({
      enabled,
      dailyLimitMinutes: minutes,
      allowTemporaryExtension: allowExt,
    });
    onClose();
  }, [enabled, limit, customValue, isCustom, allowExt, setLockSettings, onClose]);

  useEffect(() => {
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const remaining = Math.max(0, limit * 60 * 1000 - todayTotalMs);
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!controls.length) return;
    const first = controls[0]!;
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return createPortal(
    <div className="usage-lock-settings-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="usage-lock-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="時間鎖設定"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
      >
        <div className="uls-handle" aria-hidden="true" />
        <header className="uls-header">
          <h3 className="uls-title">時間鎖設定</h3>
          <button ref={closeRef} type="button" className="uls-close" onClick={onClose} aria-label="關閉時間鎖設定">×</button>
        </header>

        <div className="uls-body">
          <div className="uls-row">
            <span>時間鎖</span>
            <button
              type="button"
              className={`uls-toggle${enabled ? ' is-on' : ''}`}
              onClick={() => setEnabled((e) => !e)}
              aria-label={enabled ? '關閉時間鎖' : '開啟時間鎖'}
              role="switch"
              aria-checked={enabled}
              data-testid="lock-toggle"
            />
          </div>

          <div className="uls-status" aria-live="polite">
            <span>狀態</span>
            <strong>{enabled ? `每日上限 ${formatDuration(limit * 60 * 1000)}` : '目前關閉'}</strong>
            {!enabled && <p>限制尚未啟用。啟用後，月潮會依設定時間進入鎖定狀態。</p>}
          </div>

          {enabled && (
          <>
            {/* Preset limits */}
            <div className="uls-section">
              <div className="uls-section-label">每日使用時長</div>
              <div className="uls-chips">
                {PRESET_LIMITS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    className={`uls-chip${limit === min && !isCustom ? ' is-on' : ''}`}
                    onClick={() => { setLimit(min); setCustomValue(''); }}
                  >
                    {min >= 60 ? `${min / 60} 小時` : `${min} 分`}
                  </button>
                ))}
                <button
                  type="button"
                  className={`uls-chip${isCustom ? ' is-on' : ''}`}
                  onClick={() => { setLimit(0); }}
                >
                  自訂
                </button>
              </div>
            </div>

            {isCustom && (
              <div className="uls-custom-wrap">
                <input
                  type="number"
                  className="uls-custom-input"
                  value={customValue}
                  min={1}
                  max={1440}
                  placeholder="分鐘"
                  onChange={(e) => setCustomValue(e.target.value)}
                  aria-label="自訂分鐘數"
                />
                <span className="uls-custom-label">分鐘</span>
              </div>
            )}

            {/* Summary */}
            <div className="uls-summary">
              <div className="uls-summary-row">
                <span>今天已使用</span>
                <span>{formatDuration(todayTotalMs)}</span>
              </div>
              <div className="uls-summary-row">
                <span>剩餘</span>
                <span>{formatDuration(remaining)}</span>
              </div>
            </div>

            {/* Extension toggle */}
            <div className="uls-ext-toggle">
              <span>允許暫時延長</span>
              <button
                type="button"
                className={`uls-toggle${allowExt ? ' is-on' : ''}`}
                onClick={() => setAllowExt((e) => !e)}
                aria-label={allowExt ? '關閉暫時延長' : '開啟暫時延長'}
                role="switch"
                aria-checked={allowExt}
                data-testid="lock-ext-toggle"
              />
            </div>
          </>
          )}
        </div>

        <footer className="uls-footer">
          <button type="button" className="uls-cancel" onClick={onClose}>取消</button>
          <button type="button" className="uls-save" onClick={handleSave} data-testid="lock-settings-done">儲存</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
