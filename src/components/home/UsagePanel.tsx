import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

const DAILY_LIMIT = 100;

interface Props {
  onClick?: () => void;
}

export function UsagePanel({ onClick }: Props) {
  const usage = useAppStore((s) => s.usage);
  const daily = usage?.daily;
  const weekly = usage?.weekly;

  const today = new Date().toISOString().slice(0, 10);
  const currentPoints = daily?.date === today ? daily.points : 0;
  const weekKey = (() => {
    const n = new Date();
    const y = n.getFullYear();
    const j1 = new Date(y, 0, 1);
    const w = Math.ceil(((n.getTime() - j1.getTime()) / 86400000 + j1.getDay() + 1) / 7);
    return `${y}-W${String(w).padStart(2, '0')}`;
  })();
  const weeklyPoints = weekly?.weekKey === weekKey ? weekly.points : 0;

  const dailyPercent = Math.min(100, Math.round((currentPoints / DAILY_LIMIT) * 100));
  const weeklyPercent = Math.min(100, Math.round((weeklyPoints / (DAILY_LIMIT * 7)) * 100));

  // Progress bar color logic
  const barColor =
    dailyPercent >= 90 ? 'var(--danger)' :
    dailyPercent >= 60 ? 'var(--amber)' :
    'var(--accent)';

  return (
    <div className="usage-panel" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="usage-header">
        <span className="usage-title">{t('usage.title')}</span>
        <span className="usage-pct">{dailyPercent}%</span>
      </div>

      {/* Main progress bar */}
      <div className="usage-bar-track">
        <div
          className="usage-bar-fill"
          style={{ width: `${dailyPercent}%`, background: barColor }}
        />
      </div>

      <div className="usage-meta">
        <span className="usage-points">
          {t('usage.today')} {Math.round(currentPoints)} / {DAILY_LIMIT}
        </span>
        <span className="usage-reset">{t('usage.reset')} {t('usage.tomorrow')}</span>
      </div>

      {/* Description */}
      <div className="usage-desc">{t('usage.desc')}</div>

      {/* Weekly sub row */}
      <div className="usage-weekly">
        <span className="usage-weekly-label">
          {t('usage.weekly')} {Math.round(weeklyPoints)} / {DAILY_LIMIT * 7} · {weeklyPercent}%
        </span>
      </div>
    </div>
  );
}
