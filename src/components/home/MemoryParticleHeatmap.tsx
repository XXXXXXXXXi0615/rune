import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { MemoryEntry } from '@/types';
import './MemoryParticleHeatmap.css';

interface Props {
  onDayClick?: (dateKey: string) => void;
}

type TraceMood = 'calm' | 'happy' | 'excited' | 'tired' | 'sad';

interface TraceDay {
  dateKey: string;
  date: Date;
  dayOfMonth: number;
  mood: TraceMood | null;
  count: number;
  intensity: number;
  isFuture: boolean;
  isToday: boolean;
  isOutsideMonth: boolean;
}

interface TraceWeek {
  key: string;
  days: TraceDay[];
}

const WEEKS = 6;
const DAYS_PER_WEEK = 7;

const MOOD_PALETTE: Record<TraceMood, string> = {
  calm: '#7DB4FF',
  happy: '#FFD166',
  excited: '#FF8C42',
  tired: '#B388FF',
  sad: '#94A3B8',
};

const INTENSITY_STYLE: Record<number, { opacity: number; brightness: number }> = {
  1: { opacity: 0.42, brightness: 0.88 },
  2: { opacity: 0.58, brightness: 0.96 },
  3: { opacity: 0.78, brightness: 1.08 },
  4: { opacity: 1, brightness: 1.22 },
};

const MONTH_NAMES_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

function inferTraceMood(entry: MemoryEntry, healthMoodMap: Map<string, TraceMood>): TraceMood {
  if (entry.healthRecordId && healthMoodMap.has(entry.id)) {
    return healthMoodMap.get(entry.id)!;
  }

  const text = `${entry.scene || ''} ${entry.triggerText || ''} ${entry.bodyThoughts || ''}`.toLowerCase();
  if (/平靜|安心|穩定|放鬆|舒服|calm|peace|relax/.test(text)) return 'calm';
  if (/開心|愉快|快樂|喜歡|幸福|joy|happy/.test(text)) return 'happy';
  if (/興奮|激動|期待|雀躍|excited|wow/.test(text)) return 'excited';
  if (/疲憊|疲倦|累|困|想睡|tired|sleepy/.test(text)) return 'tired';
  if (/低落|難過|傷心|悲傷|哭|sad|cry/.test(text)) return 'sad';

  const anxiety = entry.anxietyLevel ?? 3;
  if (anxiety <= 2) return 'calm';
  if (anxiety <= 4) return 'happy';
  if (anxiety <= 6) return 'tired';
  return 'sad';
}

function intensityFor(entries: MemoryEntry[]): number {
  if (entries.length === 0) return 0;
  if (entries.length === 1) return 1;
  if (entries.length <= 3) return 2;
  if (entries.length <= 5) return 3;
  return 4;
}

export function MemoryParticleHeatmap({ onDayClick }: Props) {
  const language = useAppStore((s) => s.language);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const healthRecords = useAppStore((s) => s.healthRecords);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);

  const isZh = language === 'zh-TW';

  const healthMoodMap = useMemo(() => {
    const map = new Map<string, TraceMood>();
    for (const record of healthRecords) {
      if (record.type !== 'sleep') continue;
      const mood: TraceMood = record.quality === 'poor'
        ? 'sad'
        : record.quality === 'normal'
          ? 'tired'
          : 'happy';
      for (const entry of memoryEntries) {
        if (entry.healthRecordId === record.id) map.set(entry.id, mood);
      }
    }
    return map;
  }, [healthRecords, memoryEntries]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MemoryEntry[]>();
    for (const entry of memoryEntries) {
      const ts = typeof entry.createdAt === 'number'
        ? entry.createdAt
        : new Date(entry.createdAt).getTime();
      if (!Number.isFinite(ts)) continue;
      const key = dateKey(new Date(ts));
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [memoryEntries]);

  const graph = useMemo(() => {
    const firstDay = startOfWeek(new Date(viewYear, viewMonth, 1));

    const weeks: TraceWeek[] = Array.from({ length: WEEKS }, (_, weekIndex) => {
      const weekStart = addDays(firstDay, weekIndex * DAYS_PER_WEEK);
      const days = Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex): TraceDay => {
        const date = addDays(weekStart, dayIndex);
        const key = dateKey(date);
        const entries = entriesByDate.get(key) || [];
        const isFuture = date > today;
        const moodCounts = new Map<TraceMood, number>();

        for (const entry of entries) {
          const mood = inferTraceMood(entry, healthMoodMap);
          moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
        }

        const moodOrder: TraceMood[] = ['calm', 'happy', 'excited', 'tired', 'sad'];
        const mood = entries.length === 0 || isFuture
          ? null
          : moodOrder.reduce<TraceMood>((best, current) => {
            return (moodCounts.get(current) || 0) > (moodCounts.get(best) || 0) ? current : best;
          }, moodOrder[0]);

        return {
          dateKey: key,
          date,
          dayOfMonth: date.getDate(),
          mood,
          count: isFuture ? 0 : entries.length,
          intensity: isFuture ? 0 : intensityFor(entries),
          isFuture,
          isToday: key === dateKey(today),
          isOutsideMonth: date.getMonth() !== viewMonth,
        };
      });

      return {
        key: dateKey(weekStart),
        days,
      };
    });

    const days = weeks.flatMap((week) => week.days);

    return {
      weeks,
      days,
      hasVisibleData: days.some((day) => !day.isOutsideMonth && day.count > 0),
    };
  }, [entriesByDate, healthMoodMap, isZh, today, viewMonth, viewYear]);

  const goPrev = useCallback(() => {
    setViewMonth((month) => {
      if (month === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setViewMonth((month) => {
      if (viewYear === today.getFullYear() && month >= today.getMonth()) return month;
      if (month === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  }, [today, viewYear]);

  const canGoForward = viewYear < today.getFullYear()
    || (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const hoveredDay = useMemo(
    () => (hoveredDateKey
      ? graph.days.find((day) => day.dateKey === hoveredDateKey)
      : null),
    [graph.days, hoveredDateKey],
  );

  const moodLabel = useCallback((mood: TraceMood): string => {
    if (isZh) return { calm: '平靜', happy: '愉悅', excited: '興奮', tired: '疲憊', sad: '低落' }[mood];
    return { calm: 'Calm', happy: 'Happy', excited: 'Excited', tired: 'Tired', sad: 'Low' }[mood];
  }, [isZh]);

  const handleDayClick = useCallback((day: TraceDay) => {
    if (!onDayClick || day.count === 0 || day.isFuture) return;
    onDayClick(day.dateKey);
  }, [onDayClick]);

  return (
    <div className="moon-trace">
      <div className="moon-trace-nav">
        <button
          type="button"
          className="moon-trace-arrow"
          onClick={goPrev}
          aria-label={isZh ? '上個月' : 'Previous month'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <span className="moon-trace-month">
          {isZh ? MONTH_NAMES_ZH[viewMonth] : MONTH_NAMES_EN[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          className={`moon-trace-arrow${canGoForward ? '' : ' moon-trace-arrow--disabled'}`}
          onClick={() => canGoForward && goNext()}
          disabled={!canGoForward}
          aria-label={isZh ? '下個月' : 'Next month'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="moon-trace-graph" aria-label={isZh ? '記憶月曆' : 'Memory calendar'}>
        <div className="moon-trace-weekdays" aria-hidden="true">
          {(isZh ? WEEKDAY_NAMES_ZH : WEEKDAY_NAMES_EN).map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="moon-trace-field heatmap-grid">
          {graph.days.map((day) => {
            const style = INTENSITY_STYLE[day.intensity] || { opacity: 0.25, brightness: 1 };
            const color = day.mood ? MOOD_PALETTE[day.mood] : 'rgba(255, 255, 255, 0.08)';

            return (
              <button
                key={day.dateKey}
                type="button"
                className={`moon-dot heatmap-dot${day.count === 0 ? ' moon-dot--empty' : ''}${day.isFuture ? ' moon-dot--future' : ''}${day.isToday ? ' moon-dot--today' : ''}${day.isOutsideMonth ? ' moon-dot--outside' : ''}`}
                style={{
                  '--mt-color': color,
                  '--mt-opacity': style.opacity,
                  '--mt-brightness': style.brightness,
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredDateKey(day.dateKey)}
                onFocus={() => setHoveredDateKey(day.dateKey)}
                onMouseLeave={() => setHoveredDateKey(null)}
                onBlur={() => setHoveredDateKey(null)}
                onClick={() => handleDayClick(day)}
                aria-label={`${day.dateKey}${day.mood ? ` · ${moodLabel(day.mood)}` : ''}${day.count > 0 ? ` · ${day.count}條記錄` : ` · ${isZh ? '無資料' : 'No data'}`}`}
              >
                <span className="moon-dot__orb" />
                <span className="moon-dot__day-number">{day.dayOfMonth}</span>
                {day.isToday && <span className="moon-dot__today-ring" />}
              </button>
            );
          })}
        </div>

        {!graph.hasVisibleData && (
          <div className="moon-trace-empty">
            {isZh ? '尚無情緒資料' : 'No mood data yet'}
          </div>
        )}
      </div>

      {hoveredDay && (
        <div className="moon-tooltip">
          <div className="moon-tooltip-date">
            {hoveredDay.dateKey}
          </div>
          <div className="moon-tooltip-mood">
            <span
              className="moon-tooltip-swatch"
              style={{
                background: hoveredDay.mood
                  ? MOOD_PALETTE[hoveredDay.mood]
                  : 'rgba(255, 255, 255, 0.2)',
              }}
            />
            {hoveredDay.mood ? moodLabel(hoveredDay.mood) : (isZh ? '無資料' : 'No mood')}
          </div>
          <div className="moon-tooltip-count">
            {isZh
              ? `備註數量 ${hoveredDay.count}`
              : `${hoveredDay.count} note${hoveredDay.count !== 1 ? 's' : ''}`}
          </div>
        </div>
      )}

      <div className="moon-legend">
        {(Object.entries(MOOD_PALETTE) as [TraceMood, string][]).map(([mood, color]) => (
          <div key={mood} className="moon-legend-item">
            <span className="moon-legend-dot" style={{ background: color }} />
            <span className="moon-legend-label">{moodLabel(mood)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
