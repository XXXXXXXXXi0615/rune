import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUsageStore } from '@/store/useUsageStore';
import { verifyPassword } from '@/utils/auth';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import './UsageLockGate.css';

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 分鐘';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分鐘`;
}

export function UsageLockGate() {
  const dailyRecords = useUsageStore((s) => s.dailyRecords);
  const currentSession = useUsageStore((s) => s.currentSession);
  const lockSettings = useUsageStore((s) => s.lockSettings);
  const extensionExpiresAt = useUsageStore((s) => s.extensionExpiresAt);
  const extensionGrantedDateKey = useUsageStore((s) => s.extensionGrantedDateKey);
  const passwordBypassExpiresAt = useUsageStore((s) => s.passwordBypassExpiresAt);
  const grantTemporaryExtension = useUsageStore((s) => s.grantTemporaryExtension);
  const grantPasswordBypass = useUsageStore((s) => s.grantPasswordBypass);
  const recordLockTriggered = useUsageStore((s) => s.recordLockTriggered);
  const [now, setNow] = useState(() => Date.now());

  const todayTotalMs = useMemo(() => {
    const today = toLocalDateString(new Date(now));
    const persisted = dailyRecords.find((record) => record.dateKey === today)?.totalDurationMs ?? 0;
    if (!currentSession) return persisted;
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    return persisted + Math.max(0, now - Math.max(currentSession.startedAt, startOfToday));
  }, [currentSession, dailyRecords, now]);

  const limitMs = lockSettings.dailyLimitMinutes * 60 * 1000;
  const today = toLocalDateString(new Date(now));
  const extensionUsedToday = extensionGrantedDateKey === today;
  const extensionActive = extensionUsedToday && extensionExpiresAt > now;
  const legacyPasswordBypassActive = !extensionGrantedDateKey && extensionExpiresAt > now;
  const passwordBypassActive = passwordBypassExpiresAt > now;
  const isLocked = lockSettings.enabled && !extensionActive && !legacyPasswordBypassActive && !passwordBypassActive && todayTotalMs >= limitMs;

  const [stage, setStage] = useState<'locked' | 'verifying' | 'error'>('locked');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // One-shot enforcement wake-up: this is not a second usage counter.
  useEffect(() => {
    if (!lockSettings.enabled) return;
    const bypassActive = extensionActive || legacyPasswordBypassActive || passwordBypassActive;
    const untilLimit = currentSession && !bypassActive
      ? Math.max(0, limitMs - todayTotalMs)
      : Number.POSITIVE_INFINITY;
    const untilBypassExpiry = extensionActive
      ? Math.max(0, extensionExpiresAt - now)
      : passwordBypassActive
        ? Math.max(0, passwordBypassExpiresAt - now)
        : legacyPasswordBypassActive
          ? Math.max(0, extensionExpiresAt - now)
          : Number.POSITIVE_INFINITY;
    const delay = Math.min(untilLimit, untilBypassExpiry, 2_147_000_000);
    if (!Number.isFinite(delay)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [currentSession, extensionActive, extensionExpiresAt, legacyPasswordBypassActive, limitMs, lockSettings.enabled, now, passwordBypassActive, passwordBypassExpiresAt, todayTotalMs]);

  useEffect(() => {
    if (!isLocked) return;
    useUsageStore.getState().pauseSession();
    void recordLockTriggered();
  }, [isLocked, recordLockTriggered]);

  const handleUnlock = useCallback(() => {
    if (stage === 'locked') {
      setStage('verifying');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [stage]);

  const handleVerify = useCallback(async () => {
    setError('');
    const storedHash = useAppStore.getState().auth.passwordHash;
    const isValid = await verifyPassword(password, storedHash);
    if (isValid) {
      // Grant 10 more minutes if extension allowed, otherwise just bypass
      if (lockSettings.allowTemporaryExtension) await grantTemporaryExtension();
      else grantPasswordBypass();
      setStage('locked');
      setPassword('');
    } else {
      setError('密碼不正確');
      setPassword('');
      inputRef.current?.focus();
    }
  }, [password, lockSettings.allowTemporaryExtension, grantPasswordBypass, grantTemporaryExtension]);

  const handleExtension = useCallback(async () => {
    await grantTemporaryExtension();
  }, [grantTemporaryExtension]);

  useEffect(() => {
    const syncExtension = (event: StorageEvent) => {
      if (event.key === 'lunartide-usage') void useUsageStore.persist.rehydrate();
    };
    window.addEventListener('storage', syncExtension);
    return () => window.removeEventListener('storage', syncExtension);
  }, []);

  const handleCancel = useCallback(() => {
    setStage('locked');
    setPassword('');
    setError('');
  }, []);

  // Escape key
  useEffect(() => {
    if (stage !== 'verifying') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { handleCancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, handleCancel]);

  // Only show if locked (all hooks above so the hook order never changes)
  if (!isLocked) return null;

  if (stage === 'verifying') {
    return createPortal(
      <div className="usage-lock-gate" data-testid="usage-lock-gate">
        <div className="usage-lock-card">
          <div className="usage-lock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="usage-lock-title">輸入密碼解鎖</div>
          <input
            ref={inputRef}
            type="password"
            className="usage-lock-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
            placeholder="輸入月潮密碼"
            aria-label="解鎖密碼"
            data-testid="usage-lock-password"
            autoFocus
          />
          {error && <div className="usage-lock-error">{error}</div>}
          <div className="usage-lock-actions" style={{ marginTop: 16 }}>
            <button type="button" className="usage-lock-btn is-primary" onClick={handleVerify} data-testid="usage-lock-verify">
              解鎖
            </button>
            <button type="button" className="usage-lock-btn" onClick={handleCancel}>
              取消
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="usage-lock-gate" data-testid="usage-lock-gate">
      <div className="usage-lock-card">
        <div className="usage-lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="usage-lock-title">今日使用時間已到</div>
        <div className="usage-lock-desc">
          今天已使用 {formatDuration(todayTotalMs)}。
        </div>
        <div className="usage-lock-detail">
          每日上限 {formatDuration(lockSettings.dailyLimitMinutes * 60 * 1000)}
        </div>
        <div className="usage-lock-actions">
          <button
            type="button"
            className="usage-lock-btn is-primary"
            onClick={handleUnlock}
            data-testid="usage-lock-unlock"
          >
            解鎖繼續使用
          </button>
          {lockSettings.allowTemporaryExtension && (
            <button
              type="button"
              className="usage-lock-btn"
              onClick={handleExtension}
              data-testid="usage-lock-extend"
              disabled={extensionUsedToday}
            >
              {extensionUsedToday ? '今天的臨時延長已使用' : '臨時延長 10 分鐘'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
