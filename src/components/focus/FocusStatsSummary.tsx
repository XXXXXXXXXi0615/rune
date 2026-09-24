import { formatMinutes, type FocusStatistics } from '@/features/focus/getFocusStatistics';

export function FocusStatsSummary({ stats }: { stats: FocusStatistics }) {
  return (
    <div className="fsv-summary">
      <div className="fsv-stat-card">
        <div className="fsv-stat-label">今日專注</div>
        <div className="fsv-stat-value">{formatMinutes(stats.todayMinutes)}</div>
      </div>
      <div className="fsv-stat-card">
        <div className="fsv-stat-label">本週累計</div>
        <div className="fsv-stat-value">{formatMinutes(stats.weekMinutes)}</div>
      </div>
      <div className="fsv-stat-card">
        <div className="fsv-stat-label">完成輪數</div>
        <div className="fsv-stat-value">{stats.monthCompletedSessions} 輪</div>
      </div>
      <div className="fsv-stat-card">
        <div className="fsv-stat-label">連續守約</div>
        <div className="fsv-stat-value">{stats.currentStreakDays} 天</div>
      </div>
    </div>
  );
}
