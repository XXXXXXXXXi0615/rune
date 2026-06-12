import type { WaterData } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

interface WaterSectionProps {
  water: WaterData;
  selectedDate: string;
  todayStr: string;
}

export function WaterSection({ water, selectedDate, todayStr }: WaterSectionProps) {
  const addWater = useAppStore((s) => s.addWater);

  const isToday = selectedDate === todayStr;
  // Read from dailyLogs for per-date, fallback to todayMl for today
  const currentMl = water.dailyLogs?.[selectedDate] ?? (isToday ? water.todayMl : 0);
  const pct = water.goalMl > 0 ? Math.min(100, Math.round((currentMl / water.goalMl) * 100)) : 0;

  return (
    <div>
      <div className="calendar-section-header">
        <span className="calendar-section-title">{t('calendar.waterSection')}</span>
      </div>

      <div className="water-progress">
        <div className="water-bar-outer">
          <div className="water-bar-inner" style={{ width: `${pct}%` }} />
        </div>
        <div className="water-stats">
          <span>
            <strong>{currentMl}</strong> / {water.goalMl} ml
          </span>
          <span>{pct}%</span>
        </div>
      </div>

      <div className="water-buttons">
        <button className="water-btn" onClick={() => addWater(150, selectedDate)}>
          +150
        </button>
        <button className="water-btn" onClick={() => addWater(250, selectedDate)}>
          +250
        </button>
        <button className="water-btn" onClick={() => addWater(500, selectedDate)}>
          +500
        </button>
      </div>
    </div>
  );
}
