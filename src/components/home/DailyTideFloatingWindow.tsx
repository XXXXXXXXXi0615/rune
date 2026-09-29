import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useTideRailStore, type TideRailTab } from '@/store/useTideRailStore';
import { HydrationTabContent } from '@/components/home/HydrationTabContent';
import { DailyMoodBar } from '@/components/home/DailyMoodBar';
import { UsageStatusContent } from '@/components/usage/UsageControlPanel';
import '@/styles/dailytide.css';
import { getMonthlyAttendance, selectLatestMissedDate } from '@/features/tideclock/tideclockEngine';
import { buildCheckInCopy } from '@/features/tideclock/checkInCopy';
import { buildMissedConsequenceCopy, shouldPresentMissedConsequence } from '@/features/tideclock/checkInConsequence';
import { useCheckInReconcile } from '@/features/tideclock/useCheckInReconcile';
import { ritualMarkVariant } from '@/features/home/dailyRitualPresentation';
import {
  DEFAULT_WINDOW_WIDTH,
  KEYBOARD_RESIZE_STEP,
  KEYBOARD_RESIZE_STEP_LARGE,
  clampMaxHeight,
  clampWidth,
  defaultMaxHeightFor,
  parseGeometry,
  serializeGeometry,
  type WindowGeometry,
  type WindowSize,
} from '@/features/home/windowGeometry';
import { useAppDialogBehavior } from '@/components/ui/AppPrimitives';
import { toLocalDateString } from '@/utils/date';

/* ── Persistent geometry ──
   One key, one writer. Payload: { x, y, width?, maxHeight? }; legacy { x, y }
   payloads stay readable and a missing size falls back to the defaults. */
const POS_KEY = 'lunartide-daily-tide-window-position';

function currentViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function loadGeometry(): WindowGeometry | null {
  try {
    return parseGeometry(localStorage.getItem(POS_KEY), currentViewport());
  } catch { /* noop */ }
  return null;
}

function persistGeometry(geometry: WindowGeometry) {
  try { localStorage.setItem(POS_KEY, serializeGeometry(geometry)); } catch { /* noop */ }
}

/* ── Clamp to viewport ── */
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

/* ── Desktop window geometry ──
   640px is the default desktop width (mirrored in .dt-window CSS); the height
   is content-driven, so clamp/drag/resize math measures the live element instead
   of assuming a fixed box. The user's maxHeight is a cap, never a fixed height. */
function desktopWidth(vw: number) { return Math.min(DEFAULT_WINDOW_WIDTH, vw - 32); }

/** Default desktop placement in the viewport's right gutter. */
function defaultPanelPosition(size: { width: number; height: number }) {
  const vw = window.innerWidth;
  const flushRight = vw - size.width - 24;
  return { x: clamp(flushRight, 12, Math.max(12, vw - size.width - 12)), y: 80 };
}

/* ── SVG Icons ── */
function HeatmapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="13" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="3" width="20" height="18" rx="3" />
      <path d="M2 9h20" />
      <circle cx="18" cy="15" r="3" />
      <path d="M17 15l1 1 2-2" strokeWidth="1.5" />
    </svg>
  );
}

function WaterIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 2.7c3.2 3.9 6 7.2 6 10.3a6 6 0 1 1-12 0c0-3.1 2.8-6.4 6-10.3z" /></svg>;
}

/* ── Rune Terminal chrome (presentation only: identity label + static scanlines) ── */
function TerminalChrome() {
  return (
    <div className="dt-term-chrome" aria-hidden="true">
      <span className="dt-term-chrome__led" />
      <span className="dt-term-chrome__name">RUNE STATUS</span>
      <span className="dt-term-chrome__log">DAILY LOG</span>
    </div>
  );
}

function TerminalScanlines() {
  return <div className="dt-term-scanlines" aria-hidden="true" />;
}

/* ── Check-in Tab (month heatmap + streak + receipt) ── */
function CheckInTabContent() {
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const records = useCheckInStore((s) => s.records);
  const clockIn = useCheckInStore((s) => s.clockIn);
  const todayRecord = getTodayStatus();
  const isDone = !!todayRecord;
  const streak = getCurrentPerfectStreak();
  const monthly = getMonthlyAttendance(records);
  const monthlyChecked = Object.values(monthly).filter((s) => s === 'completed' || s === 'late').length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const [reporting, setReporting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const acknowledgeMissedConsequence = useCheckInStore((s) => s.acknowledgeMissedConsequence);
  const acknowledgedMissedDate = useCheckInStore((s) => s.acknowledgedMissedDate);
  // One presentation decision per panel entry — shown once per unacknowledged missed day.
  const [consequenceDate] = useState<string | null>(() => {
    const latest = selectLatestMissedDate(records);
    return shouldPresentMissedConsequence({ latestMissedDate: latest, acknowledgedMissedDate, hasTodayRecord: isDone }) ? latest : null;
  });
  const [consequenceClosed, setConsequenceClosed] = useState(false);
  useEffect(() => {
    if (consequenceDate) acknowledgeMissedConsequence(consequenceDate);
  }, [consequenceDate, acknowledgeMissedConsequence]);
  const consequenceCopy = consequenceDate ? buildMissedConsequenceCopy(consequenceDate) : null;
  const showConsequence = consequenceCopy !== null && !consequenceClosed && !isDone;

  const handleReport = useCallback(() => {
    if (isDone || reporting) return;
    setReporting(true);
    try {
      clockIn();
    } finally {
      setReporting(false);
    }
  }, [isDone, reporting, clockIn]);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();

  const monthDays: (number | null)[] = [];
  const firstDay = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDay; i++) monthDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthDays.push(d);

  const monthTitle = `${year} 年 ${month + 1} 月`;

  const missedDays: string[] = [];
  for (let d = 1; d < todayDay; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = monthly[dateStr];
    if (!status || status === 'makeup_required') missedDays.push(dateStr);
  }
  const missedCount = missedDays.length;

  const dynamicCopy = buildCheckInCopy({
    monthly,
    isDoneToday: isDone,
    isTodayLate: !!todayRecord?.isLate,
    missedDays,
    now,
  });

  return (
    <div className="dt-dock-content dt-checkin-content">
      {isDone && todayRecord ? (
        <div className="dt-status-summary" data-testid="report-today-result">
          <strong>✓ 今日已報備</strong>
          <time>{todayRecord.clockInAt ? `${String(new Date(todayRecord.clockInAt).getHours()).padStart(2, '0')}:${String(new Date(todayRecord.clockInAt).getMinutes()).padStart(2, '0')}` : '--:--'}</time>
          <span data-testid="report-streak">連續 {Math.max(streak, isDone ? 1 : 0)} 天</span>
        </div>
      ) : (
        <div className="dt-status-summary" data-testid="report-today-pending">
          <strong>今日未報備</strong><time>{timeStr}</time><span data-testid="report-streak">連續 {Math.max(streak, isDone ? 1 : 0)} 天</span>
          <button type="button" className="dt-report-btn" onClick={handleReport} disabled={reporting} data-testid="report-action">{reporting ? '報備中…' : '報備'}</button>
        </div>
      )}
      {showConsequence && consequenceCopy && (
        <div className="dt-consequence" data-testid="checkin-consequence" role="status">
          <button
            type="button"
            className="dt-consequence__close"
            data-testid="checkin-consequence-close"
            aria-label="關閉漏簽提醒"
            onClick={() => setConsequenceClosed(true)}
          >×</button>
          <div className="dt-consequence__head">
            <span className="dt-consequence__mark" aria-hidden="true">×</span>
            <strong>{consequenceCopy.label}</strong>
          </div>
          <p className="dt-consequence__voice">{consequenceCopy.voice}</p>
          <small className="dt-consequence__hint">{consequenceCopy.hint}</small>
        </div>
      )}

      <div className="dt-panel-section">
        <div className="dt-calendar-head">
          <div className="dt-panel-section-title dt-panel-month-title">{monthTitle}</div>
          <div className="dt-calendar-metrics" data-testid="report-stats">
            <span data-testid="report-monthly">本月 {monthlyChecked} 次</span>
            <span data-testid="report-missed">漏簽 {missedCount} 天</span>
          </div>
        </div>
        {selectedDate && (() => {
          const selected = records.find((record) => record.kind === 'clock_in' && record.date === selectedDate);
          const status = monthly[selectedDate];
          const isSelectedToday = selectedDate === `${year}-${String(month + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
          const selectedTime = selected?.clockInAt
            ? `${String(new Date(selected.clockInAt).getHours()).padStart(2, '0')}:${String(new Date(selected.clockInAt).getMinutes()).padStart(2, '0')}`
            : '--:--';
          const selectedStatus = isSelectedToday
            ? status === 'late' ? '遲到' : status === 'completed' ? '已報備' : '未報備'
            : status === 'late' ? '遲到'
            : status === 'completed' ? '準時'
            : selectedDate > `${year}-${String(month + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}` ? '尚未到來' : '漏簽';
          return <div className="dt-calendar-selection" data-testid="report-selected-date" aria-live="polite"><strong>{isSelectedToday ? '今天' : selectedDate}</strong><time>{selectedTime}</time><span>{selectedStatus}</span></div>;
        })()}
        <div className="dt-honeycomb-heatmap" data-testid="report-calendar" aria-label={`${monthTitle}報備熱力圖`}>
          <div className="dt-honeycomb-weekdays" aria-hidden="true">
            {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
              <div key={w} className="dt-calendar-weekday">{w}</div>
            ))}
          </div>
          {Array.from({ length: Math.ceil(monthDays.length / 7) }, (_, week) => (
            <div className="dt-honeycomb-week" key={week} data-week={week}>
              {monthDays.slice(week * 7, week * 7 + 7).map((d, weekday) => {
            const i = week * 7 + weekday;
            if (d === null) return <div key={`e${i}`} className="dt-calendar-cell dt-calendar-cell--empty" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = monthly[dateStr];
            const isToday = d === todayDay;
            const isLate = status === 'late';
            const isChecked = status === 'completed' || isLate;
            const isMissed = status === 'makeup_required';
            return (
              <CalendarCell
                key={dateStr}
                day={d}
                dateKey={dateStr}
                isToday={isToday}
                selected={selectedDate === dateStr}
                onSelect={() => setSelectedDate(dateStr)}
                isChecked={isChecked}
                isLate={isLate}
                isMissed={isMissed}
                isFuture={d > todayDay}
              />
            );
              })}
            </div>
          ))}
        </div>
        <div className="dt-calendar-legend" aria-label="圖例">
          <span className="dt-legend-item">
            <svg className="dt-legend-svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill="none" stroke="var(--teal)" strokeWidth="1.4" />
            </svg>
            今天
          </span>
          <span className="dt-legend-item">
            <svg className="dt-legend-svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="var(--dt-term-ok, var(--red-mark))" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            已報備
          </span>
          <span className="dt-legend-item">
            <svg className="dt-legend-svg" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <line x1="3" y1="3" x2="11" y2="11" stroke="var(--red-mark)" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="11" y1="3" x2="3" y2="11" stroke="var(--red-mark)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            漏簽
          </span>
        </div>
      </div>
      {!isDone && <div className="dt-panel-copy" data-testid="report-note" aria-live="polite">{dynamicCopy}</div>}
      <DailyMoodBar dateKey={selectedDate ?? toLocalDateString(now)} todayKey={toLocalDateString(now)} />
    </div>
  );
}

/** Month heatmap date button; the canonical status and accessible date stay intact. */
function CalendarCell({
  day,
  dateKey,
  isToday,
  selected,
  onSelect,
  isChecked,
  isLate,
  isMissed,
  isFuture,
}: {
  day: number;
  dateKey: string;
  isToday: boolean;
  selected: boolean;
  onSelect: () => void;
  isChecked: boolean;
  isLate: boolean;
  isMissed: boolean;
  isFuture: boolean;
}) {
  const variant = ritualMarkVariant(dateKey);
  const classes = ['dt-calendar-cell'];
  if (isToday) classes.push('dt-calendar-cell--today');
  if (isChecked) classes.push('dt-calendar-cell--checked');
  if (isLate) classes.push('dt-calendar-cell--late');
  if (isMissed) classes.push('dt-calendar-cell--missed');
  if (isFuture) classes.push('dt-calendar-cell--future');
  if (isToday && isChecked) classes.push('dt-calendar-cell--today-checked');
  if (isToday && isMissed) classes.push('dt-calendar-cell--today-missed');

  return (
    <button type="button" className={classes.join(' ')} onClick={onSelect} aria-pressed={selected} aria-label={`${dateKey} ${isFuture ? '尚未到來' : isLate ? '遲到' : isChecked ? '已報備' : isMissed ? '漏簽' : '未報備'}`} data-date-key={dateKey} data-date-state={isFuture ? 'future' : isToday ? 'today' : isLate ? 'late' : isChecked ? 'completed' : isMissed ? 'missed' : 'ordinary'} style={{ '--mark-rotate': `${variant.rotation}deg`, '--mark-offset': `${variant.offset}px` } as React.CSSProperties}>
      <svg className="dt-honeycomb-frame" viewBox="0 0 48 44" aria-hidden="true"><polygon points="12,1 36,1 47,22 36,43 12,43 1,22" /></svg>
      <span className="dt-calendar-cell-num">{day}</span>
      {isChecked && !isToday && (
        <svg
          className="dt-calendar-cell-mark"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--dt-term-ok, var(--red-mark, #d34a4a))"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="55 4"
          />
        </svg>
      )}
      {isMissed && !isToday && (
        <svg
          className="dt-calendar-cell-mark"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <line x1="6" y1="6" x2="18" y2="18" stroke="var(--red-mark, #d34a4a)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="18" y1="6" x2="6" y2="18" stroke="var(--red-mark, #d34a4a)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {isToday && isChecked && (
        <svg
          className="dt-calendar-cell-mark dt-calendar-cell-mark--today-checked"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8.4"
            fill="none"
            stroke="var(--dt-term-ok, var(--red-mark, #d34a4a))"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="50 4"
          />
        </svg>
      )}
      {isToday && isMissed && (
        <svg
          className="dt-calendar-cell-mark dt-calendar-cell-mark--today-missed"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
        >
          <line x1="7" y1="7" x2="17" y2="17" stroke="var(--red-mark, #d34a4a)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="17" y1="7" x2="7" y2="17" stroke="var(--red-mark, #d34a4a)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export function TodayStatusFloat() {
  // Idempotent day-close reconcile — independent of whether this window is open.
  useCheckInReconcile();
  const isOpen = useTideRailStore((s) => s.isWindowOpen);
  const storedTab = useTideRailStore((s) => s.activeTab);
  const [tab, setTab] = useState<'checkin' | 'hydration' | 'usage'>(storedTab);
  const [visitedTabs, setVisitedTabs] = useState<Array<'checkin' | 'hydration' | 'usage'>>([storedTab]);
  const openingTriggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => { if (isOpen) setVisitedTabs((previous) => previous.includes(tab) ? previous : [...previous, tab]); }, [isOpen, tab]);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const { tab: initialTab, trigger } = (event as CustomEvent<{ tab: 'checkin' | 'hydration' | 'usage'; trigger: HTMLElement }>).detail;
      openingTriggerRef.current = trigger;
      setTab(initialTab);
    };
    window.addEventListener('today-status-open', onOpen);
    return () => window.removeEventListener('today-status-open', onOpen);
  }, []);
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current && !openingTriggerRef.current) openingTriggerRef.current = document.activeElement as HTMLElement;
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const trigger = openingTriggerRef.current;
    openingTriggerRef.current = null;
    requestAnimationFrame(() => {
      if (trigger?.isConnected && trigger.getClientRects().length && !trigger.matches(':disabled') && !trigger.closest('[hidden], [inert], [aria-hidden="true"]')) trigger.focus();
    });
  }, [isOpen]);
  useEffect(() => { if (isOpen && storedTab === 'hydration') setTab('hydration'); }, [isOpen, storedTab]);
  const onClose = useTideRailStore((s) => s.closeWindow);
  const setActiveTab = useTideRailStore((s) => s.setActiveTab);
  const switchTab = (next: 'checkin' | 'hydration' | 'usage') => { setTab(next); if (next !== 'usage') setActiveTab(next); };
  const tabContent = <>
    {visitedTabs.includes('checkin') && <div hidden={tab !== 'checkin'}><CheckInTabContent /></div>}
    {visitedTabs.includes('hydration') && <div hidden={tab !== 'hydration'}><HydrationTabContent /></div>}
    {visitedTabs.includes('usage') && <div hidden={tab !== 'usage'}><UsageStatusContent onOpenLockSettings={(trigger) => window.dispatchEvent(new CustomEvent('today-status-lock-settings', { detail: trigger }))} /></div>}
  </>;
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [size, setSize] = useState<WindowSize>(() => {
    const saved = typeof window !== 'undefined' ? loadGeometry() : null;
    return { width: saved?.width ?? DEFAULT_WINDOW_WIDTH, maxHeight: saved?.maxHeight ?? null };
  });
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadGeometry();
    if (saved) return { x: saved.x, y: saved.y };
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    return typeof window !== 'undefined'
      ? defaultPanelPosition({ width: desktopWidth(vw), height: 360 })
      : { x: 12, y: 80 };
  });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragSize = useRef({ width: 0, height: 0 });
  const resizing = useRef(false);
  const resizeStart = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0, size: { width: DEFAULT_WINDOW_WIDTH, maxHeight: null } as WindowSize });
  const resizePointerId = useRef<number | null>(null);
  const resizeHandleRef = useRef<HTMLButtonElement>(null);
  const cancelResizeRef = useRef<() => void>(() => undefined);
  /** Latest committed size for pointer/keyboard handlers (assigned during render). */
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const windowRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useAppDialogBehavior(isOpen && isMobile, onClose);
  const hadSavedPosition = useRef(typeof window !== 'undefined' && loadGeometry() !== null);
  /** The user's size intent, resolved against the current viewport. */
  const resolveSize = useCallback((next: WindowSize, anchorY: number): WindowSize => ({
    width: clampWidth(next.width, window.innerWidth),
    maxHeight: next.maxHeight === null ? null : clampMaxHeight(next.maxHeight, window.innerHeight, anchorY),
  }), []);

  /** Live box of the floating window (content-driven height, so never assumed). */
  const measureWindow = useCallback(() => {
    const rect = windowRef.current?.getBoundingClientRect();
    return {
      width: rect && rect.width > 0 ? rect.width : desktopWidth(window.innerWidth),
      height: rect && rect.height > 0 ? rect.height : 320,
    };
  }, []);
  const placeInViewport = useCallback((x: number, y: number, size: { width: number; height: number }) => ({
    x: clamp(x, 12, Math.max(12, window.innerWidth - size.width - 12)),
    y: clamp(y, 12, Math.max(12, window.innerHeight - size.height - 12)),
  }), []);

  // Responsive check — the shell type is re-synced on every open so a viewport
  // change while the float was closed can never leave a stale desktop/mobile shell.
  useEffect(() => {
    if (!isOpen) return;
    setIsMobile(window.innerWidth < 768);
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [isOpen]);

  // Re-clamp on resize/orientationchange
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const reclamp = () => setPos((p) => {
      const next = placeInViewport(p.x, p.y, measureWindow());
      persistGeometry({ ...next, width: size.width, maxHeight: size.maxHeight });
      return next;
    });
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [isOpen, isMobile, measureWindow, placeInViewport, size.width, size.maxHeight]);
  useEffect(() => {
    if (!isOpen || isMobile) return;
    if (!hadSavedPosition.current) {
      // First entry with no stored position: place the default, clear of the utility rail.
      const next = defaultPanelPosition(measureWindow());
      hadSavedPosition.current = true;
      setPos(next);
      persistGeometry({ ...next, width: size.width, maxHeight: size.maxHeight });
      return;
    }
    setPos((current) => placeInViewport(current.x, current.y, measureWindow()));
    // Runs once per open; size changes are handled by the size-clamp effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isMobile, measureWindow, placeInViewport]);

  // A resized shell must stay inside the viewport (right/bottom edges included):
  // re-run the canonical placement once the DOM reflects the new size.
  const clampedForSize = useRef('');
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const key = `${size.width}x${size.maxHeight ?? 'auto'}`;
    if (clampedForSize.current === key) return;
    clampedForSize.current = key;
    setPos((current) => {
      const next = placeInViewport(current.x, current.y, measureWindow());
      if (next.x !== current.x || next.y !== current.y) persistGeometry({ ...next, width: size.width, maxHeight: size.maxHeight });
      return next;
    });
  }, [isOpen, isMobile, size, measureWindow, placeInViewport]);

  // Keyboard close for the desktop window. Escape during an active resize cancels
  // the gesture (restores the drag-start geometry) instead of closing the window.
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (resizing.current) {
        cancelResizeRef.current();
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isMobile, onClose]);

  // The mobile sheet is portalled outside #root, so the application shell can
  // be isolated without making the dialog itself inert.
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const appRoot = document.getElementById('root');
    if (!appRoot) return;
    const hadInert = appRoot.hasAttribute('inert');
    const previousAriaHidden = appRoot.getAttribute('aria-hidden');
    appRoot.setAttribute('inert', '');
    appRoot.setAttribute('aria-hidden', 'true');
    document.body.classList.add('dt-mobile-modal-open');
    return () => {
      if (!hadInert) appRoot.removeAttribute('inert');
      if (previousAriaHidden === null) appRoot.removeAttribute('aria-hidden');
      else appRoot.setAttribute('aria-hidden', previousAriaHidden);
      document.body.classList.remove('dt-mobile-modal-open');
    };
  }, [isOpen, isMobile]);

  // Drag handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from header area — never from controls or the resize handle.
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [role="button"], [role="tab"], [data-dt-resize]')) return;
    dragging.current = true;
    dragSize.current = measureWindow();
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, [pos, measureWindow]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const next = placeInViewport(dragStart.current.px + dx, dragStart.current.py + dy, dragSize.current);
    setPos(next);
  }, [placeInViewport]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    persistGeometry({ x: pos.x, y: pos.y, width: size.width, maxHeight: size.maxHeight });
  }, [pos, size.width, size.maxHeight]);

  /* ── Resize (Phase 1: bottom-right handle, desktop only) ──
     Size is intent-in-state, resolved against the viewport (width clamp 360-720,
     max-height cap = min(72dvh, viewport - y - 12), floor 300) and written through
     the single geometry writer. The shell keeps height:auto + body scroll. */
  const applySize = useCallback((next: WindowSize, anchor: { x: number; y: number } = pos, persist = true) => {
    const resolved = resolveSize(next, anchor.y);
    sizeRef.current = resolved;
    setSize(resolved);
    if (persist) persistGeometry({ x: anchor.x, y: anchor.y, width: resolved.width, maxHeight: resolved.maxHeight });
    return resolved;
  }, [pos, resolveSize]);

  const cancelResize = useCallback(() => {
    if (!resizing.current) return;
    resizing.current = false;
    const handle = resizeHandleRef.current;
    const pointerId = resizePointerId.current;
    if (handle && pointerId !== null && handle.hasPointerCapture?.(pointerId)) {
      try { handle.releasePointerCapture(pointerId); } catch { /* noop */ }
    }
    resizePointerId.current = null;
    applySize(resizeStart.current.size, { x: resizeStart.current.x, y: resizeStart.current.y });
  }, [applySize]);
  cancelResizeRef.current = cancelResize;

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    // Never starts a window drag: separate element, explicit header guard, and the
    // gesture is captured on the handle itself.
    e.preventDefault();
    e.stopPropagation();
    dragging.current = false;
    resizing.current = true;
    resizePointerId.current = e.pointerId;
    resizeStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      x: pos.x,
      y: pos.y,
      size: { width: size.width, maxHeight: size.maxHeight },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos, size]);

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizing.current) return;
    const base = resizeStart.current;
    // A null cap means "the frozen 72dvh default": materialise it so the gesture
    // has a concrete starting height.
    const baseMaxHeight = base.size.maxHeight
      ?? clampMaxHeight(defaultMaxHeightFor(window.innerHeight), window.innerHeight, base.y);
    applySize({
      width: base.size.width + (e.clientX - base.pointerX),
      maxHeight: baseMaxHeight + (e.clientY - base.pointerY),
    }, { x: base.x, y: base.y });
  }, [applySize]);

  const onResizePointerUp = useCallback(() => {
    if (!resizing.current) return;
    resizing.current = false;
    resizePointerId.current = null;
    persistGeometry({ x: pos.x, y: pos.y, ...sizeRef.current });
  }, [pos.x, pos.y]);

  const onResizePointerCancel = useCallback(() => {
    cancelResize();
  }, [cancelResize]);

  const onResizeKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? KEYBOARD_RESIZE_STEP_LARGE : KEYBOARD_RESIZE_STEP;
    // Read the committed size from the ref so repeated keys never drop a step.
    const current = sizeRef.current;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      applySize({ ...current, width: current.width + (e.key === 'ArrowRight' ? step : -step) });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const base = current.maxHeight ?? clampMaxHeight(defaultMaxHeightFor(window.innerHeight), window.innerHeight, pos.y);
      applySize({ ...current, maxHeight: base + (e.key === 'ArrowDown' ? step : -step) });
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }, [applySize, pos.y]);

  const handleResetWindow = useCallback(() => {
    const next = defaultPanelPosition({ ...measureWindow(), width: DEFAULT_WINDOW_WIDTH });
    const reset: WindowSize = { width: DEFAULT_WINDOW_WIDTH, maxHeight: null };
    setPos(next);
    sizeRef.current = reset;
    setSize(reset);
    persistGeometry({ ...next, ...reset });
  }, [measureWindow]);
  const handleCenter = useCallback(() => {
    const box = measureWindow();
    const next = placeInViewport(
      Math.max(12, (window.innerWidth - box.width) / 2),
      Math.max(12, (window.innerHeight - box.height) / 2),
      box,
    );
    setPos(next);
    persistGeometry({ ...next, ...sizeRef.current });
  }, [measureWindow, placeInViewport]);

  if (!isOpen) return null;

  const tabs: { key: TideRailTab | 'usage'; label: string; icon: React.ReactNode }[] = [
    { key: 'checkin', label: '報備', icon: <CheckInIcon /> },
    { key: 'hydration', label: '飲水', icon: <WaterIcon /> },
    { key: 'usage', label: '使用', icon: <span aria-hidden="true">◷</span> },
  ];

  /* ── Mobile: Bottom Sheet ── */
  if (isMobile) {
    return (
      <>
        {createPortal(
      <div className="dt-sheet-overlay" onClick={onClose}>
        <div className="dt-sheet-backdrop" />
        <div ref={mobileDialogRef as React.RefObject<HTMLDivElement>} className="dt-sheet notranslate" translate="no" role="dialog" aria-modal="true" aria-label="今日狀態" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <div className="dt-sheet-handle" />
          <div className="dt-dock-header">
            <TerminalChrome />
            <div className="dt-dock-header-row">
              <div className="dt-dock-tabs">
                {tabs.map((t) => (
                  <button key={t.key} type="button" className={`dt-dock-tab${tab === t.key ? ' is-active' : ''}`}
                    onClick={() => switchTab(t.key)} aria-label={t.label} title={t.label} aria-pressed={tab === t.key}>
                    {t.icon}
                    <span className="dt-dock-tab-label">{t.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="dt-dock-close" onClick={onClose} aria-label="關閉">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
          <div className="dt-dock-body">
            {tabContent}
          </div>
          <TerminalScanlines />
        </div>
      </div>,
        document.body,
        )}
      </>
    );
  }

  /* ── Desktop: Floating Window ── */
  return (
    <>
      {createPortal(
    <div className="dt-window notranslate" translate="no" role="dialog" aria-label="今日狀態" ref={windowRef}
      data-resizable="true"
      style={{
        position: 'fixed',
        zIndex: 120,
        top: pos.y,
        left: pos.x,
        ['--dt-window-width' as string]: `${size.width}px`,
        ...(size.maxHeight === null ? {} : { ['--dt-window-max-height' as string]: `${size.maxHeight}px` }),
      }}
    >
      {/* Header (drag handle + terminal chrome + tabs + close) */}
      <div className="dt-dock-header" onDoubleClick={handleCenter} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <TerminalChrome />
        <div className="dt-dock-header-row">
          <div className="dt-dock-tabs">
            {tabs.map((t) => (
              <button key={t.key} type="button" className={`dt-dock-tab${tab === t.key ? ' is-active' : ''}`}
                onClick={() => switchTab(t.key)} aria-label={t.label} title={t.label} aria-pressed={tab === t.key}>
                {t.icon}
                <span className="dt-dock-tab-label">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="dt-dock-actions">
            <button type="button" className="dt-dock-reset" onClick={handleResetWindow} aria-label="重設視窗" title="重設視窗">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 1 9 9" /><path d="M3 3v6h6" /></svg>
            </button>
            <button type="button" className="dt-dock-close" onClick={onClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Body (scrollable content) */}
      <div className="dt-dock-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tabContent}
      </div>

      <TerminalScanlines />

      {/* Desktop-only resize handle (bottom-right corner, terminal language). */}
      <button
        type="button"
        className="dt-term-resize"
        data-dt-resize
        ref={resizeHandleRef}
        aria-label="調整視窗大小"
        title="調整視窗大小"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerCancel}
        onKeyDown={onResizeKeyDown}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M10.5 4.5 4.5 10.5M10.5 8.5l-2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

    </div>,
      document.body,
      )}
    </>
  );
}
