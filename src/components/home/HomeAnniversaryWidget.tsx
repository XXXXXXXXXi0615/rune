import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCountdownStore } from '@/features/countdown/useCountdownStore';
import { parseValidLocalDate, daysBetween } from '@/utils/safeDate';
import type { HomeWidgetSize } from '@/features/home/types';
import { HomeWidgetEmptyState } from './HomeWidgetEmptyState';
import { HomeWidgetIcon } from './HomeWidgetIcon';
import { HomeWidgetMetric } from './HomeWidgetMetric';

export function HomeAnniversaryWidget({ size }: { size: HomeWidgetSize }) {
  const navigate = useNavigate();
  const events = useCountdownStore((s) => s.events);
  const safeEvents = events ?? [];

  const next = useMemo(() => {
    const now = new Date();
    let bestDate: Date | null = null;
    let bestEvent = null;

    for (const e of safeEvents) {
      const d = parseValidLocalDate(e.targetAt);
      if (!d) continue;
      const diff = daysBetween(d, now);
      if (diff === null) continue;
      if (diff >= 0) {
        // future (including today): pick soonest
        if (!bestDate || d.getTime() < bestDate.getTime()) {
          bestDate = d;
          bestEvent = e;
        }
      }
    }
    if (!bestEvent) {
      // No future event — pick soonest overall
      for (const e of safeEvents) {
        const d = parseValidLocalDate(e.targetAt);
        if (!d) continue;
        if (!bestDate || d.getTime() < bestDate.getTime()) {
          bestDate = d;
          bestEvent = e;
        }
      }
    }
    if (!bestEvent || !bestDate) return null;
    return { event: bestEvent, date: bestDate };
  }, [safeEvents]);

  const days = next ? daysBetween(next.date, new Date()) : null;
  const displayDays = days !== null ? Math.abs(days) : null;

  if (!next || displayDays === null) {
    return (
      <div className="hwg-widget hwg-widget--anniversary" data-home-widget-id="home-anniversary"
        data-home-widget-state="empty"
        data-home-widget-size={size}
        onClick={() => navigate('/calendar?tab=countdowns')} style={{ cursor: 'pointer' }}>
        <HomeWidgetEmptyState
          icon={<HomeWidgetIcon name="anniversary" size={size === 'small' ? 'sm' : 'md'} decorative />}
          title="尚未設定紀念日"
          description="添加重要的日子，讓月潮幫你倒數"
          actionLabel="新增日期"
          onAction={() => navigate('/calendar?tab=countdowns')}
          compact={size === 'small'}
        />
      </div>
    );
  }

  return (
    <button type="button" className={`hwg-widget hwg-widget--anniversary anniversary-story-card is-${size}`} data-home-widget-id="home-anniversary"
      data-home-widget-state="active"
      data-home-widget-size={size}
      onClick={() => navigate('/calendar?tab=countdowns')}
      >
      <div className="anniversary-story-card__content">
        <HomeWidgetMetric
          value={displayDays}
          unit="天"
          accent
          className="hw-widget-metric--anniversary-days"
        />
        <div className="anniversary-story-card__label">
          <HomeWidgetIcon name="anniversary" size={size === 'small' ? 'sm' : 'md'} decorative
            label={next.event.title} />
          <span className="hw-secondary">
            {next.event.title}
          </span>
        </div>
      </div>
    </button>
  );
}
