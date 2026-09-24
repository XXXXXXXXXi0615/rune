import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { TideClockIcon } from './TideClockIcon';
import { TideClockMachine } from './TideClockMachine';
import { toLocalDateString } from '@/utils/date';

export function TideClockStatusBar() {
  const [machineOpen, setMachineOpen] = useState(false);
  const navigate = useNavigate();
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const dismissedTodayDate = useCheckInStore((s) => s.dismissedTodayDate);

  const todayRecord = getTodayStatus();
  const streak = getCurrentPerfectStreak();
  const today = toLocalDateString();
  const isDone = !!todayRecord;

  if (isDone && dismissedTodayDate === today) return null;

  return (
    <>
      <section className="ah-layer tc-status-layer">
        <div className="tc-status-bar" data-status={isDone ? 'completed' : 'pending'}>
          <button
            type="button"
            className="tc-status-main"
            onClick={() => setMachineOpen(true)}
            aria-label={isDone ? '查看今日打卡' : '立即打卡'}
          >
            <span className="tc-status-icon">
              <TideClockIcon size={18} />
            </span>
            <div className="tc-status-info">
              <span className="tc-status-label">
                {isDone ? '今日已打卡' : '今日尚未打卡'}
              </span>
              <span className="tc-status-meta">
                {today}
                {streak > 0 && ` · 連續 ${streak} 天`}
                {isDone && todayRecord?.isLate && ' · 遲到'}
                {isDone && todayRecord?.moonDewAwarded > 0 && ` · +${todayRecord.moonDewAwarded} Dew`}
              </span>
            </div>
            <span className="tc-status-action">
              {isDone ? (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              )}
            </span>
          </button>
        </div>
      </section>
      <TideClockMachine open={machineOpen} onClose={() => setMachineOpen(false)} />
    </>
  );
}
