import { useMemo } from 'react';
import type { CheckInRecord } from '@/features/tideclock/types';

interface TideClockTicketProps {
  record: CheckInRecord;
  streak: number;
  monthlyCount: number;
  monthlyTotal: number;
  mainTask?: string;
  compact?: boolean;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusLabel(record: CheckInRecord): string {
  if (record.makeupReason) return '補交';
  if (record.isLate) return '遲到';
  return '準時';
}

function statusClass(record: CheckInRecord): string {
  if (record.makeupReason) return 'tc-ticket-status--makeup';
  if (record.isLate) return 'tc-ticket-status--late';
  return 'tc-ticket-status--ontime';
}

export function TideClockTicket({
  record,
  streak,
  monthlyCount,
  monthlyTotal,
  mainTask,
  compact,
}: TideClockTicketProps) {
  const time = useMemo(() => formatTime(record.clockInAt || record.clockOutAt), [record]);
  const status = useMemo(() => statusLabel(record), [record]);
  const statusCls = useMemo(() => statusClass(record), [record]);

  if (compact) {
    return (
      <div className="tc-ticket tc-ticket--compact">
        <div className="tc-ticket-compact-row">
          <span className="tc-ticket-date">{record.date}</span>
          <span className={`tc-ticket-status ${statusCls}`}>{status}</span>
          <span className="tc-ticket-time">{time}</span>
          <span className="tc-ticket-streak">{streak} 天</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tc-ticket" role="article" aria-label="打卡小票">
      <div className="tc-ticket-header">
        <span className="tc-ticket-title">TIDECLOCK</span>
        <span className="tc-ticket-subtitle">月潮打卡機</span>
      </div>

      <div className="tc-ticket-body">
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">日期</span>
          <span className="tc-ticket-value">{record.date}</span>
        </div>
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">打卡時間</span>
          <span className="tc-ticket-value">{time}</span>
        </div>
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">狀態</span>
          <span className={`tc-ticket-value ${statusCls}`}>{status}</span>
        </div>
        <div className="tc-ticket-divider" />
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">完美連續</span>
          <span className="tc-ticket-value">{streak} 天</span>
        </div>
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">本月出勤</span>
          <span className="tc-ticket-value">{monthlyCount} / {monthlyTotal} 天</span>
        </div>
        {mainTask && (
          <div className="tc-ticket-row">
            <span className="tc-ticket-label">今日主任務</span>
            <span className="tc-ticket-value tc-ticket-value--task">{mainTask}</span>
          </div>
        )}
        <div className="tc-ticket-row">
          <span className="tc-ticket-label">Moon Dew</span>
          <span className="tc-ticket-value tc-ticket-value--dew">
            {record.moonDewAwarded > 0 ? `+${record.moonDewAwarded}` : '0'}
          </span>
        </div>
        <div className="tc-ticket-divider" />
        <div className="tc-ticket-row tc-ticket-row--footer">
          <span className="tc-ticket-label">小票編號</span>
          <span className="tc-ticket-value tc-ticket-value--mono">{record.ticketNumber}</span>
        </div>
      </div>

      <div className="tc-ticket-stamp">
        <svg viewBox="0 0 80 32" width="80" height="32" aria-label="LUNARIS 印章">
          <rect x="1" y="1" width="78" height="30" rx="4" fill="none" stroke="var(--amber, #d4a053)" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x="40" y="14" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--amber, #d4a053)" fontFamily="var(--f-ui, sans-serif)">LUNARIS</text>
          <text x="40" y="24" textAnchor="middle" fontSize="6" fill="var(--text-3, #888)" fontFamily="var(--f-ui, sans-serif)">VERIFIED</text>
        </svg>
      </div>
    </div>
  );
}
