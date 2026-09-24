import { useMemo } from 'react';
import type { HomeWidgetSize } from '@/features/home/types';
import { getDailyEntries, getDailyTotal, useHydrationStore } from '@/store/useHydrationStore';
import { useTideRailStore } from '@/store/useTideRailStore';
import { toLocalDateString } from '@/utils/date';
import { HomeWidgetIcon } from './HomeWidgetIcon';
import './HomeHydrationWidget.css';

const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 今日飲水 home widget — small: total/goal + +250; wide: + stats, wave, quick adds. */
export function HomeHydrationWidget({ size }: { size: HomeWidgetSize }) {
  const entries = useHydrationStore((s) => s.entries);
  const settings = useHydrationStore((s) => s.settings);
  const addEntry = useHydrationStore((s) => s.addEntry);
  const openWindow = useTideRailStore((s) => s.openWindow);

  const dateKey = toLocalDateString();
  const total = useMemo(() => getDailyTotal(entries, dateKey), [entries, dateKey]);
  const todayEntries = useMemo(() => getDailyEntries(entries, dateKey), [entries, dateKey]);
  const goal = settings.dailyGoalMl;
  const remaining = Math.max(0, goal - total);
  const pct = Math.min(100, Math.round((total / Math.max(1, goal)) * 100));
  const lastEntry = todayEntries[todayEntries.length - 1];
  const iconSize = size === 'small' ? 'sm' : 'md';
  const quickAmounts = settings.quickAmounts.length ? settings.quickAmounts : [100, 250, 500];

  const openPanel = () => openWindow('hydration');

  if (size === 'small') {
    return (
      <div
        className="hwg-widget hwg-widget--hydration hyd-widget hyd-widget--small"
        data-home-widget-id="home-hydration"
        data-home-widget-state={total > 0 ? 'active' : 'empty'}
        data-home-widget-size="small"
        data-testid="home-hydration-widget"
        role="button"
        tabIndex={0}
        onClick={openPanel}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); } }}
      >
        <span className="hyd-widget__icon" style={{ '--hwg-icon-color': 'var(--hyd-accent)', '--hwg-icon-tint': 'var(--hyd-tint)', '--hwg-icon-border': 'var(--hyd-border)' } as React.CSSProperties}>
          <HomeWidgetIcon name="hydration" size="sm" decorative label="今日飲水" />
        </span>
        <span className="hyd-widget__title" data-testid="hyd-widget-title">今日飲水</span>
        <div className="hyd-widget__total" data-testid="hyd-widget-total">
          <strong>{total}</strong><span>/ {goal} ml</span>
        </div>
        <div className="hyd-widget__bar" data-testid="hyd-widget-pct">
          <i style={{ width: `${pct}%` }} />
        </div>
        <button
          type="button"
          className="hyd-widget__quick"
          data-no-widget-drag
          data-amount={250}
          data-testid="hyd-widget-quick-250"
          data-pet-safe-region="interactive"
          onPointerDown={stop}
          onClick={(e) => { stop(e); addEntry(250, 'quick_add'); }}
        >
          +250 ml
        </button>
      </div>
    );
  }

  return (
    <div
        className="hwg-widget hwg-widget--hydration hyd-widget hyd-widget--wide"
        data-home-widget-id="home-hydration"
        data-home-widget-state={total > 0 ? 'active' : 'empty'}
        data-home-widget-size="wide"
        data-testid="home-hydration-widget"
      role="button"
      tabIndex={0}
      onClick={openPanel}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); } }}
    >
      <span className="hyd-widget__icon" style={{ '--hwg-icon-color': 'var(--hyd-accent)', '--hwg-icon-tint': 'var(--hyd-tint)', '--hwg-icon-border': 'var(--hyd-border)' } as React.CSSProperties}>
        <HomeWidgetIcon name="hydration" size={iconSize} decorative label="今日飲水" />
      </span>
      <div className="hyd-widget__main">
        <div className="hyd-widget__title">今日飲水</div>
        <div className="hyd-widget__total" data-testid="hyd-widget-total">
          <strong>{total}</strong><span>/ {goal} ml</span>
        </div>
        <div className={`hyd-widget__wave${pct >= 100 ? ' hyd-widget__wave--done' : ''}`} data-testid="hyd-widget-wave">
          <i style={{ height: `${pct}%` }} />
        </div>
        <div className="hyd-widget__meta" data-testid="hyd-widget-remaining">
          {remaining > 0 ? `還差 ${remaining} ml` : '已達今日目標'}
          {lastEntry && ` · 最近 ${formatTime(lastEntry.recordedAt)}`}
        </div>
        {total === 0 && (
          <div className="hyd-widget__hint" data-testid="hyd-widget-empty-hint">今天的第一口水還沒記下</div>
        )}
      </div>
      <div className="hyd-widget__actions" data-pet-safe-region="interactive">
        {quickAmounts.slice(0, 3).map((amount) => (
          <button
            key={amount}
            type="button"
            className="hyd-widget__quick"
            data-no-widget-drag
            data-amount={amount}
            data-testid={`hyd-widget-quick-${amount}`}
            onPointerDown={stop}
            onClick={(e) => { stop(e); addEntry(amount, 'quick_add'); }}
          >
            +{amount}<small>ml</small>
          </button>
        ))}
      </div>
    </div>
  );
}
