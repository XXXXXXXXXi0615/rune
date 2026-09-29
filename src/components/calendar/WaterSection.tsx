import { t } from '@/i18n';
import { getDailyTotal, useHydrationStore } from '@/store/useHydrationStore';
import { deriveWaterProgress } from '@/features/home/dailyRitualPresentation';

interface WaterSectionProps {
  selectedDate: string;
  todayStr: string;
}

export function WaterSection({ selectedDate }: WaterSectionProps) {
  const entries = useHydrationStore((s) => s.entries);
  const goal = useHydrationStore((s) => s.settings.dailyGoalMl);
  const addEntryForDate = useHydrationStore((s) => s.addEntryForDate);

  const currentMl = getDailyTotal(entries, selectedDate);
  const pct = deriveWaterProgress(currentMl, goal);

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
            <strong>{currentMl}</strong> / {goal} ml
          </span>
          <span>{pct}%</span>
        </div>
      </div>

      <div className="water-buttons">
        <button className="water-btn" onClick={() => addEntryForDate(150, selectedDate)}>
          +150
        </button>
        <button className="water-btn" onClick={() => addEntryForDate(250, selectedDate)}>
          +250
        </button>
        <button className="water-btn" onClick={() => addEntryForDate(500, selectedDate)}>
          +500
        </button>
      </div>
    </div>
  );
}
