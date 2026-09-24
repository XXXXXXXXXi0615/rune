import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  getFocusStatistics,
  getFocusAchievements,
  getLunarisObservation,
  formatMinutes,
  type FocusStatistics,
} from '@/features/focus/getFocusStatistics';
import { FocusStatsSummary } from './FocusStatsSummary';
import { WeeklyFocusChart } from './WeeklyFocusChart';
import { FocusTimeAnalysis } from './FocusTimeAnalysis';
import { FocusAchievementGrid } from './FocusAchievementGrid';
import { FocusObservationCard } from './FocusObservationCard';

export function FocusStatisticsView() {
  const sessions = useAppStore((s) => s.focusSessionLog || []);
  const ledger = useAppStore((s) => s.moonDewLedger || []);
  const memories = useAppStore((s) => s.memoryEntries || []);

  const stats: FocusStatistics = useMemo(
    () => getFocusStatistics(sessions, ledger, memories),
    [sessions, ledger, memories],
  );

  const achievements = useMemo(
    () => getFocusAchievements(stats, sessions, ledger),
    [stats, sessions, ledger],
  );

  const observation = useMemo(
    () => getLunarisObservation(stats),
    [stats],
  );

  if (stats.totalSessions === 0) {
    return <EmptyState />;
  }

  return (
    <div className="fsv-root">
      <FocusStatsSummary stats={stats} />
      <WeeklyFocusChart days={stats.weeklyDays} />
      <FocusTimeAnalysis
        timeSlots={stats.timeSlots}
        bestTimeSlot={stats.bestTimeSlot}
        totalSessions={stats.totalSessions}
      />
      <FocusObservationCard text={observation} />
      <FocusAchievementGrid achievements={achievements} />
      <div className="fsv-footer">
        <div className="fsv-footer-row">
          <span>累計專注</span>
          <span>{formatMinutes(stats.totalMinutes)}</span>
        </div>
        <div className="fsv-footer-row">
          <span>總輪數</span>
          <span>{stats.totalSessions} 輪</span>
        </div>
        <div className="fsv-footer-row">
          <span>完成率</span>
          <span>{stats.completionRate}%</span>
        </div>
        <div className="fsv-footer-row">
          <span>最長連續</span>
          <span>{stats.longestStreakDays} 天</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="fsv-empty">
      <div className="fsv-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h3 className="fsv-empty-title">還沒有專注記錄</h3>
      <p className="fsv-empty-text">完成第一輪後，這裡會開始記錄你的節奏。</p>
      <button
        type="button"
        className="fsv-empty-btn"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('tidebound:open-room'));
        }}
      >
        開始第一輪
      </button>
    </div>
  );
}
