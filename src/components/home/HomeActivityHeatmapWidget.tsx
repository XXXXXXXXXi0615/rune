import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { HomeWidgetSize } from '@/features/home/types';
import { getActivityHeatmapDateKeys, getActivityHeatmapLevel } from '@/utils/activityHeatmap';
import { toLocalDateString } from '@/utils/date';
import { HomeWidgetHeader } from './HomeWidgetHeader';
import { HomeWidgetIcon } from './HomeWidgetIcon';
import './HomeActivityHeatmapWidget.css';

function formatCellDate(dateKey: string) {
  const [, month, day] = dateKey.split('-').map(Number);
  return `${month} 月 ${day} 日`;
}

export function HomeActivityHeatmapWidget({ size }: { size: HomeWidgetSize }) {
  const activityLogs = useAppStore((state) => state.activityLogs || []);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const weeks = size === 'full' || size === 'wide' ? 16 : size === 'small' ? 6 : 8;

  const { cells, total, thisWeekCount, streak } = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateString(today);
    const counts = new Map<string, number>();

    activityLogs.forEach((log) => {
      const createdAt = new Date(log.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      const key = toLocalDateString(createdAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const dateKeys = getActivityHeatmapDateKeys(today, weeks);
    const nextCells = dateKeys.map((dateKey) => {
      const isFuture = dateKey > todayKey;
      const count = isFuture ? 0 : (counts.get(dateKey) || 0);
      return {
        dateKey,
        count,
        level: isFuture ? 0 : getActivityHeatmapLevel(count),
        isFuture,
        isToday: dateKey === todayKey,
      };
    });

    const currentWeek = nextCells.slice(-7).reduce((sum, cell) => sum + cell.count, 0);
    let consecutiveDays = 0;
    const todayIndex = nextCells.findIndex((cell) => cell.isToday);
    for (let index = todayIndex; index >= 0 && nextCells[index].count > 0; index -= 1) consecutiveDays += 1;

    return {
      cells: nextCells,
      total: nextCells.reduce((sum, cell) => sum + cell.count, 0),
      thisWeekCount: currentWeek,
      streak: consecutiveDays,
    };
  }, [activityLogs, weeks]);

  const selected = cells.find((cell) => cell.dateKey === selectedDateKey);

  return (
    <div
      className="hwg-widget home-activity-widget"
      data-home-widget-id="home-activity-heatmap"
      data-home-widget-state={total > 0 ? 'active' : 'empty'}
      data-home-widget-size={size}
      data-activity-weeks={weeks}
      data-pet-safe-region
    >
      <HomeWidgetHeader
        title={<span className="home-activity-widget__title"><HomeWidgetIcon name="activity" size="sm" decorative />活動記錄</span>}
        meta={`最近 ${weeks} 週`}
      />

      <div className="home-activity-widget__body">
        <div className="home-activity-widget__grid" role="grid" aria-label={`最近 ${weeks} 週活動熱力圖`}>
          {cells.map((cell) => (
            <button
              key={cell.dateKey}
              type="button"
              className={`home-activity-widget__cell level-${cell.level}${cell.isToday ? ' is-today' : ''}${cell.isFuture ? ' is-future' : ''}`}
              data-date={cell.dateKey}
              data-count={cell.count}
              data-level={cell.level}
              aria-label={`${formatCellDate(cell.dateKey)}，${cell.count} 次活動`}
              title={`${formatCellDate(cell.dateKey)}\n${cell.count} 次活動`}
              disabled={cell.isFuture}
              onClick={() => setSelectedDateKey((current) => current === cell.dateKey ? null : cell.dateKey)}
            />
          ))}
        </div>
        <aside className="home-activity-widget__summary" aria-label="活動摘要" data-pet-safe-region>
          <span><b>{thisWeekCount}</b>本週</span><span><b>{streak}</b>連續天數</span>
          <i className="home-activity-widget__legend" aria-label="少到多"><em/><em/><em/><em/></i>
        </aside>
      </div>

      <footer className="home-activity-widget__footer">
        <span>{total === 0 ? '暫無活動 · 從今天留下第一格' : `本週 ${thisWeekCount} 次 · 連續 ${streak} 天`}</span>
        {selected && !selected.isFuture && (
          <output className="home-activity-widget__selection" aria-live="polite">
            {formatCellDate(selected.dateKey)} · {selected.count} 次活動
          </output>
        )}
      </footer>
    </div>
  );
}
