import { useState } from 'react';
import { t, getLanguage } from '@/i18n';

function getWeekdays(lang: string): string[] {
  return lang === 'en'
    ? ['Su','Mo','Tu','We','Th','Fr','Sa']
    : ['日','一','二','三','四','五','六'];
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const cells: { day: number; date: string; isToday: boolean; isOtherMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr, isToday: false, isOtherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr, isToday: dateStr === todayStr, isOtherMonth: false });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month + 1 > 11 ? 0 : month + 1;
      const nextYear = month + 1 > 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr, isToday: false, isOtherMonth: true });
    }
  }
  return cells;
}

function formatMonth(year: number, month: number, lang: string): string {
  const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (lang === 'en') return `${enMonths[month]} ${year}`;
  return t('date.monthLabel').replace('{y}', String(year)).replace('{m}', String(month + 1));
}

function formatAriaLabel(dateStr: string, lang: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  const label = d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  return lang === 'en' ? `Select ${label}` : `選擇 ${label}`;
}

interface CalendarViewProps {
  todoSummaries: Map<string, TodoDaySummary>;
  memoryDates: Set<string>;
  waterDates: Set<string>;
  dateEmotions: Map<string, string[]>;
  selectedDate: string;
  todayStr: string;
  onSelectDate: (date: string) => void;
}

export interface TodoDaySummary {
  total: number;
  completed: number;
  incomplete: number;
  highPriority: boolean;
}

function DayMarkers({ date, todoSummaries, memoryDates, waterDates, dateEmotions, isOtherMonth }: {
  date: string; todoSummaries: Map<string, TodoDaySummary>; memoryDates: Set<string>;
  waterDates: Set<string>; dateEmotions: Map<string, string[]>; isOtherMonth: boolean;
}) {
  if (isOtherMonth) return null;
  const emotions = dateEmotions.get(date) || [];
  const todoSummary = todoSummaries.get(date);
  const markers: { type: 'dot' | 'emoji'; value: string; color?: string; className?: string }[] = [];
  if (todoSummary) {
    const visibleDots = Math.min(3, todoSummary.total);
    for (let index = 0; index < visibleDots; index += 1) {
      markers.push({
        type: 'dot',
        value: '',
        color: todoSummary.incomplete > index ? 'var(--amber)' : 'var(--success)',
        className: todoSummary.highPriority && index === 0 ? 'high' : undefined,
      });
    }
  }
  if (memoryDates.has(date) && emotions.length === 0) markers.push({ type: 'dot', value: '', color: 'var(--journal)' });
  for (const em of emotions.slice(0, 4 - markers.length)) markers.push({ type: 'emoji', value: em });
  if (waterDates.has(date) && markers.length < 4) markers.push({ type: 'dot', value: '', color: 'var(--teal)' });
  if (markers.length === 0) return null;
  return (
    <div className="cal-day-dots">
      {markers.slice(0, 4).map((m, i) =>
        m.type === 'emoji'
          ? <span key={i} className="cal-day-emoji">{m.value}</span>
          : <span key={i} className={`cal-day-dot ${m.className || ''}`} style={{ background: m.color }} />
      )}
      {todoSummary && todoSummary.total > 3 && <span className="cal-day-count">+{todoSummary.total - 3}</span>}
    </div>
  );
}

export function CalendarView({ todoSummaries, memoryDates, waterDates, dateEmotions, selectedDate, todayStr, onSelectDate }: CalendarViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const lang = getLanguage();
  const cells = getMonthDays(year, month);
  const weekdays = getWeekdays(lang);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <div>
      <div className="cal-month-header">
        <span className="cal-month-label">{formatMonth(year, month, lang)}</span>
        <div className="cal-month-nav">
          <button className="btn-icon" onClick={prevMonth} aria-label={t('calendar.prevMonth')}>
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="btn-icon" onClick={nextMonth} aria-label={t('calendar.nextMonth')}>
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="cal-weekdays">
        {weekdays.map((wd) => <span key={wd}>{wd}</span>)}
      </div>

      <div className="cal-grid">
        {cells.map((cell, i) => {
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === todayStr;
          const todoSummary = todoSummaries.get(cell.date);
          return (
            <button
              key={i}
              type="button"
              className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${cell.isOtherMonth ? ' other-month' : ''}${todoSummary?.highPriority ? ' has-high-priority' : ''}${todoSummary && todoSummary.incomplete === 0 ? ' all-completed' : ''}`}
              onClick={() => onSelectDate(cell.date)}
              aria-label={formatAriaLabel(cell.date, lang)}
              aria-pressed={isSelected}
            >
              {cell.day}
              <DayMarkers date={cell.date} todoSummaries={todoSummaries} memoryDates={memoryDates} waterDates={waterDates} dateEmotions={dateEmotions} isOtherMonth={cell.isOtherMonth} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
