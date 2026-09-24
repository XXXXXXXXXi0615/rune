import { useAppStore } from '@/store/useAppStore';

export function PomodoroCard() {
  const focusMinutes = useAppStore((s) => s.focusMinutes);
  const focusSessions = useAppStore((s) => s.focusSessions);

  return (
    <div
      className="summary-cell summary-cell-small home-dashboard-pomo"
      style={{ cursor: 'default' }}
    >
      <div className="desktop-card-title">TIDEBOUND</div>
      <div className="summary-cell-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, stroke: 'var(--text-2)', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="summary-cell-label">TIDEBOUND</div>
      <div className="summary-cell-value" style={{ fontSize: 14, color: 'var(--text-3)' }}>
        {focusMinutes > 0
          ? `${focusMinutes} 分鐘 · ${focusSessions} 輪`
          : '25 分鐘專注 / 5 分鐘休息'}
      </div>
      <span style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
        {focusMinutes > 0 ? '已完成' : '從 TIDEBOUND 或 Header 開始專注'}
      </span>
    </div>
  );
}
