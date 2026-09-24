import { useState } from 'react';
import type { WeeklyDay } from '@/features/focus/getFocusStatistics';
import { toLocalDateString } from '@/utils/date';

interface Props {
  days: WeeklyDay[];
}

export function WeeklyFocusChart({ days }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const todayStr = toLocalDateString(new Date());
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);

  return (
    <div className="fsv-chart">
      <div className="fsv-chart-title">本週專注</div>
      <div className="fsv-chart-bars">
        {days.map((day, i) => {
          const pct = day.minutes > 0 ? (day.minutes / maxMinutes) * 100 : 0;
          const isToday = day.date === todayStr;
          const isHovered = hoveredIdx === i;
          const isEmpty = day.minutes === 0;

          return (
            <div
              key={day.date}
              className={`fsv-bar-col${isToday ? ' is-today' : ''}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(i)}
              onTouchEnd={() => setHoveredIdx(null)}
            >
              {isHovered && !isEmpty && (
                <div className="fsv-bar-tooltip">
                  <div className="fsv-tooltip-date">{day.date}</div>
                  <div className="fsv-tooltip-mins">{day.minutes} 分鐘</div>
                  <div className="fsv-tooltip-sessions">{day.completedSessions} 輪完成</div>
                </div>
              )}
              <div className="fsv-bar-track">
                <div
                  className="fsv-bar-fill"
                  style={{ height: `${Math.max(pct, isEmpty ? 0 : 4)}%` }}
                />
              </div>
              <div className="fsv-bar-label">{day.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
