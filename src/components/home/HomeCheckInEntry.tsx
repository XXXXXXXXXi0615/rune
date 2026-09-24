import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { toLocalDateString } from '@/utils/date';
import './HomeCheckInEntry.css';

export function HomeCheckInEntry({ onOpen }: { onOpen: () => void }) {
  const records = useCheckInStore((state) => state.records);
  const getCurrentPerfectStreak = useCheckInStore((state) => state.getCurrentPerfectStreak);
  const today = toLocalDateString();
  const checkedIn = records.some((record) => record.kind === 'clock_in' && record.date === today);
  const streak = getCurrentPerfectStreak();

  return <button
    type="button"
    className="home-checkin-entry"
    data-testid="home-checkin-entry"
    data-state={checkedIn ? 'completed' : 'pending'}
    data-pet-safe-region="interactive"
    onClick={onOpen}
    aria-label={checkedIn ? `今日已簽到，連續 ${streak} 天，開啟打卡詳情` : '今日打卡尚未完成，開啟打卡'}
  >
    <span className="home-checkin-entry__icon" aria-hidden="true">{checkedIn ? '✓' : '☾'}</span>
    <span className="home-checkin-entry__copy">
      <strong>{checkedIn ? '今日已簽到' : '今日打卡'}</strong>
      <small>{checkedIn ? `連續 ${streak} 天` : '尚未完成'}</small>
    </span>
    <span className="home-checkin-entry__end" aria-hidden="true">{checkedIn ? '✓' : '›'}</span>
  </button>;
}
