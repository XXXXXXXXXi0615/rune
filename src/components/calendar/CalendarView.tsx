// ================================================================
// CalendarView — inline contextual grid
// Each cell shows: day number + ganzhi·元素 + todo/countdown dots
// ================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { t, getLanguage } from '@/i18n';
import { dayGanzhi, dayStem, fiveElementOf } from '@/calendar/core';
import type { CalendarPeriodMetadata } from '@/features/calendar/calendarPeriodAdapter';
import type { HolidayOccurrence, HolidayRegion } from '@/features/calendar/holiday/types';
import { holidayMarkKind, holidayOccurrenceLabel, projectHolidayMonth } from '@/features/calendar/holiday/holidayProjection';

const ELEMENT_ZH = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' } as const;

function getWeekdays(lang: string): string[] {
  return lang === 'en'
    ? ['Su','Mo','Tu','We','Th','Fr','Sa']
    : ['日','一','二','三','四','五','六'];
}

interface CellData {
  day: number;
  date: string;
  isToday: boolean;
  isOtherMonth: boolean;
  ganzhi: string;
  element: string;
  todoCount: number;
  countdownCount: number;
  eventCount: number;
}

function getMonthDays(
  year: number,
  month: number,
  todoCounts: Map<string, number>,
  countdownCounts: Map<string, number>,
  eventCounts: Map<string, number>,
): CellData[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const mk = (dateStr: string, d: number, other: boolean): CellData => {
    const stem = dayStem(dateStr);
    return {
      day: d,
      date: dateStr,
      isToday: dateStr === todayStr,
      isOtherMonth: other,
      ganzhi: dayGanzhi(dateStr),
      element: ELEMENT_ZH[fiveElementOf(stem)],
      todoCount: todoCounts.get(dateStr) ?? 0,
      countdownCount: countdownCounts.get(dateStr) ?? 0,
      eventCount: eventCounts.get(dateStr) ?? 0,
    };
  };

  const cells: CellData[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(mk(dateStr, d, true));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(mk(dateStr, d, false));
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month + 1 > 11 ? 0 : month + 1;
      const nextYear = month + 1 > 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(mk(dateStr, d, true));
    }
  }
  return cells;
}

function formatMonth(year: number, month: number, lang: string): string {
  const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (lang === 'en') return `${enMonths[month]} ${year}`;
  return t('date.monthLabel').replace('{y}', String(year)).replace('{m}', String(month + 1));
}

/** Minimal holiday marker — one element per occurrence, identities never merged. */
function HolidayMark({ occurrence }: { occurrence: HolidayOccurrence }) {
  const mark = holidayMarkKind(occurrence);
  return (
    <i
      className={`cal-holiday-mark is-${mark}`}
      data-holiday-id={occurrence.id}
      data-holiday-kind={occurrence.kind}
    >
      {mark === 'rest' ? '休' : mark === 'work' ? '班' : mark === 'festival' ? occurrence.name.slice(0, 3) : ''}
    </i>
  );
}

export interface CalendarViewProps {
  selectedDate: string;
  todayStr: string;
  onSelectDate: (date: string) => void;
  onOpenDayContext?: (date: string, trigger: HTMLButtonElement) => void;
  moodScores?: Map<string, number>;
  todoCounts?: Map<string, number>;
  countdownCounts?: Map<string, number>;
  eventCounts?: Map<string, number>;
  resolvePeriodMetadata?: (date: string) => CalendarPeriodMetadata;
  /** Read-only holiday projection input (null region → no marks, no inference). */
  holidayRegion?: HolidayRegion | null;
}

export function CalendarView({
  selectedDate,
  todayStr,
  onSelectDate,
  onOpenDayContext,
  moodScores,
  todoCounts,
  countdownCounts,
  eventCounts,
  resolvePeriodMetadata,
  holidayRegion = null,
}: CalendarViewProps) {
  const now = new Date();
  // The visible month must contain the canonical selected date, so the month
  // highlight can never disagree with the URL `?date=` and the Day Inspector
  // (same day-of-month in another month is never "selected"). The month still
  // browses freely: this only follows the selected date, never the reverse.
  const selectedMonthKey = /^(\d{4})-(\d{2})-\d{2}$/.exec(selectedDate);
  const [year, setYear] = useState(() => (selectedMonthKey ? Number(selectedMonthKey[1]) : now.getFullYear()));
  const [month, setMonth] = useState(() => (selectedMonthKey ? Number(selectedMonthKey[2]) - 1 : now.getMonth()));
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  useEffect(() => {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(selectedDate);
    if (!match) return;
    const nextYear = Number(match[1]);
    const nextMonth = Number(match[2]) - 1;
    setYear((current) => (current === nextYear ? current : nextYear));
    setMonth((current) => (current === nextMonth ? current : nextMonth));
  }, [selectedDate]);
  const holidayDateMap = useMemo(
    () => projectHolidayMonth({ region: holidayRegion, year, month: month + 1 }),
    [holidayRegion, year, month],
  );
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef<string | null>(null);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    longPressStartRef.current = null;
  };

  useEffect(() => cancelLongPress, []);

  const lang = getLanguage();
  const cells = getMonthDays(year, month, todoCounts ?? new Map(), countdownCounts ?? new Map(), eventCounts ?? new Map());
  const weekdays = getWeekdays(lang);
  const selectedIndex = Math.max(0, cells.findIndex((cell) => cell.date === selectedDate));
  const visibleCells = viewMode === 'week' ? cells.slice(Math.floor(selectedIndex / 7) * 7, Math.floor(selectedIndex / 7) * 7 + 7) : cells;

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
          <div className="cal-view-switch" role="group" aria-label="日曆檢視"><button type="button" className={viewMode==='month'?'active':''} aria-pressed={viewMode==='month'} onClick={()=>setViewMode('month')}>月</button><button type="button" className={viewMode==='week'?'active':''} aria-pressed={viewMode==='week'} onClick={()=>setViewMode('week')}>週</button></div>
        </div>
      </div>

      <div className="cal-weekdays">
        {weekdays.map((wd) => <span key={wd}>{wd}</span>)}
      </div>

      <div className={`cal-grid is-${viewMode}`}>
        {visibleCells.map((cell, i) => {
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === todayStr;
          const moodScore = moodScores?.get(cell.date) ?? 0;
          const moodClass = moodScore > 1 ? 'mood-warm' : moodScore > 0 ? 'mood-balanced' : moodScore < 0 ? 'mood-calm' : '';
          const hasTodo = cell.todoCount > 0;
          const hasCountdown = cell.countdownCount > 0;
          const hasEvent = cell.eventCount > 0;
          const period = resolvePeriodMetadata?.(cell.date);
          const periodLabels = period?.accessibleLabels ?? [];
          const holidays = holidayDateMap.get(cell.date) ?? [];
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${cell.isOtherMonth ? ' other-month' : ''}${moodClass ? ` ${moodClass}` : ''}`}
              onClick={(event) => {
                if (suppressClickRef.current === cell.date) {
                  suppressClickRef.current = null;
                  event.preventDefault();
                  return;
                }
                onSelectDate(cell.date);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                cancelLongPress();
                onOpenDayContext?.(cell.date, event.currentTarget);
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
                cancelLongPress();
                longPressStartRef.current = { x: event.clientX, y: event.clientY };
                const trigger = event.currentTarget;
                longPressTimerRef.current = window.setTimeout(() => {
                  suppressClickRef.current = cell.date;
                  longPressTimerRef.current = null;
                  onOpenDayContext?.(cell.date, trigger);
                }, 550);
              }}
              onPointerMove={(event) => {
                const start = longPressStartRef.current;
                if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 10) return;
                cancelLongPress();
              }}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onKeyDown={(event) => {
                if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                event.preventDefault();
                onOpenDayContext?.(cell.date, event.currentTarget);
              }}
              aria-pressed={isSelected}
              aria-label={[cell.date, ...holidays.map(holidayOccurrenceLabel), ...periodLabels].join('，')}
              data-date={cell.date}
              data-period-kind={period?.actualPeriodDay ? 'actual' : period?.predictedPeriodDay ? 'predicted' : period?.isOvulationDay ? 'ovulation' : period?.isFertileWindow ? 'fertile' : undefined}
            >
              <span className="cal-day-num">{cell.day}</span>
              <span className="cal-day-stem">{cell.ganzhi} <span className="cal-day-elem">{cell.element}</span></span>
              {holidays.length > 0 && (
                <span className="cal-holiday-marks" aria-hidden="true">
                  {holidays.slice(0, 2).map((occurrence) => <HolidayMark key={occurrence.id} occurrence={occurrence} />)}
                  {holidays.length > 2 && <i className="cal-holiday-mark is-more">{`+${holidays.length - 2}`}</i>}
                </span>
              )}
              {period && (period.actualPeriodDay || period.predictedPeriodDay || period.isFertileWindow) && (
                <span className="cal-period-indicators" aria-hidden="true">
                  {(period.actualPeriodDay || period.predictedPeriodDay) && <span className={`cal-period-bar${period.actualPeriodDay ? ' is-actual' : ' is-predicted'}`} />}
                  {period.isFertileWindow && <span className={`cal-fertile-marker${period.isOvulationDay ? ' is-ovulation' : ''}`} />}
                </span>
              )}
              {period && (period.hasMoodRecord || period.hasSymptomRecord) && <span className="cal-period-record-dot" aria-hidden="true" />}
              {(hasTodo || hasCountdown || hasEvent) && (
                <span className="cal-day-dots">
                  {hasTodo && <span className="cal-day-dot cal-dot-todo" />}
                  {hasCountdown && <span className="cal-day-dot cal-dot-countdown" />}
                  {hasEvent && <span className="cal-day-dot cal-dot-event" />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
