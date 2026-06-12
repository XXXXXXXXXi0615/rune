import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

const DAILY_LIMIT = 100;

function reasonLabel(reason: string): string {
  const key = `usage.reason.${reason}`;
  const translated = t(key);
  return translated !== key ? translated : reason;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UsageDetailSheet({ isOpen, onClose }: Props) {
  const usage = useAppStore((s) => s.usage);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const today = new Date().toISOString().slice(0, 10);
  const daily = usage?.daily;
  const weekly = usage?.weekly;
  const logs = usage?.logs || [];

  const currentPoints = daily?.date === today ? daily.points : 0;
  const dailyPercent = Math.min(100, Math.round((currentPoints / DAILY_LIMIT) * 100));

  // Compute log total and detect legacy gap
  const todayLogs = logs.filter((l) => {
    const d = new Date(l.ts).toISOString().slice(0, 10);
    return d === today;
  });
  const logTotal = todayLogs.reduce((s, l) => s + l.points, 0);
  const legacyGap = Math.max(0, currentPoints - logTotal);

  const handleReset = () => {
    updateSettings({
      usage: {
        ...usage,
        daily: { date: today, points: 0 },
        logs: [...logs, { id: crypto.randomUUID(), ts: Date.now(), points: -currentPoints, reason: 'manual' }].slice(-100),
      },
    });
    setConfirmReset(false);
    onClose();
  };

  return (
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet" onClick={(e) => e.stopPropagation()} style={{ transform: 'translateY(0)' }}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{t('usage.detailTitle')}</span>
        </div>
        <div className="quick-sheet-body" style={{ gap: 10 }}>
          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 500 }}>{t('usage.today')}</span>
            <span style={{ fontFamily: 'var(--f-d)', fontSize: 22, fontWeight: 600 }}>
              {dailyPercent}%
            </span>
          </div>
          <div className="usage-bar-track">
            <div
              className="usage-bar-fill"
              style={{ width: `${dailyPercent}%` }}
            />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            {currentPoints.toFixed(1)} / {DAILY_LIMIT} {t('usage.points')}
          </div>

          {/* Weekly */}
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {t('usage.weekly')} {weekly?.points?.toFixed(1) || '0'} / {DAILY_LIMIT * 7} {t('usage.points')}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Logs */}
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
            {t('usage.today')} {t('usage.reset')} {t('usage.tomorrow')}
          </div>

          {/* Legacy gap */}
          {legacyGap > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, opacity: 0.6 }}>
              <span>{t('usage.reason.legacy')}</span>
              <span style={{ fontFamily: 'var(--f-d)' }}>+{legacyGap.toFixed(1)}</span>
            </div>
          )}

          {/* Today's logs */}
          {todayLogs.length === 0 && legacyGap === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 12 }}>
              {t('usage.empty')}
            </div>
          ) : (
            todayLogs.reverse().map((l) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>
                  {formatTime(l.ts)} · {reasonLabel(l.reason)}
                </span>
                <span style={{ fontFamily: 'var(--f-d)', color: l.points > 0 ? 'var(--text)' : 'var(--danger)' }}>
                  {l.points > 0 ? '+' : ''}{l.points.toFixed(1)}
                </span>
              </div>
            ))
          )}

          {/* Reset button */}
          <div style={{ paddingTop: 8 }}>
            {!confirmReset ? (
              <button
                type="button"
                className="settings-btn danger"
                onClick={() => setConfirmReset(true)}
                style={{ width: '100%', fontSize: 13 }}
              >
                {t('usage.resetToday')}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>
                  {t('usage.resetConfirm')}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)} style={{ flex: 1 }}>
                    {t('sheet.cancel')}
                  </button>
                  <button type="button" className="btn-primary" onClick={handleReset}
                    style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    {t('usage.resetToday')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t('sheet.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
