import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/layout/BackButton';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { Card } from '@/components/ui/Card';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarTodoList } from '@/components/calendar/CalendarTodoList';
import { CalendarCreateSheet } from '@/components/calendar/CalendarCreateSheet';
import { useAppStore } from '@/store/useAppStore';
import { getQuestDateKey, useQuestStore } from '@/store/useQuestStore';
import { getLanguage } from '@/i18n';
import { approximateLunarDate, formatDateStr } from '@/calendar/core';
import { AppSwitch } from '@/components/ui/AppPrimitives';
import { PickerField } from '@/components/ui/PickerField';
import { DateWheelPicker } from '@/components/ui/DateWheelPicker';
import { TimeWheelPicker } from '@/components/ui/TimeWheelPicker';
import { splitDate } from '@/components/ui/pickerUtils';
import type { CalendarEvent } from '@/types';
import { localDateKey, parseLocalDateKey } from '@/utils/date';

import { CountdownSection } from '@/components/countdown/CountdownSection';
import { CountdownEditorSheet } from '@/components/countdown/CountdownEditorSheet';
import type { CountdownEvent } from '@/features/countdown/countdownEngine';
import { useCountdownStore, selectCountdownEvents, selectHydrationState } from '@/features/countdown/useCountdownStore';
import { selectCountdownEventsForDate } from '@/features/countdown/countdownSelectors';
import { CalendarDayCanvas } from '@/components/calendar/CalendarDayCanvas';
import { CanvasQuickFloat } from '@/components/calendar/CanvasQuickFloat';
import { HolidayDayIdentity } from '@/components/calendar/HolidayDayIdentity';
import { HolidayCountdownSection } from '@/components/calendar/HolidayCountdownSection';
import { BodyWorkspace } from '@/components/health/BodyWorkspace';
import { LifeWorkspace } from '@/components/calendar/LifeWorkspace';
import { resolveCalendarPeriodMetadata } from '@/features/calendar/calendarPeriodAdapter';
import { loadPeriodRecords } from '@/utils/periodStorage';
import { PeriodRecordSheet } from '@/components/period/PeriodRecordSheet';
import { AppIcon, type AppIconName } from '@/components/icons/AppIcon';

type CalendarSheet = 'entry' | 'countdown' | null;
type CalendarUtility = 'schedule' | 'canvas' | 'body' | 'life';
type InspectorPresentation = 'docked' | 'sheet' | 'floating';

/**
 * Calendar workspace presentation is measured from the workspace container
 * itself — never from the browser viewport:
 *  - stage >= 960px  → docked Day Inspector (two-pane CalendarWorkspace)
 *  - otherwise, if the app frame is phone-width (mirrors AppShell's
 *    FRAME_NARROW_THRESHOLD) → Day Inspector presented in a bottom sheet
 *  - otherwise (wide frame, narrow stage) → legacy floating panel fallback
 */
const WIDE_WORKSPACE_MIN_WIDTH = 960;
const FRAME_NARROW_MAX_WIDTH = 520;

const CALENDAR_UTILITIES: Array<{ id: CalendarUtility; label: string; icon: AppIconName }> = [
  { id: 'schedule', label: '日程', icon: 'calendar' },
  { id: 'canvas', label: '畫布', icon: 'palette' },
  { id: 'body', label: '身體', icon: 'chartActivity' },
  { id: 'life', label: '生活', icon: 'timeline' },
];

function parseUtility(value: string | null): CalendarUtility | null {
  if (value === 'schedule' || value === 'body' || value === 'life') return value;
  if (value === 'canvas') return value;
  // 'countdowns'/'timekeeper' 為舊時光 tab 參數 — 現在落在日程工作區
  if (value === 'countdowns' || value === 'timekeeper') return 'schedule';
  // 'settlement' 為已退役的結算面板（Phase C2）— 不再復原任何 surface
  return null;
}

const CALENDAR_CATEGORY_LABEL: Record<NonNullable<CalendarEvent['category']>, string> = {
  general: '一般', countdown: '倒數', anniversary: '紀念日', birthday: '生日',
  project: '專案', personal: '個人', renewal: '續訂', memory: '記憶', system: '系統',
};

function parseLocalDate(date: string): Date {
  return parseLocalDateKey(date);
}

function formatDateLabel(date: string): string {
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatSelectedDate(date: string): { dateLabel: string; weekdayLabel: string } {
  const lang = getLanguage();
  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  const d = parseLocalDate(date);
  return {
    dateLabel: d.toLocaleDateString(locale, { month: 'long', day: 'numeric' }),
    weekdayLabel: d.toLocaleDateString(locale, { weekday: 'long' }),
  };
}



function getEventsByDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((event) => !event.deletedAt && event.date === date);
}

function mapCounts<T>(items: T[], getDate: (item: T) => string | undefined, shouldCount?: (item: T) => boolean): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (shouldCount && !shouldCount(item)) continue;
    const date = getDate(item);
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

function Icon({ name }: { name: 'event' | 'period' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === 'event' && <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>}
      {name === 'period' && <><path d="M12 3c3.2 4.1 5.2 6.9 5.2 10A5.2 5.2 0 0 1 6.8 13C6.8 9.9 8.8 7.1 12 3Z" /><path d="M9.2 14.2c.7 1.2 1.7 1.8 3 1.8" /></>}
    </svg>
  );
}

function DayActionWindow({
  date,
  onClose,
  onAddEntry,
  onRecordPeriod,
  scheduleCount,
  periodSummary,
  todoCount,
}: {
  date: string;
  onClose: () => void;
  onAddEntry: () => void;
  onRecordPeriod: () => void;
  scheduleCount: number;
  periodSummary: string | null;
  todoCount: number;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <MobileShellOverlay onClose={onClose} variant="dialog">
      <div className="day-action-window" role="dialog" aria-modal="true" aria-label="選擇日期操作" data-date={date}>
        <div className="day-action-window-head">
          <div>
            <strong>{formatDateLabel(date)}</strong>
            <p className="day-action-subtitle">{formatSelectedDate(date).weekdayLabel}</p>
          </div>
        </div>
        <div className="day-action-window-body">
          {(scheduleCount > 0 || periodSummary || todoCount > 0) && <section className="day-context-summary" aria-label="當日摘要">
            <span>當日摘要</span>
            {scheduleCount > 0 && <p>已有日程 <strong>{scheduleCount}</strong> 筆</p>}
            {periodSummary && <p>生理周期 <strong>{periodSummary}</strong></p>}
            {todoCount > 0 && <p>當日待辦 <strong>{todoCount}</strong> 筆</p>}
          </section>}
          <span className="day-context-actions-label">動作</span>
          <button type="button" className="day-action-item" onClick={onAddEntry}>
            <span><Icon name="event" /></span>
            <span><strong>新增日程</strong><small>一般、倒數、紀念日、生日、專案或個人</small></span>
          </button>
          <button type="button" className="day-action-item" onClick={onRecordPeriod}>
            <span><Icon name="period" /></span>
            <span><strong>記錄生理周期</strong><small>日期、經量與心情</small></span>
          </button>
        </div>
      </div>
    </MobileShellOverlay>
  );
}

function CalendarEventSheet({
  defaultDate,
  event,
  onClose,
  onSave,
  onDelete,
}: {
  defaultDate: string;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (payload: Omit<CalendarEvent, 'id'>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(event?.date || defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate || '');
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [note, setNote] = useState(event?.note || event?.description || '');
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? true);
  const [category, setCategory] = useState<NonNullable<CalendarEvent['category']>>(event?.category || (event?.eventType as CalendarEvent['category']) || 'general');
  const [submitted, setSubmitted] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'date' | 'endDate' | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | undefined>();
  const dateFieldRef = useRef<HTMLButtonElement>(null);
  const endDateFieldRef = useRef<HTMLButtonElement>(null);
  const timeFieldRef = useRef<HTMLButtonElement>(null);

  const dirty = (title !== (event?.title || ''))
    || (date !== (event?.date || defaultDate))
    || (endDate !== (event?.endDate || ''))
    || (startTime !== (event?.startTime || ''))
    || (note !== (event?.note || event?.description || ''))
    || (isAllDay !== (event?.isAllDay ?? true))
    || (category !== (event?.category || event?.eventType || 'general'));

  const submit = () => {
    setSubmitted(true);
    if (!title.trim()) return;
    onSave({
      type: event?.type || 'event',
      date,
      endDate: endDate || undefined,
      title: title.trim(),
      completed: event?.completed || false,
      description: note.trim(),
      note: note.trim() || undefined,
      isAllDay,
      startTime: startTime || undefined,
      category,
      eventType: category,
      repeat: event?.repeat || 'none',
      pinned: event?.pinned || false,
      reminderEnabled: event?.reminderEnabled || false,
    });
  };

  const openDatePicker = (target: 'date' | 'endDate') => {
    const trigger = target === 'date' ? dateFieldRef.current : endDateFieldRef.current;
    setTriggerRect(trigger?.getBoundingClientRect());
    setDatePickerTarget(target);
  };

  const openTimePicker = () => {
    setTriggerRect(timeFieldRef.current?.getBoundingClientRect());
    setTimePickerOpen(true);
  };

  const displayDate = (value: string) => {
    if (!value) return '';
    const { year, month, day } = splitDate(value);
    return `${year} 年 ${month} 月 ${day} 日`;
  };

  return (
    <CalendarCreateSheet
      isOpen
      onClose={onClose}
      onConfirm={submit}
      typeLabel="Calendar Entry"
      title={event ? '更新日程' : '新增日程'}
      confirmLabel={event ? '更新' : '建立'}
      confirmDisabled={submitted && !title.trim()}
      dirty={dirty}
      deleteButton={event ? <button type="button" className="cal-create-danger-btn" onClick={onDelete}>刪除</button> : undefined}
    >
      <div className="cal-field">
        <label htmlFor="calendar-entry-title">標題</label>
        <input id="calendar-entry-title" value={title} onChange={(e) => { setTitle(e.target.value); setSubmitted(false); }} placeholder="例如：和朋友吃飯" autoFocus />
        {submitted && !title.trim() && <small style={{ color: 'var(--danger)', fontSize: 11 }}>請輸入日程標題</small>}
      </div>
      <div className="cal-field-row">
        <PickerField
          label="日期"
          value={displayDate(date)}
          onOpen={() => openDatePicker('date')}
          expanded={datePickerTarget === 'date'}
          buttonRef={dateFieldRef}
        />
        <PickerField
          label="結束日期（選填）"
          value={displayDate(endDate)}
          placeholder="未設定"
          onOpen={() => openDatePicker('endDate')}
          expanded={datePickerTarget === 'endDate'}
          buttonRef={endDateFieldRef}
        />
        <DateWheelPicker
          isOpen={datePickerTarget !== null}
          value={datePickerTarget === 'endDate' ? (endDate || date) : date}
          title={datePickerTarget === 'endDate' ? '選擇結束日期' : '選擇日期'}
          triggerRect={triggerRect}
          allowClear={datePickerTarget === 'endDate'}
          onConfirm={(nextDate) => {
            if (datePickerTarget === 'endDate') setEndDate(nextDate);
            else setDate(nextDate);
            setSubmitted(false);
            setDatePickerTarget(null);
          }}
          onCancel={() => setDatePickerTarget(null)}
        />
      </div>
      <div className="cal-field-row">
        <div className="cal-field"><label htmlFor="calendar-entry-category">類型</label><select id="calendar-entry-category" value={category} onChange={(event) => setCategory(event.target.value as NonNullable<CalendarEvent['category']>)}>{Object.entries(CALENDAR_CATEGORY_LABEL).filter(([key]) => !['renewal', 'memory', 'system'].includes(key)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <PickerField
          label="時間"
          value={startTime || '全天'}
          placeholder="選擇時間"
          onOpen={openTimePicker}
          disabled={isAllDay}
          expanded={timePickerOpen}
          buttonRef={timeFieldRef}
        >
          <TimeWheelPicker
            isOpen={timePickerOpen}
            value={startTime}
            triggerRect={triggerRect}
            onConfirm={(t) => { setStartTime(t); setSubmitted(false); setTimePickerOpen(false); }}
            onCancel={() => setTimePickerOpen(false)}
          />
        </PickerField>
      </div>
      <div className="cal-toggle-row">
        <span>全天</span>
        <AppSwitch checked={isAllDay} onChange={(v) => { setIsAllDay(v); setSubmitted(false); }} />
      </div>
      <div className="cal-field">
        <label htmlFor="calendar-entry-note">備註</label>
        <textarea id="calendar-entry-note" value={note} onChange={(e) => { setNote(e.target.value); setSubmitted(false); }} rows={3} placeholder="這件事需要記下什麼？" />
      </div>
    </CalendarCreateSheet>
  );
}

function CalendarUtilityRail({ activeUtility, triggerRefs, onSelect }: {
  activeUtility: CalendarUtility | null;
  triggerRefs: MutableRefObject<Partial<Record<CalendarUtility, HTMLButtonElement | null>>>;
  onSelect: (utility: CalendarUtility) => void;
}) {
  return <nav className="calendar-utility-rail" aria-label="日曆工具">
    {CALENDAR_UTILITIES.map((utility) => <button
      key={utility.id}
      ref={(node) => { triggerRefs.current[utility.id] = node; }}
      type="button"
      className={activeUtility === utility.id ? 'is-active' : ''}
      aria-label={utility.label}
      title={utility.label}
      aria-expanded={activeUtility === utility.id}
      aria-controls="calendar-utility-panel"
      onClick={() => onSelect(utility.id)}
    ><AppIcon name={utility.icon} size={20} /><span>{utility.label}</span></button>)}
  </nav>;
}

export interface InspectorDateContext {
  dateKey: string;
  primary: string;
  weekday: string;
  iso: string;
  lunar: string | null;
}

function CalendarUtilityPanel({ utility, variant = 'floating', dateContext, reduceMotion, closeRef, onClose, children }: {
  utility: CalendarUtility;
  variant?: 'floating' | 'docked' | 'sheet';
  dateContext: InspectorDateContext;
  reduceMotion: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const label = CALENDAR_UTILITIES.find((item) => item.id === utility)?.label ?? utility;
  const sheet = variant === 'sheet';
  const dismissable = variant !== 'docked';
  return <motion.aside
    id="calendar-utility-panel"
    className="calendar-utility-panel"
    data-testid="calendar-utility-panel"
    data-presentation={variant}
    role="dialog"
    aria-modal={sheet ? 'true' : 'false'}
    aria-labelledby="calendar-utility-title"
    data-utility={utility}
    data-pet-safe-region="interactive"
    initial={reduceMotion ? { opacity: 0 } : sheet ? { opacity: 0, y: 30 } : { opacity: 0, clipPath: 'inset(0 0 0 100% round 24px)' }}
    animate={reduceMotion ? { opacity: 1 } : sheet ? { opacity: 1, y: 0 } : { opacity: 1, clipPath: 'inset(0 0 0 0 round 24px)' }}
    exit={reduceMotion ? { opacity: 0 } : sheet ? { opacity: 0, y: 22 } : { opacity: 0, clipPath: 'inset(0 0 0 100% round 24px)' }}
    transition={{ duration: reduceMotion ? 0.1 : 0.22 }}
  >
    <header className="calendar-inspector-head">
      <div className="calendar-inspector-context">
        <div className="calendar-inspector-primary">
          <strong className="calendar-inspector-date">{dateContext.primary}</strong>
          <h2 id="calendar-utility-title" className="calendar-inspector-mode">{label}</h2>
        </div>
        <p className="calendar-inspector-meta">
          {dateContext.weekday} · {dateContext.iso}{dateContext.lunar ? ` · 農曆 ${dateContext.lunar}` : ''}
        </p>
        {/* Phase 3B-4.1 — selected-day holiday identity lives with the date header. */}
        <HolidayDayIdentity dateKey={dateContext.dateKey} />
      </div>
      {dismissable && <button ref={closeRef} type="button" aria-label={`關閉${label}面板`} onClick={onClose}>×</button>}
    </header>
    <div className="calendar-utility-panel__body">
      <AnimatePresence initial={false} mode="sync">
        <motion.div key={utility} data-calendar-utility={utility} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.18 }}>{children}</motion.div>
      </AnimatePresence>
    </div>
  </motion.aside>;
}

/**
 * Day Inspector — the Calendar workspace's right pane, evolved from the
 * Phase 3A utility rail + shared panel (single panel instance, single owner).
 * It never stores a date: every mode receives the canonical
 * `CalendarPage.selectedDate` through the panel content and the slots.
 */
function DayInspector({ presentation, utility, dateContext, reduceMotion, triggerRefs, closeRef, onSelect, onClose, children }: {
  presentation: InspectorPresentation;
  utility: CalendarUtility | null;
  dateContext: InspectorDateContext;
  reduceMotion: boolean;
  triggerRefs: MutableRefObject<Partial<Record<CalendarUtility, HTMLButtonElement | null>>>;
  closeRef: RefObject<HTMLButtonElement | null>;
  onSelect: (utility: CalendarUtility) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  // Phase C1/C2: the Canvas mode's desktop presentation is the Quick Float (a
  // compact side panel beside the rail) — the only Canvas presentation; phone
  // frames keep the existing sheet.
  const canvasMode = utility === 'canvas' && presentation !== 'sheet';
  return <div
    className={`calendar-utility-layout${utility ? ' is-open' : ''}`}
    data-testid="calendar-utility-layout"
    data-presentation={presentation}
  >
    <CalendarUtilityRail activeUtility={utility} triggerRefs={triggerRefs} onSelect={onSelect} />
    {utility && (canvasMode
      ? <CanvasQuickFloat dateKey={dateContext.dateKey} dateLabel={dateContext.primary} onClose={onClose} />
      : presentation === 'sheet'
        ? <MobileShellOverlay variant="sheet" onClose={onClose} className="calendar-inspector-sheet">
          <CalendarUtilityPanel utility={utility} variant="sheet" dateContext={dateContext} reduceMotion={reduceMotion} closeRef={closeRef} onClose={onClose}>{children}</CalendarUtilityPanel>
        </MobileShellOverlay>
        : <AnimatePresence initial={false}>
          <CalendarUtilityPanel utility={utility} variant={presentation === 'docked' ? 'docked' : 'floating'} dateContext={dateContext} reduceMotion={reduceMotion} closeRef={closeRef} onClose={onClose}>{children}</CalendarUtilityPanel>
        </AnimatePresence>)}
  </div>;
}

export function CalendarPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const quests = useQuestStore((s) => s.quests);
  const customEvents = useAppStore((s) => s.customEvents || []);
  // Read-only holiday projection input (canonical store field; never written here).
  const holidayRegion = useAppStore((s) => s.holidayRegion);
  const memoryEntries = useAppStore((s) => s.memoryEntries);
  const diaryEntries = useAppStore((s) => s.diaryEntries);
  const music = useAppStore((s) => s.music);
  const addCalendarEvent = useAppStore((s) => s.addCalendarEvent);
  const updateCalendarEvent = useAppStore((s) => s.updateCalendarEvent);
  const deleteCalendarEvent = useAppStore((s) => s.deleteCalendarEvent);

  // Tab-specific selectors — use stable selectors from countdownSelectors
  const countdownEvents = useCountdownStore(selectCountdownEvents);
  const countdownHydrated = useCountdownStore(selectHydrationState);

  const todayStr = formatDateStr(new Date());
  const params = new URLSearchParams(location.search);
  const [activeUtility, setActiveUtilityState] = useState<CalendarUtility | null>(() => parseUtility(params.get('view') || params.get('tab')));
  const [selectedDate, setSelectedDate] = useState(params.get('date') || todayStr);
  // C4 — the countdowns bound to the selected calendar day. Pure occurrence
  // query from the canonical selector; the global list is not narrowed here.
  const dayCountdowns = selectCountdownEventsForDate(countdownEvents, selectedDate);
  const [activeSheet, setActiveSheet] = useState<CalendarSheet>(null);
  const [editingCalendarEvent, setEditingCalendarEvent] = useState<CalendarEvent | null>(null);
  const [editingCountdown, setEditingCountdown] = useState<CountdownEvent | null | 'new'>(null);
  const [dayActionOpen, setDayActionOpen] = useState(false);
  const [periodRecords, setPeriodRecords] = useState(() => loadPeriodRecords());
  const [periodEditorOpen, setPeriodEditorOpen] = useState(false);
  const [inspectorPresentation, setInspectorPresentation] = useState<InspectorPresentation>('floating');
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  // Docked workspaces keep one Day Inspector pane mounted (日程 by default);
  // phone frames keep the closed state — the rail is the trigger and the panel
  // presents in a sheet. Same single panel instance in every presentation.
  const inspectorUtility = activeUtility ?? (inspectorPresentation === 'docked' ? 'schedule' : null);
  const reduceMotion = Boolean(useReducedMotion());
  const utilityTriggerRefs = useRef<Partial<Record<CalendarUtility, HTMLButtonElement | null>>>({});
  const utilityCloseRef = useRef<HTMLButtonElement | null>(null);
  const returnUtilityFocusRef = useRef<CalendarUtility | null>(null);
  const dayContextTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resolvePeriodMetadata = useCallback(
    (date: string) => resolveCalendarPeriodMetadata(date, periodRecords),
    [periodRecords],
  );

  useEffect(() => {
    // Any PeriodRecordSheet mount (composer / cycle workspace) dispatches this event —
    // keep the Calendar-side records cache in sync so edit-mode metadata is fresh.
    const onPeriodRecordsUpdated = () => setPeriodRecords(loadPeriodRecords());
    window.addEventListener('period-records-updated', onPeriodRecordsUpdated);
    return () => window.removeEventListener('period-records-updated', onPeriodRecordsUpdated);
  }, []);

  // Workspace presentation is measured from the calendar workspace container
  // itself (not the browser viewport): the same stage width decides whether the
  // Day Inspector can dock beside the month pane. The observer attaches to the
  // frame (#app — fixed height, width-only signal) so the callback cannot feed
  // back through the stage's own content height; the stage width is read fresh
  // inside the callback.
  useEffect(() => {
    const node = workspaceRef.current;
    if (!node) return;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = node.getBoundingClientRect().width;
        const frameWidth = document.getElementById('app')?.getBoundingClientRect().width ?? width;
        setInspectorPresentation(width >= WIDE_WORKSPACE_MIN_WIDTH
          ? 'docked'
          : frameWidth <= FRAME_NARROW_MAX_WIDTH ? 'sheet' : 'floating');
      });
    };
    apply();
    const frameNode = document.getElementById('app');
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
    if (frameNode && observer) observer.observe(frameNode);
    else if (observer) observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    setActiveUtilityState(parseUtility(search.get('view') || search.get('tab')));
    const queryDate = search.get('date');
    if (queryDate) setSelectedDate(queryDate);
    if (search.get('action') === 'period') setPeriodEditorOpen(true);
  }, [location.search]);

  const setUtility = useCallback((utility: CalendarUtility | null, returnFocus = false) => {
    const previous = activeUtility;
    if (returnFocus && previous) returnUtilityFocusRef.current = previous;
    setActiveUtilityState(utility);
    const next = new URLSearchParams(location.search);
    next.set('date', selectedDate);
    next.delete('tab');
    if (utility) next.set('view', utility);
    else { next.delete('view'); next.delete('sub'); }
    navigate(`/calendar?${next.toString()}`, { replace: true });
  }, [activeUtility, location.search, navigate, selectedDate]);

  const selectUtility = useCallback((utility: CalendarUtility) => {
    // Docked Day Inspector is persistent: rail clicks switch modes, never close it.
    if (inspectorPresentation === 'docked') {
      if (activeUtility !== utility) setUtility(utility, false);
      return;
    }
    setUtility(activeUtility === utility ? null : utility, activeUtility === utility);
  }, [activeUtility, inspectorPresentation, setUtility]);

  const setUtilityRef = useRef(setUtility);
  useEffect(() => { setUtilityRef.current = setUtility; }, [setUtility]);

  const inspectorPresentationRef = useRef(inspectorPresentation);
  useEffect(() => { inspectorPresentationRef.current = inspectorPresentation; }, [inspectorPresentation]);

  useEffect(() => {
    if (!activeUtility) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A docked inspector is a persistent workspace pane — nothing to dismiss.
      if (inspectorPresentationRef.current === 'docked') return;
      // Inners first: while a nested modal surface (composer / dialog) is open it
      // absorbs Escape; the inspector closes on the following Escape. The full
      // canvas workspace keeps its own close control and does not consume this.
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not(#calendar-utility-panel):not(.calendar-canvas-workspace)')) return;
      setUtilityRef.current(null, true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeUtility]);

  // Focus the inspector close control when a dismissable presentation opens;
  // the docked pane is a tab-like switcher and keeps focus on the rail.
  useEffect(() => {
    if (!inspectorUtility || inspectorPresentation === 'docked') return;
    window.requestAnimationFrame(() => utilityCloseRef.current?.focus());
  }, [inspectorUtility, inspectorPresentation]);

  useEffect(() => {
    if (activeUtility || !returnUtilityFocusRef.current) return;
    const utility = returnUtilityFocusRef.current;
    returnUtilityFocusRef.current = null;
    const frame = window.requestAnimationFrame(() => utilityTriggerRefs.current[utility]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeUtility]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    const next = new URLSearchParams(location.search);
    next.set('date', date);
    navigate(`/calendar?${next.toString()}`, { replace: true });
  }, [location.search, navigate]);

  const todoCounts = useMemo(
    () => mapCounts(quests, getQuestDateKey, (quest) => quest.status !== 'completed' && quest.status !== 'archived'),
    [quests],
  );
  const calendarEventCounts = useMemo(
    () => mapCounts(customEvents, (event) => event.date),
    [customEvents],
  );

  const moodScores = useMemo(() => {
    const scores = new Map<string, number>();
    const moodMap: Record<string, string> = { joy: 'joy', calm: 'calm', tired: 'tired', anxious: 'anxious', blank: 'blank' };
    const entries = new Map<string, string[]>();
    for (const mem of memoryEntries) {
      const date = localDateKey(new Date(mem.createdAt));
      const tag = mem.anxietyLevel >= 7 ? 'meltdown' : mem.anxietyLevel >= 5 ? 'angry' : mem.anxietyLevel >= 3 ? 'joy' : 'tired';
      const arr = entries.get(date) || [];
      if (!arr.includes(tag)) arr.push(tag);
      entries.set(date, arr);
    }
    for (const diary of diaryEntries) {
      const tag = moodMap[diary.mood || 'blank'] || 'blank';
      const arr = entries.get(diary.date) || [];
      if (!arr.includes(tag)) arr.push(tag);
      entries.set(diary.date, arr);
    }
    for (const track of music.tracks) {
      const date = localDateKey(new Date(track.createdAt));
      const arr = entries.get(date) || [];
      if (!arr.includes('music')) arr.push('music');
      entries.set(date, arr);
    }
    for (const [date, tags] of entries) {
      let score = 0;
      for (const tag of tags) {
        if (tag === 'joy' || tag === 'music') score += 1;
        else if (tag === 'calm') score += 0.5;
        else if (tag === 'tired' || tag === 'blank') score -= 0.5;
        else if (tag === 'anxious' || tag === 'angry') score -= 1;
        else if (tag === 'meltdown') score -= 1.5;
      }
      scores.set(date, score);
    }
    return scores;
  }, [memoryEntries, diaryEntries, music.tracks]);

  const dayQuests = useMemo(() => quests.filter((quest) => getQuestDateKey(quest) === selectedDate && quest.status !== 'archived'), [quests, selectedDate]);
  const dayEvents = useMemo(() => getEventsByDate(customEvents, selectedDate), [customEvents, selectedDate]);

  const { weekdayLabel } = formatSelectedDate(selectedDate);
  // Day Inspector header context — derived once from the canonical selectedDate
  // with the calendar-core adapters (formatSelectedDate + approximateLunarDate);
  // the inspector never keeps its own date state.
  const inspectorDateContext = useMemo<InspectorDateContext>(() => ({
    dateKey: selectedDate,
    primary: formatDateLabel(selectedDate),
    weekday: weekdayLabel,
    iso: selectedDate.replaceAll('-', '.'),
    lunar: approximateLunarDate(selectedDate)?.label ?? null,
  }), [selectedDate, weekdayLabel]);
  const selectedPeriod = useMemo(() => resolvePeriodMetadata(selectedDate), [resolvePeriodMetadata, selectedDate]);
  const selectedPeriodRecord = useMemo(() => periodRecords.find((record) => record.id === selectedPeriod.recordId) ?? null, [periodRecords, selectedPeriod.recordId]);

  const openSheet = useCallback((sheet: Exclude<CalendarSheet, null>) => {
    setDayActionOpen(false);
    setEditingCalendarEvent(null);
    setActiveSheet(sheet);
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
    setEditingCalendarEvent(null);
    if (location.search.includes('action=')) navigate('/calendar', { replace: true });
    window.requestAnimationFrame(() => dayContextTriggerRef.current?.focus());
  }, [location.search, navigate]);

  const closeInspector = useCallback(() => setUtility(null, true), [setUtility]);

  const saveCalendarEvent = useCallback((payload: Omit<CalendarEvent, 'id'>) => {
    if (editingCalendarEvent) updateCalendarEvent(editingCalendarEvent.id, payload);
    else addCalendarEvent(payload);
    closeSheet();
  }, [editingCalendarEvent, updateCalendarEvent, addCalendarEvent, closeSheet]);

  const deleteCurrentCalendarEvent = useCallback(() => {
    if (editingCalendarEvent) deleteCalendarEvent(editingCalendarEvent.id);
    closeSheet();
  }, [editingCalendarEvent, deleteCalendarEvent, closeSheet]);

  const closeDayContext = useCallback(() => {
    setDayActionOpen(false);
    window.requestAnimationFrame(() => dayContextTriggerRef.current?.focus());
  }, []);

  const openDayContext = useCallback((date: string, trigger: HTMLButtonElement) => {
    dayContextTriggerRef.current = trigger;
    selectDate(date);
    setDayActionOpen(true);
  }, [selectDate]);

  return (
    <section id="calendar-view" className="view timehub-view" data-clawd-anchor="calendar">
      <header className="timehub-header">
        <BackButton to="/" />
        <div className="timehub-title-block">
          <h1>日曆</h1>
        </div>
      </header>

      <div className="calendar-main-stage" data-testid="calendar-main-stage" data-calendar-workspace={inspectorPresentation} ref={workspaceRef}>
      <Card className="timehub-calendar-card">
        <CalendarView
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelectDate={selectDate}
          onOpenDayContext={openDayContext}
          moodScores={moodScores}
          todoCounts={todoCounts}
          eventCounts={calendarEventCounts}
          resolvePeriodMetadata={resolvePeriodMetadata}
          holidayRegion={holidayRegion}
        />
      </Card>

      <PeriodRecordSheet open={periodEditorOpen} date={selectedDate} record={selectedPeriodRecord} onClose={() => { setPeriodEditorOpen(false); if (location.search.includes('action=')) navigate(`/calendar?date=${selectedDate}`, { replace: true }); window.requestAnimationFrame(() => dayContextTriggerRef.current?.focus()); }} onChanged={setPeriodRecords}/>

      <DayInspector
        presentation={inspectorPresentation}
        utility={inspectorUtility}
        dateContext={inspectorDateContext}
        reduceMotion={reduceMotion}
        triggerRefs={utilityTriggerRefs}
        closeRef={utilityCloseRef}
        onSelect={selectUtility}
        onClose={closeInspector}
      >
      {inspectorUtility === 'schedule' && (
        <div className="timehub-board" id="calendar-workspace-schedule" role="tabpanel" aria-label="日程">
          <div className="timehub-board-head">
            <div>
              <h2>當日日程</h2>
              <p>{dayEvents.length} 筆日程</p>
            </div>
            <button type="button" className="timehub-primary-btn" onClick={() => openSheet('entry')}>新增日程</button>
          </div>
          {dayEvents.length === 0
            ? <p className="timehub-empty-line">這一天還沒有日程。</p>
            : dayEvents.map((event) => <EventHubCard key={event.id} event={event} onOpen={() => { setEditingCalendarEvent(event); setActiveSheet('entry'); }} />)}
          <CalendarTodoList key={selectedDate} quests={dayQuests} />
          <HolidayCountdownSection selectedDate={selectedDate} />
          {/* C4 — the Day Inspector projects the countdowns bound to the SELECTED
              date, not the global dashboard. With nothing bound to this day the
              whole section is hidden (no large empty state). The global list
              stays on Home and /calendar/countdowns. */}
          {countdownHydrated === 'ready' && dayCountdowns.length > 0 && (
            <>
              <div className="countdown-section-header">
                <div className="countdown-section-header-left">
                  <h2>重要日</h2>
                  <p>生日、紀念日與重要時刻</p>
                </div>
                <div className="countdown-section-header-right">
                  <span className="countdown-section-count">{`${dayCountdowns.length} 個事件`}</span>
                  <button type="button" className="timehub-primary-btn" onClick={() => setEditingCountdown('new')}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    新建
                  </button>
                </div>
              </div>
              <CountdownSection
                scopeDate={selectedDate}
                onCreate={() => setEditingCountdown('new')}
                onEdit={(event) => setEditingCountdown(event)}
                showCreateButton={false}
              />
            </>
          )}
        </div>
      )}

      {inspectorUtility === 'canvas' && <CalendarDayCanvas dateKey={selectedDate} />}

      {inspectorUtility === 'body' && (
        <div className="timehub-board" id="calendar-workspace-body" role="tabpanel" aria-label="身體">
          <BodyWorkspace selectedDate={selectedDate} />
        </div>
      )}

      {inspectorUtility === 'life' && (
        <div className="life-tools-stage" id="calendar-workspace-life" role="tabpanel" aria-label="生活">
          <LifeWorkspace />
        </div>
      )}
      </DayInspector>
      </div>

      {editingCountdown !== null && (
        <CountdownEditorSheet
          event={editingCountdown === 'new' ? null : editingCountdown}
          defaultDate={selectedDate}
          onClose={() => setEditingCountdown(null)}
        />
      )}

      {dayActionOpen && (
        <DayActionWindow
          date={selectedDate}
          onClose={closeDayContext}
          scheduleCount={dayEvents.length}
          todoCount={dayQuests.length}
          periodSummary={selectedPeriod.actualPeriodDay ? `第 ${selectedPeriod.actualPeriodDay} 天` : selectedPeriodRecord ? '已有紀錄' : null}
          onAddEntry={() => openSheet('entry')}
          onRecordPeriod={() => { setDayActionOpen(false); setPeriodEditorOpen(true); }}
        />
      )}

      {activeSheet === 'entry' && (
        <CalendarEventSheet
          defaultDate={selectedDate}
          event={editingCalendarEvent}
          onClose={closeSheet}
          onSave={saveCalendarEvent}
          onDelete={deleteCurrentCalendarEvent}
        />
      )}

    </section>
  );
}

function EventHubCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return (
    <article className="timehub-item timehub-event-card">
      <button type="button" className="timehub-item-main" onClick={onOpen}>
        <span className="timehub-item-kicker">日程 · {CALENDAR_CATEGORY_LABEL[event.category || 'general']} <em className={`calendar-author-mark is-${event.author || 'user'}`}>{(event.author || 'user').toUpperCase()}</em></span>
        <strong>{event.title || '未命名日程'}</strong>
        <small>{event.date}{event.startTime ? ` · ${event.startTime}` : event.isAllDay ? ' · 全天' : ''}</small>
        {(event.note || event.description) && <span className="timehub-event-note">{event.note || event.description}</span>}
      </button>
    </article>
  );
}
