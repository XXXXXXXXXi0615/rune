import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { TimelineEvent } from '@/types';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcon';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function renderEventSummary(ev: TimelineEvent): string {
  // detail already contains the richest text from creation time
  return ev.detail;
}

function timelineIcon(type: TimelineEvent['type']): AppIconName {
  if (type === 'chat') return 'chat';
  if (type === 'focus') return 'focus';
  if (type === 'journal' || type === 'forum_post' || type === 'forum_reply') return 'diary';
  if (type === 'diet' || type === 'diet_receipt') return 'food';
  if (type === 'sleep' || type === 'sleep_receipt') return 'sleep';
  if (type === 'todo') return 'todo';
  if (type === 'memory') return 'memory';
  if (type === 'water') return 'water';
  return 'timeline';
}

export function TimelineWidget() {
  const navigate = useNavigate();
  const events = useAppStore((s) => s.timelineEvents || []);

  const recent = useMemo(() => events.slice(0, 4), [events]);

  if (recent.length === 0) return null;

  return (
    <div
      className="home-dashboard-card timeline-widget-card"
      style={{ cursor: 'pointer' }}
      onClick={() => navigate('/timeline')}
    >
      <div className="dash-card-header">
        <span className="dash-card-title">時間軸</span>
        <span className="dash-card-action" onClick={(e) => { e.stopPropagation(); navigate('/timeline'); }}>
          查看全部
        </span>
      </div>
      <div className="tw-list">
        {recent.map((ev: TimelineEvent) => (
          <div
            key={ev.id}
            className="tw-item"
            onClick={(e) => {
              e.stopPropagation();
              if (ev.route) navigate(ev.route);
            }}
          >
            <span className="tw-icon"><AppIcon name={timelineIcon(ev.type)} size={16} /></span>
            <div className="tw-body">
              <span className="tw-detail">{renderEventSummary(ev)}</span>
              {ev.subDetail && <span className="tw-sub">{ev.subDetail}</span>}
            </div>
            <span className="tw-time">{formatRelative(ev.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
