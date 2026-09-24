import { useEffect, useRef, useState } from 'react';

interface CalendarPopupProps {
  value: string;       // YYYY-MM-DD
  onSelect: (dateKey: string) => void;
  onClose: () => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export function CalendarPopup({ value, onSelect, onClose }: CalendarPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const init = value ? new Date(value) : new Date();
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const weeks: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { weeks.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); weeks.push(row); }

  const fmt = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const todayKey = ((d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)(new Date());

  const prev = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else { setMonth(m => m - 1); } };
  const next = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else { setMonth(m => m + 1); } };

  return (
    <div className="cal-event-cal-popup" ref={ref}>
      <div className="cal-event-cal-header">
        <button type="button" className="cal-event-cal-nav" onClick={prev} aria-label="上個月">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="cal-event-cal-label">{year} 年 {month + 1} 月</span>
        <button type="button" className="cal-event-cal-nav" onClick={next} aria-label="下個月">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
      <div className="cal-event-cal-weekdays">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-event-cal-days">
        {weeks.flat().map((d, i) => {
          if (d === null) return <span key={i} />;
          const key = fmt(d);
          return (
            <button
              key={key}
              type="button"
              className={`cal-event-cal-day${key === todayKey ? ' today' : ''}${key === value ? ' selected' : ''}`}
              onClick={() => { onSelect(key); onClose(); }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="cal-event-cal-today-row">
        <button type="button" className="cal-event-cal-today-btn" onClick={() => { onSelect(todayKey); onClose(); }}>
          回到今天
        </button>
      </div>
    </div>
  );
}
