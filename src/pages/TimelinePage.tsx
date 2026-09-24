import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BackButton } from '@/components/layout/BackButton';
import { useAppStore } from '@/store/useAppStore';
import type { TimelineEvent } from '@/types';
import './TimelinePage.css';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateKey = d.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dateKey === todayKey) return '今天';
  if (dateKey === yesterdayKey) return '昨天';

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = weekdays[d.getDay()];
  return `${m}/${day} 週${wd}`;
}

export function TimelinePage() {
  const navigate = useNavigate();
  const events = useAppStore((s) => s.timelineEvents || []);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    // Sort dates descending
    const sortedDates = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => ({
      date,
      label: formatDateLabel(date),
      events: map.get(date)!.sort((a, b) => b.createdAt - a.createdAt),
    }));
  }, [events]);

  const handleEventClick = (ev: TimelineEvent) => {
    if (ev.route) navigate(ev.route);
  };

  return (
    <section className="view timeline-view">
      <BackButton to="/" />
      <Header eyebrow="" title="時間軸" />

      <div className="timeline-container">
        {grouped.length === 0 && (
          <div className="timeline-empty">
            <span className="timeline-empty-icon">🕐</span>
            <p>尚無時間軸事件</p>
            <p className="timeline-empty-sub">當你記錄記憶、完成待辦、生成收據時，事件會自動出現在這裡。</p>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.date} className="tl-day-group">
            <div className="tl-day-head">
              <span className="tl-day-dot" />
              <span className="tl-day-label">{group.label}</span>
              <span className="tl-day-count">{group.events.length}</span>
            </div>
            <div className="tl-day-items">
              {group.events.map((ev) => (
                <div
                  key={ev.id}
                  className={`tl-event tl-event--${ev.type}${ev.route ? ' tl-event--clickable' : ''}`}
                  onClick={() => handleEventClick(ev)}
                  role={ev.route ? 'button' : undefined}
                  tabIndex={ev.route ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (ev.route && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleEventClick(ev);
                    }
                  }}
                >
                  <span className="tl-event-icon" style={{ color: ev.color }}>
                    {ev.icon}
                  </span>
                  <div className="tl-event-body">
                    <div className="tl-event-top">
                      <span className="tl-event-label">{ev.label}</span>
                      <span className="tl-event-time">{formatTime(ev.createdAt)}</span>
                    </div>
                    <span className="tl-event-detail">{ev.detail}</span>
                    {ev.subDetail && (
                      <span className="tl-event-sub">{ev.subDetail}</span>
                    )}
                  </div>
                  <div className="tl-event-meta">
                    {ev.type === 'sleep_receipt' && (
                      <span className="tl-badge tl-badge--sleep">睡眠收據</span>
                    )}
                    {ev.type === 'focus' && (
                      <span className="tl-badge tl-badge--focus">專注</span>
                    )}
                    {ev.type === 'todo' && (
                      <span className="tl-badge tl-badge--todo">已完成</span>
                    )}
                    {ev.type === 'memory' && (
                      <span className="tl-badge tl-badge--memory">記憶</span>
                    )}
                  </div>
                  {ev.route && (
                    <svg className="tl-event-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
