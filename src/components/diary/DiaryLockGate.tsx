import { useMemo, useState } from 'react';
import { LunarisJournalMark } from '@/components/branding/LunarisJournalMark';
import { getLunarisAnimationAsset } from '@/data/lunarisAnimationManifest';
import { useAppStore, selectAgentDisplayName } from '@/store/useAppStore';
import {
  disableDiaryLock,
  getDiaryLockConfig,
  markDiaryUnlocked,
  verifyDiaryPassword,
  verifyDiaryRecoveryKey,
} from '@/services/diaryCrypto';

interface DiaryLockGateProps {
  onUnlocked: () => void;
  onClearJournal: () => void;
}

type GuardState = 'idle' | 'input' | 'error' | 'warning' | 'happy';

const GUARD_ASSET: Record<GuardState, string> = {
  idle: 'clawd-sleeping',
  input: 'clawd-reading',
  error: 'clawd-error',
  warning: 'clawd-permission',
  happy: 'clawd-happy',
};

export function DiaryLockGate({ onUnlocked, onClearJournal }: DiaryLockGateProps) {
  const config = getDiaryLockConfig();
  const agentName = useAppStore((s) => selectAgentDisplayName(s.partner));
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [guardState, setGuardState] = useState<GuardState>('idle');
  const [failedCount, setFailedCount] = useState(0);
  const [message, setMessage] = useState('CLAWD 正在門口守著');
  const [clearStep, setClearStep] = useState(false);
  const [clearPhrase, setClearPhrase] = useState('');
  const guard = useMemo(() => getLunarisAnimationAsset(GUARD_ASSET[guardState]), [guardState]);

  const handleUnlock = async () => {
    const candidate = recoveryMode ? recoveryKey.trim() : password;
    if (!candidate) return;
    const valid = recoveryMode
      ? await verifyDiaryRecoveryKey(candidate)
      : await verifyDiaryPassword(candidate);
    if (!valid) {
      const nextCount = failedCount + 1;
      setFailedCount(nextCount);
      setGuardState(nextCount >= 3 ? 'warning' : 'error');
      setMessage(nextCount >= 3 ? `${agentName} 還在等你確認。` : `${agentName} 搖了搖頭。`);
      return;
    }
    markDiaryUnlocked();
    setGuardState('happy');
    setMessage('門開了。歡迎回來。');
    window.setTimeout(onUnlocked, 420);
  };

  const handleClear = () => {
    if (clearPhrase !== '清空手記') return;
    onClearJournal();
    disableDiaryLock();
    onUnlocked();
  };

  return (
    <section className="diary-lock-page">
      <div className="diary-lock-card glass-modal">
        <LunarisJournalMark size={54} />
        <h1>月潮手記已上鎖</h1>
        <p>這裡保存你和 {agentName} 的潮痕</p>

        <button
          type="button"
          className="diary-lock-guard"
          onClick={() => setMessage(guard?.label ? `${agentName} · ${guard.label}` : `${agentName} 還守在這裡。`)}
          aria-label={guard?.label || `${agentName} 門衛`}
        >
          {guard && <img src={guard.src} alt="" decoding="async" />}
        </button>
        <span className="diary-lock-guard-message">{message}</span>

        {recoveryMode ? (
          <input
            value={recoveryKey}
            onChange={(event) => { setRecoveryKey(event.target.value); setGuardState('input'); }}
            placeholder="輸入恢復密鑰"
            autoComplete="off"
          />
        ) : (
          <input
            type="password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); setGuardState('input'); }}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleUnlock(); }}
            placeholder="手記密碼"
            autoComplete="current-password"
          />
        )}
        {config?.hint && !recoveryMode && <small className="diary-lock-hint">提示：{config.hint}</small>}
        <button type="button" className="diary-lock-primary" onClick={() => void handleUnlock()}>
          {recoveryMode ? '使用恢復密鑰' : '解鎖手記'}
        </button>
        <button type="button" className="diary-lock-link" onClick={() => setRecoveryMode((value) => !value)}>
          {recoveryMode ? '返回密碼解鎖' : '忘記密碼？使用恢復密鑰'}
        </button>

        {!clearStep ? (
          <button type="button" className="diary-lock-danger-link" onClick={() => setClearStep(true)}>
            清空本地手記並重新設定
          </button>
        ) : (
          <div className="diary-lock-clear-confirm">
            <strong>此操作會清空手記與長期記憶，無法復原。</strong>
            <input value={clearPhrase} onChange={(event) => setClearPhrase(event.target.value)} placeholder="輸入「清空手記」" />
            <button type="button" disabled={clearPhrase !== '清空手記'} onClick={handleClear}>確認清空</button>
            <button type="button" onClick={() => { setClearStep(false); setClearPhrase(''); }}>取消</button>
          </div>
        )}
        <p className="diary-lock-disclaimer">本地隱私鎖，不等同於雲端帳戶安全。</p>
      </div>
    </section>
  );
}
