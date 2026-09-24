import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import { getActivityHeatmapRange } from '@/utils/activityHeatmap';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import type { CheckInStatus } from '@/features/tideclock/types';

export interface ActivityHeatmapDay {
  date: Date;
  dateKey: string;
  diaryCount: number;
  musicPlays: number;
  readingCount: number;
  checkInStatus: CheckInStatus | null;
  isFuture: boolean;
  isToday: boolean;
}

function getHeatmapLevel(score: number): number {
  if (score === 0) return 0;
  if (score === 1) return 1;
  if (score <= 3) return 2;
  if (score <= 6) return 3;
  return 4;
}

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatHeatmapDate(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

const WEEKS_TO_SHOW = 8;

function DayDetailSheet({ day, onClose }: { day: ActivityHeatmapDay; onClose: () => void }) {
  const total = day.diaryCount + day.musicPlays + day.readingCount;
  return createPortal(
    <>
      <div className="ah-day-overlay" onClick={onClose} />
      <div className="ah-day-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ah-day-sheet-handle" />
        <div className="ah-day-sheet-head">
          <span className="ah-day-sheet-date">{formatHeatmapDate(day.date)}</span>
          <button type="button" className="ah-day-sheet-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="ah-day-sheet-rows">
          <div className="ah-day-row">
            <span className="ah-day-emoji">🎵</span><span>音樂</span><b>{day.musicPlays}</b>
          </div>
          <div className="ah-day-row">
            <span className="ah-day-emoji">📖</span><span>閱讀</span><b>{day.readingCount}</b>
          </div>
          <div className="ah-day-row">
            <span className="ah-day-emoji">📝</span><span>日記</span><b>{day.diaryCount}</b>
          </div>
          <div className="ah-day-row ah-day-total">
            <span className="ah-day-emoji">🔥</span><span>活躍度</span><b>{total}</b>
          </div>
          {total === 0 && (
            <p className="ah-day-empty">這一天很安靜，沒有留下活動。</p>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ActivityHeatmap({ fullWidth }: { fullWidth?: boolean }) {
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const diaryEntries = useAppStore((s) => s.diaryEntries || []);
  const activityLogs = useAppStore((s) => s.activityLogs || []);
  const checkInRecords = useCheckInStore((s) => s.records);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showFullYear, setShowFullYear] = useState(false);

  const { days } = useMemo(() => {
    const { startDate, endDate, today } = getActivityHeatmapRange(new Date(), WEEKS_TO_SHOW);
    const todayKey = toLocalDateString(today);

    const diaryCounts = new Map<string, number>();
    diaryEntries.forEach((d) => {
      diaryCounts.set(d.date, (diaryCounts.get(d.date) || 0) + 1);
    });

    const readingCounts = new Map<string, number>();
    memoryEntries.forEach((m) => {
      if (m.category !== 'reading') return;
      const key = toLocalDateString(new Date(m.createdAt));
      readingCounts.set(key, (readingCounts.get(key) || 0) + 1);
    });

    const musicCounts = new Map<string, number>();
    activityLogs.forEach((l) => {
      if (l.type !== 'music') return;
      const key = toLocalDateString(new Date(l.createdAt));
      musicCounts.set(key, (musicCounts.get(key) || 0) + 1);
    });

    const checkInMap = new Map<string, CheckInStatus>();
    checkInRecords.forEach((r) => {
      if (r.kind === 'clock_in') checkInMap.set(r.date, r.status);
    });

    const heatmapDays: ActivityHeatmapDay[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = toLocalDateString(current);
      const isFuture = current > today;
      heatmapDays.push({
        date: new Date(current),
        dateKey,
        diaryCount: isFuture ? 0 : (diaryCounts.get(dateKey) || 0),
        musicPlays: isFuture ? 0 : (musicCounts.get(dateKey) || 0),
        readingCount: isFuture ? 0 : (readingCounts.get(dateKey) || 0),
        checkInStatus: isFuture ? null : (checkInMap.get(dateKey) || null),
        isFuture,
        isToday: dateKey === todayKey,
      });
      current.setDate(current.getDate() + 1);
    }

    return { days: heatmapDays };
  }, [memoryEntries, diaryEntries, activityLogs, checkInRecords]);

  const selected = selectedDateKey ? days.find((d) => d.dateKey === selectedDateKey) : null;

  function handleCellClick(dateKey: string) {
    setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey));
  }

  function dayTotal(day: ActivityHeatmapDay): number {
    return day.diaryCount + day.musicPlays + day.readingCount;
  }

  function getCellClass(day: ActivityHeatmapDay): string {
    const total = dayTotal(day);
    const level = day.isFuture ? -1 : getHeatmapLevel(total);
    const isSelected = selectedDateKey === day.dateKey;

    return `activity-heatmap-cell level-${level} ${day.isFuture ? 'is-future' : ''} ${isSelected ? 'is-selected' : ''} ${day.isToday ? 'is-today' : ''}`;
  }

  function makeTooltip(day: ActivityHeatmapDay): string {
    const total = dayTotal(day);
    if (total === 0) return `${day.dateKey} · 無活動`;
    const parts: string[] = [];
    if (day.musicPlays > 0) parts.push(`🎵${day.musicPlays}`);
    if (day.readingCount > 0) parts.push(`📖${day.readingCount}`);
    if (day.diaryCount > 0) parts.push(`📝${day.diaryCount}`);
    return `${day.dateKey} · ${parts.join(' ')}`;
  }

  const content = (
    <>
      <div className="dash-card-header">
        <div className="heatmap-header-left">
          <span className="dash-card-title">活動熱力圖</span>
          <span className="dash-card-subtitle">最近 8 週</span>
        </div>
        <div className="activity-heatmap-toolbar">
          <div className="activity-range-control">
            <button type="button" className="heatmap-year-link" onClick={() => setShowFullYear(true)}>全年 →</button>
          </div>
          <div className="heatmap-legend-inline activity-intensity-legend" aria-hidden="true">
            <span className="legend-label">少</span>
            <div className="legend-dots">
              {[0, 1, 2, 3, 4].map((level) => (
                <div key={level} className={`legend-dot level-${level}`} />
              ))}
            </div>
            <span className="legend-label">多</span>
          </div>
        </div>
      </div>

      <div className="activity-heatmap-layout">
        <div className="activity-heatmap-left">
          <div className="heatmap-scroll-wrap">
            <div className="heatmap-dow-column">
              {DAY_LABELS.map((label) => (
                <span key={label} className="activity-heatmap-day-label">{label}</span>
              ))}
            </div>
            <div className="activity-heatmap-grid heatmap-grid-horizontal">
              {days.map((day) => {
                const total = dayTotal(day);
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={getCellClass(day)}
                    aria-label={`${day.dateKey}，${total} 項活動`}
                    title={makeTooltip(day)}
                    disabled={day.isFuture}
                    onClick={() => handleCellClick(day.dateKey)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const yearDays = useMemo(() => {
    const { startDate, endDate, today } = getActivityHeatmapRange(new Date(), 53);
    const todayKey = toLocalDateString(today);
    const diaryCounts = new Map<string, number>();
    (diaryEntries as any[]).forEach((d: any) => { diaryCounts.set(d.date, (diaryCounts.get(d.date) || 0) + 1); });
    const readingCounts = new Map<string, number>();
    (memoryEntries as any[]).forEach((m: any) => { if (m.category !== 'reading') return; readingCounts.set(toLocalDateString(new Date(m.createdAt)), (readingCounts.get(toLocalDateString(new Date(m.createdAt))) || 0) + 1); });
    const musicCounts = new Map<string, number>();
    (activityLogs as any[]).forEach((l: any) => { if (l.type !== 'music') return; musicCounts.set(toLocalDateString(new Date(l.createdAt)), (musicCounts.get(toLocalDateString(new Date(l.createdAt))) || 0) + 1); });
    const checkInMap = new Map<string, CheckInStatus>();
    checkInRecords.forEach((r) => { if (r.kind === 'clock_in') checkInMap.set(r.date, r.status); });

    const list: ActivityHeatmapDay[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = toLocalDateString(current);
      const isFuture = current > today;
      list.push({
        date: new Date(current), dateKey,
        diaryCount: isFuture ? 0 : (diaryCounts.get(dateKey) || 0),
        musicPlays: isFuture ? 0 : (musicCounts.get(dateKey) || 0),
        readingCount: isFuture ? 0 : (readingCounts.get(dateKey) || 0),
        checkInStatus: isFuture ? null : (checkInMap.get(dateKey) || null),
        isFuture: isFuture, isToday: dateKey === todayKey,
      });
      current.setDate(current.getDate() + 1);
    }
    return list;
  }, [memoryEntries, diaryEntries, activityLogs, checkInRecords]);

  const yearDrawer = showFullYear && createPortal(
    <div className="quick-sheet-overlay active" onClick={() => setShowFullYear(false)} style={{ zIndex: 2100 }}>
      <div className="quick-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 'min(82dvh, 520px)', padding: '12px 16px 16px' }}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head" style={{ marginBottom: 8 }}>
          <span className="quick-sheet-title">全年活動熱力圖</span>
          <button type="button" className="quick-sheet-close" onClick={() => setShowFullYear(false)} aria-label="關閉">
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="quick-sheet-body" style={{ overflow: 'hidden' }}>
          <div className="heatmap-scroll-wrap" style={{ maxHeight: 'min(70dvh, 440px)', overflowY: 'auto' }}>
            <div className="heatmap-dow-column">
              {DAY_LABELS.map((label) => (<span key={label} className="activity-heatmap-day-label">{label}</span>))}
            </div>
            <div className="activity-heatmap-grid heatmap-grid-horizontal">
              {yearDays.map((day) => {
                const total = dayTotal(day);
                const level = day.isFuture ? -1 : getHeatmapLevel(total);
                return (
                  <button key={day.dateKey} type="button"
                    className={`activity-heatmap-cell level-${level} ${day.isFuture ? 'is-future' : ''} ${day.isToday ? 'is-today' : ''}`}
                    aria-label={`${day.dateKey}，${total} 項活動`}
                    disabled={day.isFuture}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );

  const daySheet = selected && (
    <DayDetailSheet day={selected} onClose={() => setSelectedDateKey(null)} />
  );

  if (fullWidth) {
    return <><section className="home-heatmap-section">{content}</section>{yearDrawer}{daySheet}</>;
  }
  return <><div className="home-dashboard-card home-activity-heatmap-card">{content}</div>{yearDrawer}{daySheet}</>;
}
