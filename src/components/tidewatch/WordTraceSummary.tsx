import { dailyBreakdown } from '@/features/tidewatch/aggregation';
import type { PeriodStats, SurfaceBreakdown, WritingTelemetryEvent } from '@/features/tidewatch/types';

const formatChars = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : String(value);
const dayKey = (timestamp: number) => { const date = new Date(timestamp); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };

export function WordTraceSummary({ today, week, lifetime, surfaces, events }: { today: PeriodStats; week: PeriodStats; lifetime: PeriodStats; surfaces: SurfaceBreakdown[]; events: WritingTelemetryEvent[] }) {
  const writingDays = new Set(events.filter((event) => event.actor === 'user' && event.committedChars > 0).map((event) => dayKey(event.timestamp))).size;
  const trend = dailyBreakdown(events.filter((event) => event.actor === 'user'), 7);
  const max = Math.max(1, ...trend.map((day) => day.userChars));
  return <section className="tw-section" data-testid="tidewatch-wordtrace">
    <h2 className="tw-section-title">WRITING <span>WORDTRACE</span></h2>
    <div className="tw-wordtrace-summary">
      <div className="tw-wordtrace-primary"><span>今日</span><strong>{formatChars(today.userCommitted)}</strong></div>
      <div className="tw-wordtrace-totals"><span>本週 <b>{formatChars(week.userCommitted)}</b></span><span>累計 <b>{formatChars(lifetime.userCommitted)}</b></span></div>
      <div className="tw-wordtrace-surfaces"><small>主要表面</small>{surfaces.length ? surfaces.slice(0, 3).map((surface) => <span key={surface.surface}>{surface.surface} <b>{formatChars(surface.chars)}</b></span>) : <span>尚無紀錄</span>}</div>
      {writingDays >= 3 ? <div className="tw-wordtrace-trend" data-testid="wordtrace-trend" aria-label="最近七日書寫趨勢">{trend.map((day) => <span key={day.date} title={`${day.date} · ${day.userChars}`}><i style={{ height: `${Math.max(4, day.userChars / max * 100)}%` }} /></span>)}</div> : <p className="tw-wordtrace-forming">記錄正在形成</p>}
    </div>
  </section>;
}
