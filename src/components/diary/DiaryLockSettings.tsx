import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  createDiaryLock,
  disableDiaryLock,
  getDiaryLockConfig,
  lockDiary,
  updateDiaryLockPreferences,
  verifyDiaryPassword,
  type DiaryAutoLock,
} from '@/services/diaryCrypto';

interface DiaryLockSettingsProps {
  open: boolean;
  onClose: () => void;
  onLocked: () => void;
}

const AUTO_LOCK_OPTIONS: Array<{ value: DiaryAutoLock; label: string }> = [
  { value: 'leave', label: '離開手記時' },
  { value: '5m', label: '5 分鐘' },
  { value: '15m', label: '15 分鐘' },
  { value: 'browser', label: '瀏覽器關閉' },
  { value: 'never', label: '從不上鎖' },
];

export function DiaryLockSettings({ open, onClose, onLocked }: DiaryLockSettingsProps) {
  const existing = getDiaryLockConfig();
  const moveAllPrivate = useAppStore((state) => state.moveAllPrivateJournalEntriesToNormal);
  const allEntries = useAppStore((state) => state.journalWorkspaceEntries || []);
  const privateEntries = useMemo(() => allEntries.filter((e) => (e.access ?? 'normal') === 'private'), [allEntries]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState(existing?.hint || '');
  const [autoLock, setAutoLock] = useState<DiaryAutoLock>(existing?.autoLock || 'browser');
  const [error, setError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (existing) {
      updateDiaryLockPreferences({ hint: hint.trim() || undefined, autoLock });
      onClose();
      return;
    }
    if (password.length < 4) { setError('密碼至少需要 4 位。'); return; }
    if (password !== confirmPassword) { setError('兩次密碼不一致。'); return; }
    const result = await createDiaryLock(password, hint, autoLock);
    setRecoveryKey(result.recoveryKey);
    setPassword('');
    setConfirmPassword('');
  };

  const handleDisable = async () => {
    if (!(await verifyDiaryPassword(password))) { setError('密碼不正確。'); return; }
    // If private records exist, offer to move them all back
    if (privateEntries.length > 0 && !showDisableConfirm) {
      setShowDisableConfirm(true);
      return;
    }
    // Move all private records to normal before disabling
    if (showDisableConfirm) {
      moveAllPrivate();
    }
    disableDiaryLock();
    onClose();
  };

  return createPortal(
    <div className="diary-lock-settings-overlay" onClick={onClose}>
      <section className="diary-lock-settings glass-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><strong>手記隱私鎖</strong><span>只保護月潮手記模組</span></div>
          <button type="button" onClick={onClose} aria-label="關閉">×</button>
        </header>
        <div className="diary-lock-settings-body">
          {recoveryKey ? (
            <div className="diary-recovery-key">
              <strong>請保存恢復密鑰</strong>
              <code>{recoveryKey}</code>
              <p>月潮不保存原始密鑰；遺失密碼與密鑰後只能清空本地手記。</p>
              <button type="button" onClick={onClose}>我已保存</button>
            </div>
          ) : (
            <>
              {!existing && (
                <>
                  <label>設定密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                  <label>再次輸入<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
                </>
              )}
              <label>密碼提示（可選）<input value={hint} onChange={(event) => setHint(event.target.value)} /></label>
              <label>自動鎖定
                <select value={autoLock} onChange={(event) => setAutoLock(event.target.value as DiaryAutoLock)}>
                  {AUTO_LOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {existing && <label>目前密碼（停用鎖定時需要）<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
              {error && <p className="diary-lock-error">{error}</p>}
              <p className="diary-lock-disclaimer">本地访问锁，不保存明文密码</p>
            </>
          )}
        </div>
        {!recoveryKey && (
          <footer style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
            {existing && !showDisableConfirm && <button type="button" className="danger" onClick={() => void handleDisable()}>停用鎖定</button>}
            {existing && showDisableConfirm && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 8px' }}>
                  有 {privateEntries.length} 筆私密記錄。<br />關閉後將全部移回普通手記。
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button" className="primary" style={{ padding: '8px 20px', fontSize: 13 }} onClick={() => void handleDisable()}>確認移回並關閉</button>
                  <button type="button" style={{ padding: '8px 20px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }} onClick={() => setShowDisableConfirm(false)}>取消</button>
                </div>
              </div>
            )}
            {existing && <button type="button" onClick={() => { lockDiary(); onLocked(); }}>立即鎖定</button>}
            {showDisableConfirm ? null : <button type="button" className="primary" onClick={() => void handleSave()}>{existing ? '保存設定' : '建立隱私鎖'}</button>}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
