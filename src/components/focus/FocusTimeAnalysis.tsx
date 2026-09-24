import type { TimeSlotStat } from '@/features/focus/getFocusStatistics';
import { TimeSlotIcon } from './FocusIcons';
import { formatMinutes } from '@/features/focus/getFocusStatistics';

interface Props {
  timeSlots: TimeSlotStat[];
  bestTimeSlot?: string;
  totalSessions: number;
}

export function FocusTimeAnalysis({ timeSlots, bestTimeSlot, totalSessions }: Props) {
  const insufficientData = totalSessions < 5;

  return (
    <div className="fsv-time-analysis">
      <div className="fsv-section-title">時段分析</div>
      <div className="fsv-time-grid">
        {timeSlots.map((slot) => {
          const isBest = slot.label === bestTimeSlot;
          return (
            <div
              key={slot.id}
              className={`fsv-time-slot${isBest ? ' is-best' : ''}`}
            >
              <div className="fsv-time-icon">
                <TimeSlotIcon id={slot.id} size={20} />
              </div>
              <div className="fsv-time-info">
                <div className="fsv-time-label">{slot.label}</div>
                <div className="fsv-time-mins">{formatMinutes(slot.minutes)}</div>
                <div className="fsv-time-count">{slot.sessionCount} 輪</div>
              </div>
            </div>
          );
        })}
      </div>
      {insufficientData ? (
        <div className="fsv-time-hint">繼續記錄後，這裡會形成你的專注節奏。</div>
      ) : bestTimeSlot ? (
        <div className="fsv-time-best">你的高效時段在{bestTimeSlot}。</div>
      ) : null}
    </div>
  );
}
