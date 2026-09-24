import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeWidget } from '@/components/home/HomeWidget';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import type { TimelineEvent } from '@/types';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcon';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`;
  return `${Math.floor(diff / 86_400_000)}d 前`;
}

function timelineIcon(type: TimelineEvent['type']): AppIconName {
  if (type === 'sleep' || type === 'sleep_receipt') return 'sleep';
  if (type === 'focus') return 'focus';
  if (type === 'todo') return 'todo';
  if (type === 'memory' || type === 'chat') return 'memory';
  if (type === 'diet' || type === 'diet_receipt') return 'food';
  if (type === 'journal' || type === 'forum_post' || type === 'forum_reply') return 'diary';
  if (type === 'water') return 'water';
  return 'timeline';
}

export function DailyBriefing() {
  const navigate = useNavigate();
  const todayStr = toLocalDateString(new Date());
  const timelineEvents = useAppStore((s) => s.timelineEvents || []);
  const todos = useAppStore((s) => s.todos);
  const sleepReceipts = useAppStore((s) => s.sleepReceipts || []);
  const focusSessionLog = useAppStore((s) => s.focusSessionLog || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);

  const today = useMemo(() => {
    // Today's timeline events
    const todayEvents = timelineEvents.filter((e) => e.date === todayStr);

    // Today's completed todos
    const todayTodosDone = todos.filter(
      (t) => t.date === todayStr && t.completed
    ).length;

    // Today's sleep
    const todaySleep = sleepReceipts.find((r) => r.date === todayStr);
    const sleepMin = todaySleep?.totalSleep ?? 0;

    // Today's focus sessions
    const todayFocus = focusSessionLog.filter(
      (s) => s.date === todayStr
    );
    const focusRounds = todayFocus.length;

    // Today's new memories
    const todayMemories = memoryEntries.filter(
      (m) => toLocalDateString(new Date(m.createdAt)) === todayStr
    ).length;

    // Recent 3 events
    const recentEvents = todayEvents.slice(0, 3);

    const hasAny =
      sleepMin > 0 ||
      focusRounds > 0 ||
      todayTodosDone > 0 ||
      todayMemories > 0 ||
      recentEvents.length > 0;

    return {
      sleepMin,
      focusRounds,
      todayTodosDone,
      todayMemories,
      recentEvents,
      hasAny,
    };
  }, [timelineEvents, todos, sleepReceipts, focusSessionLog, memoryEntries, todayStr]);

  if (!today.hasAny) return null;

  const stats = [
    {
      label: '睡眠',
      value: today.sleepMin > 0 ? `${Math.floor(today.sleepMin / 60)}h${today.sleepMin % 60}m` : '—',
      icon: 'sleep' as const,
    },
    {
      label: '專注',
      value: today.focusRounds > 0 ? `${today.focusRounds} 輪` : '—',
      icon: 'focus' as const,
    },
    {
      label: '待辦',
      value: today.todayTodosDone > 0 ? `${today.todayTodosDone} 項` : '—',
      icon: 'todo' as const,
    },
    {
      label: '記憶',
      value: today.todayMemories > 0 ? `${today.todayMemories} 筆` : '—',
      icon: 'memory' as const,
    },
  ];

  return (
    <HomeWidget className="daily-briefing-card" title="今日簡報">
      {/* Stats row */}
      <div className="db-stats">
        {stats.map((s) => (
          <div key={s.label} className="db-stat">
            <span className="db-stat-icon"><AppIcon name={s.icon} size={18} /></span>
            <span className="db-stat-val">{s.value}</span>
            <span className="db-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent events */}
      {today.recentEvents.length > 0 && (
        <div className="db-events">
          <span className="db-events-label">最近事件</span>
          <div className="db-events-list">
            {today.recentEvents.map((ev: TimelineEvent) => (
              <button
                key={ev.id}
                type="button"
                className="db-event-item"
                onClick={() => {
                  if (ev.route) navigate(ev.route);
                }}
              >
                <span className="db-event-icon"><AppIcon name={timelineIcon(ev.type)} size={16} /></span>
                <span className="db-event-detail">{ev.detail}</span>
                <span className="db-event-time">{formatRelative(ev.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty today message */}
      {today.recentEvents.length === 0 && (
        <p className="db-empty-msg">今天還沒有留下潮痕</p>
      )}
    </HomeWidget>
  );
}
