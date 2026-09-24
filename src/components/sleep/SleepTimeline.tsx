import { useMemo } from 'react';
import type { SleepRecord, SleepStageType } from '@/utils/sleepStorage';

interface SleepTimelineProps {
  record: SleepRecord;
}

const STAGE_COLORS: Record<SleepStageType, { bar: string; label: string }> = {
  awake: { bar: '#e8b4a0', label: '清醒' },
  rem: { bar: '#7fc1d9', label: 'REM' },
  core: { bar: '#5b8ec9', label: '核心' },
  deep: { bar: '#4a5d9e', label: '深睡' },
};

function formatHourLabel(minutesFromStart: number, startHour: number, startMinute: number): string {
  const totalMinutes = startHour * 60 + startMinute + minutesFromStart;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  if (m === 0) {
    if (h === 0) return '午夜';
    if (h < 6) return `${h}時`;
    return `${h}時`;
  }
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function SleepTimeline({ record }: SleepTimelineProps) {
  const totalMinutes = record.stages.reduce((s, seg) => s + seg.minutes, 0);

  const [startHour, startMinute] = record.sleepStart.split(':').map(Number);
  const [endHour, endMinute] = record.sleepEnd.split(':').map(Number);
  const endTotal = (endHour < startHour ? endHour + 24 : endHour) * 60 + endMinute;
  const startTotal = startHour * 60 + startMinute;
  const actualDuration = Math.max(totalMinutes, endTotal - startTotal);

  // Generate time axis labels (every hour)
  // Hook must be called unconditionally — guard inside the callback.
  const hourLabels = useMemo(() => {
    if (totalMinutes === 0) return [];
    const labels: { offset: number; text: string }[] = [];
    const start = startHour * 60 + startMinute;
    const endExact = start + actualDuration;
    const firstHour = Math.ceil(start / 60) * 60;
    for (let t = firstHour; t <= endExact; t += 60) {
      const hours = Math.floor(t / 60) % 24;
      const mins = t % 60;
      labels.push({
        offset: t - start,
        text: mins === 0 ? `${hours}:00` : `${hours}:${String(mins).padStart(2, '0')}`,
      });
    }
    return labels;
  }, [startHour, startMinute, actualDuration, totalMinutes]);

  if (totalMinutes === 0) return null;

  return (
    <div className="sleep-timeline-apple">
      {/* Time axis */}
      <div className="sleep-timeline-axis">
        <span className="sleep-timeline-axis-start">{record.sleepStart}</span>
        {hourLabels.map((l, i) => (
          <span
            key={i}
            className="sleep-timeline-axis-label"
            style={{ left: `${(l.offset / actualDuration) * 100}%` }}
          >
            {l.text}
          </span>
        ))}
        <span className="sleep-timeline-axis-end">{record.sleepEnd}</span>
      </div>

      {/* Stage bar */}
      <div className="sleep-timeline-bar">
        {record.stages.map((seg, i) => {
          const pct = (seg.minutes / totalMinutes) * 100;
          return (
            <div
              key={`${seg.type}-${i}`}
              className="sleep-timeline-segment"
              style={{
                width: `${pct}%`,
                backgroundColor: STAGE_COLORS[seg.type].bar,
                minWidth: pct > 0 ? '2px' : '0',
              }}
              title={`${STAGE_COLORS[seg.type].label} ${seg.minutes} 分鐘`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="sleep-timeline-legend">
        {(Object.entries(STAGE_COLORS) as [SleepStageType, { bar: string; label: string }][]).map(([type, meta]) => {
          const total = record.stages.filter(s => s.type === type).reduce((s, seg) => s + seg.minutes, 0);
          return (
            <div key={type} className="sleep-timeline-legend-item">
              <span className="sleep-timeline-legend-dot" style={{ backgroundColor: meta.bar }} />
              <span className="sleep-timeline-legend-label">{meta.label}</span>
              <span className="sleep-timeline-legend-value">{Math.round(total / totalMinutes * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
