import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';

const WEEKS = 12;
const DAYS_PER_WEEK = 7;

interface HeatmapDay {
  date: Date;
  dateKey: string;
  messageCount: number;
  memoryCount: number;
  moonReadCount: number;
  isFuture: boolean;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getTimestamp(value: string | number | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getLevel(count: number) {
  if (count === 0) return 0;
  if (count <= 5) return 1;
  if (count <= 20) return 2;
  if (count <= 60) return 3;
  return 4;
}

function formatPopoverDate(date: Date) {
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function ChatHeatmap() {
  const messages = useAppStore((s) => s.messages || []);
  const memoryEntries = useAppStore((s) => s.memoryEntries || []);
  const runtimeLogs = useAppStore((s) => s.agentRuntimeLogs || []);
  const [today] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { days, validMessageCount } = useMemo(() => {
    const messageCounts = new Map<string, number>();
    const memoryCounts = new Map<string, number>();
    const moonReadCounts = new Map<string, number>();
    let validMessages = 0;

    messages.forEach((message) => {
      if (message.sender !== 'me' && message.sender !== 'assistant' && message.sender !== 'friend') return;
      const timestamp = getTimestamp(message.time);
      if (timestamp === null) return;
      validMessages += 1;
      const key = toLocalDateString(new Date(timestamp));
      messageCounts.set(key, (messageCounts.get(key) || 0) + 1);
    });

    memoryEntries.forEach((entry) => {
      const timestamp = getTimestamp(entry.createdAt);
      if (timestamp === null) return;
      const key = toLocalDateString(new Date(timestamp));
      memoryCounts.set(key, (memoryCounts.get(key) || 0) + 1);
    });

    runtimeLogs.forEach((log) => {
      if (log.source !== 'moonread' || log.status !== 'completed') return;
      const timestamp = getTimestamp(log.finishedAt ?? log.startedAt);
      if (timestamp === null) return;
      const key = toLocalDateString(new Date(timestamp));
      moonReadCounts.set(key, (moonReadCounts.get(key) || 0) + 1);
    });

    const startOfCurrentWeek = addDays(today, -today.getDay());
    const graphStart = addDays(startOfCurrentWeek, -(WEEKS - 1) * DAYS_PER_WEEK);

    const heatmapDays = Array.from({ length: WEEKS * DAYS_PER_WEEK }, (_, index): HeatmapDay => {
      const date = addDays(graphStart, index);
      const dateKey = toLocalDateString(date);
      return {
        date,
        dateKey,
        messageCount: messageCounts.get(dateKey) || 0,
        memoryCount: memoryCounts.get(dateKey) || 0,
        moonReadCount: moonReadCounts.get(dateKey) || 0,
        isFuture: date > today,
      };
    });

    return { days: heatmapDays, validMessageCount: validMessages };
  }, [memoryEntries, messages, runtimeLogs, today]);

  const selected = selectedDate ? days.find((day) => day.dateKey === selectedDate) : null;

  if (validMessageCount === 0) {
    return (
      <div className="chat-heatmap">
        <p className="chat-heatmap-subtitle">顏色越深，那天留下的對話越多。</p>
        <div className="chat-heatmap-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span>還沒有足跡，和 LUNARIS 說句話吧。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-heatmap">
      <p className="chat-heatmap-subtitle">顏色越深，那天留下的對話越多。</p>
      <div className="chat-heatmap-graph" aria-label="最近 12 週聊天熱力圖">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className={`chat-heatmap-cell level-${getLevel(day.messageCount)} ${day.isFuture ? 'is-future' : ''} ${selectedDate === day.dateKey ? 'is-selected' : ''}`}
            aria-label={`${formatPopoverDate(day.date)}，${day.messageCount} 條訊息`}
            disabled={day.isFuture}
            onClick={() => setSelectedDate((current) => current === day.dateKey ? null : day.dateKey)}
          />
        ))}
      </div>

      <div className="chat-heatmap-legend" aria-hidden="true">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => <i key={level} className={`level-${level}`} />)}
        <span>多</span>
      </div>

      {selected && (
        <div className="chat-heatmap-popover" role="status">
          <button
            type="button"
            className="chat-heatmap-popover-close"
            onClick={() => setSelectedDate(null)}
            aria-label="關閉足跡詳情"
          >
            ×
          </button>
          <strong>{formatPopoverDate(selected.date)}</strong>
          <span>當天訊息數 <b>{selected.messageCount}</b></span>
          <span>當天新增記憶數 <b>{selected.memoryCount}</b></span>
          <span>當天月讀室互動數 <b>{selected.moonReadCount}</b></span>
        </div>
      )}
    </div>
  );
}
