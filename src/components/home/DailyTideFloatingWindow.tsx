import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useAppStore } from '@/store/useAppStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useTideRailStore, type TideRailTab } from '@/store/useTideRailStore';
import { HydrationTabContent } from '@/components/home/HydrationTabContent';
import { MoonDewProgress } from '@/features/moon-dew/MoonDewProgress';
import { MoonDewAchievements } from '@/features/moon-dew/MoonDewAchievements';
import { getMoonDewProgression, MOON_DEW_LEVELS } from '@/features/moon-dew/getMoonDewProgression';
import { MOON_DEW_RULES } from '@/utils/moonDewEngine';
import '@/features/moon-dew/moondew.css';
import '@/styles/dailytide.css';
import { toLocalDateString } from '@/utils/date';
import { getMonthlyAttendance, selectLatestMissedDate } from '@/features/tideclock/tideclockEngine';
import { buildCheckInCopy } from '@/features/tideclock/checkInCopy';
import { buildMissedConsequenceCopy, shouldPresentMissedConsequence } from '@/features/tideclock/checkInConsequence';
import { useCheckInReconcile } from '@/features/tideclock/useCheckInReconcile';
import { ritualMarkVariant } from '@/features/home/dailyRitualPresentation';
import { useAppDialogBehavior } from '@/components/ui/AppPrimitives';

/* ── Persistent position ── */
const POS_KEY = 'lunartide-daily-tide-window-position';

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.x === 'number' && typeof v.y === 'number') return v;
  } catch { /* noop */ }
  return null;
}
function savePosition(x: number, y: number) {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch { /* noop */ }
}

/* ── Clamp to viewport ── */
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

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

/* ═══════════════════════════════════════════════════════════════
   報備 growth secondary surface (Phase D) — 潮階 / 成就 / 月印紀錄 / 規則.
   Presentation only: 潮階 + 成就 reuse the rehomed Moon Dew components
   (canonical data sources unchanged); the recent 月印 list reads the
   canonical ledger read-only.
   ═══════════════════════════════════════════════════════════════ */
function GrowthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const moonDewLedger = useAppStore((s) => s.moonDewLedger || []);

  const recent = useMemo(
    () => [...moonDewLedger]
      .filter((e) => e.source !== 'migration')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [moonDewLedger],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="dt-growth-overlay" onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        className="dt-growth-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="成長詳情"
        data-testid="report-growth-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dt-growth-header">
          <span className="dt-growth-title">成長</span>
          <button type="button" className="dt-growth-close" onClick={onClose} aria-label="關閉成長詳情">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </header>
        <div className="dt-growth-body">
          <section className="dt-growth-section" aria-label="潮階">
            <h3 className="dt-growth-section-title">潮階</h3>
            <MoonDewProgress />
          </section>
          <section className="dt-growth-section" aria-label="成就">
            <h3 className="dt-growth-section-title">成就</h3>
            <MoonDewAchievements />
          </section>
          <section className="dt-growth-section" aria-label="月印紀錄">
            <h3 className="dt-growth-section-title">月印紀錄</h3>
            {recent.length === 0 ? (
              <p className="dt-growth-empty">還沒有月印紀錄。</p>
            ) : (
              <ul className="dt-growth-entries" data-testid="report-moon-history">
                {recent.map((entry) => (
                  <li key={entry.id} className={`dt-growth-entry${entry.amount < 0 ? ' is-negative' : ''}`}>
                    <span className="dt-growth-entry__title">{entry.title}</span>
                    <span className="dt-growth-entry__date">
                      {new Date(entry.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="dt-growth-entry__amount">
                      {entry.amount > 0 ? `+${entry.amount}` : `${entry.amount}`} 月印
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="dt-growth-section" aria-label="規則">
            <h3 className="dt-growth-section-title">規則</h3>
            <ul className="dt-growth-rules" data-testid="report-moon-rules">
              <li>每日報備 +1–3 月印（依連續天數）</li>
              <li>完成一輪專注 +{MOON_DEW_RULES.focusCompleted} 月印</li>
              <li>專注時長獎勵：每 25 分鐘 +{MOON_DEW_RULES.focusDurationBonusPer25Min}（單輪上限 +{MOON_DEW_RULES.focusDurationBonusMax}）</li>
              <li>提前離開 {MOON_DEW_RULES.focusEarlyExit} · 放棄專注 {MOON_DEW_RULES.focusAbandoned} · 虛假專注 {MOON_DEW_RULES.focusFaking} 月印</li>
              <li>每日專注獲得上限 {MOON_DEW_RULES.dailyEarnCap} 月印 · 扣除上限 {MOON_DEW_RULES.dailyLossCap} 月印</li>
            </ul>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Check-in Tab (calendar + streak + receipt) ── */
function CheckInTabContent({ onOpenGrowth }: { onOpenGrowth: () => void }) {
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const records = useCheckInStore((s) => s.records);
  const clockIn = useCheckInStore((s) => s.clockIn);
  const todayRecord = getTodayStatus();
  const isDone = !!todayRecord;
  const streak = getCurrentPerfectStreak();
  const today = toLocalDateString();
  const monthly = getMonthlyAttendance(records);
  const monthlyChecked = Object.values(monthly).filter((s) => s === 'completed' || s === 'late').length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const moonDewLedger = useAppStore((s) => s.moonDewLedger || []);
  const focusSessions = useAppStore((s) => s.focusSessionLog || []);
  // Canonical streak flows straight from useCheckInStore (same value as above).
  const progression = useMemo(
    () => getMoonDewProgression(moonDewLedger, focusSessions, streak),
    [moonDewLedger, focusSessions, streak],
  );

  const [reporting, setReporting] = useState(false);
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

  const currentLevel = MOON_DEW_LEVELS.find((l) => l.level === progression.level);

  const quests = useQuestStore((s) => s.quests);
  const mainQuestByDate = useQuestStore((s) => s.mainQuestByDate);
  const mainQuest = quests.find((q) => q.id === mainQuestByDate[today]);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();

  const monthDays: (number | null)[] = [];
  const firstDay = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDay; i++) monthDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthDays.push(d);

  const dateDisplay = (() => {
    const wd = ['日', '一', '二', '三', '四', '五', '六'];
    return `${year}年${month + 1}月${todayDay}日 週${wd[now.getDay()]}`;
  })();

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
    <div className="dt-dock-content">
      <div className="dt-panel-date">{dateDisplay}</div>
      <div className="dt-panel-time">{timeStr}</div>

      <div className="dt-panel-streak-row" data-testid="report-stats">
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num" data-testid="report-streak">{isDone ? Math.max(streak, 1) : streak}</span>
          <span className="dt-panel-streak-label">連續天數</span>
        </div>
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num" data-testid="report-monthly">{monthlyChecked}</span>
          <span className="dt-panel-streak-label">本月報備</span>
        </div>
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num" data-testid="report-missed">{missedCount}</span>
          <span className="dt-panel-streak-label">漏簽天數</span>
        </div>
        <div className="dt-panel-streak-card dt-panel-streak-card--dew">
          <span className="dt-panel-streak-num" data-testid="report-moon-balance">{progression.currentBalance}</span>
          <span className="dt-panel-streak-label"><i aria-hidden="true" />月印餘額</span>
        </div>
      </div>

      <div className="dt-panel-copy" aria-live="polite">
        {dynamicCopy}
      </div>

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

      {/* 今日結果 — reward rows never render a “-0” deduction */}
      {isDone && todayRecord ? (
        <div className="dt-panel-section" data-testid="report-today-result">
          <div className="dt-tide-mark" data-testid="daily-tide-mark">
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17c4-7 14-9 19-2-2 8-12 12-19 6"/><path d="m12 17 3 3 6-7"/></svg>
            <span><strong>今日潮印</strong><small>今天被記下了。</small></span>
          </div>
          <div className="dt-panel-section-title">今日報備條</div>
          <div className="dt-panel-receipt">
            <div className="dt-receipt-row"><span>日期</span><span>{todayRecord.date}</span></div>
            <div className="dt-receipt-row">
              <span>報備時間</span>
              <span>{todayRecord.clockInAt ? `${String(new Date(todayRecord.clockInAt).getHours()).padStart(2, '0')}:${String(new Date(todayRecord.clockInAt).getMinutes()).padStart(2, '0')}` : '--:--'}</span>
            </div>
            <div className="dt-receipt-row">
              <span>狀態</span>
              <span className={todayRecord.isLate ? 'dt-text-late' : 'dt-text-ontime'}>{todayRecord.isLate ? '遲到' : '準時'}</span>
            </div>
            {progression.todayEarned > 0 && (
              <div className="dt-receipt-row" data-testid="report-today-earned">
                <span>獲得</span>
                <span className="dt-text-ontime">+{progression.todayEarned} 月印</span>
              </div>
            )}
            {progression.todayLost > 0 && (
              <div className="dt-receipt-row" data-testid="report-today-deducted">
                <span>今日扣除</span>
                <span className="dt-text-late">-{progression.todayLost} 月印</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="dt-panel-section" data-testid="report-today-pending">
          <button type="button" className="dt-report-btn" onClick={handleReport} disabled={reporting} data-testid="report-action">
            {reporting ? '報備中…' : '報備'}
          </button>
        </div>
      )}

      <div className="dt-panel-section">
        <div className="dt-panel-section-title dt-panel-month-title">{monthTitle}</div>
        <div className="dt-calendar-grid" data-testid="report-calendar">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <div key={w} className="dt-calendar-weekday">{w}</div>
          ))}
          {monthDays.map((d, i) => {
            if (d === null) return <div key={`e${i}`} className="dt-calendar-cell dt-calendar-cell--empty" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = monthly[dateStr];
            const isToday = d === todayDay;
            const isChecked = status === 'completed' || status === 'late';
            const isMissed = status === 'makeup_required';
            return (
              <CalendarCell
                key={dateStr}
                day={d}
                dateKey={dateStr}
                isToday={isToday}
                isChecked={isChecked}
                isMissed={isMissed}
                isFuture={d > todayDay}
              />
            );
          })}
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
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="var(--red-mark)" strokeWidth="1.4" strokeLinecap="round" />
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

      {/* 潮階 progression — compact strip, totals derive from the canonical ledger */}
      <div className="dt-panel-section">
        <div className="dt-panel-growth" data-testid="report-progression">
          <div className="dt-panel-growth__head">
            <span className="dt-panel-growth__label">
              潮階 · Lv{progression.level} {currentLevel?.title ?? progression.levelTitle}
            </span>
            <span className="dt-panel-growth__count">
              {progression.currentLevelStart}{progression.nextLevelTarget != null ? ` / ${progression.nextLevelTarget}` : ' · MAX'}
            </span>
          </div>
          <div className="moon-dew-progress-bar dt-panel-growth__bar">
            <div
              className="moon-dew-progress-bar__fill"
              style={{ width: `${Math.round(progression.levelProgress * 100)}%` }}
            />
          </div>
          <button type="button" className="dt-panel-growth__more" onClick={onOpenGrowth} data-testid="report-growth-open">
            查看成長
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 共用日曆格：today 圓環 + checked 紅圈 + missed 紅叉，可疊加
 */
function CalendarCell({
  day,
  dateKey,
  isToday,
  isChecked,
  isMissed,
  isFuture,
}: {
  day: number;
  dateKey: string;
  isToday: boolean;
  isChecked: boolean;
  isMissed: boolean;
  isFuture: boolean;
}) {
  const variant = ritualMarkVariant(dateKey);
  const classes = ['dt-calendar-cell'];
  if (isToday) classes.push('dt-calendar-cell--today');
  if (isChecked) classes.push('dt-calendar-cell--checked');
  if (isMissed) classes.push('dt-calendar-cell--missed');
  if (isFuture) classes.push('dt-calendar-cell--future');
  if (isToday && isChecked) classes.push('dt-calendar-cell--today-checked');
  if (isToday && isMissed) classes.push('dt-calendar-cell--today-missed');

  return (
    <div className={classes.join(' ')} data-date-key={dateKey} data-date-state={isFuture ? 'future' : isToday ? 'today' : isChecked ? 'completed' : isMissed ? 'missed' : 'ordinary'} style={{ '--mark-rotate': `${variant.rotation}deg`, '--mark-offset': `${variant.offset}px` } as React.CSSProperties}>
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
            stroke="var(--red-mark, #d34a4a)"
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
            stroke="var(--red-mark, #d34a4a)"
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
    </div>
  );
}

export function DailyTideFloatingWindow() {
  // Idempotent day-close reconcile — independent of whether this window is open.
  useCheckInReconcile();
  const isOpen = useTideRailStore((s) => s.isWindowOpen);
  const tab = useTideRailStore((s) => s.activeTab);
  const onClose = useTideRailStore((s) => s.closeWindow);
  const setActiveTab = useTideRailStore((s) => s.setActiveTab);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // Growth secondary surface state lives here so Escape closes the sheet before the window.
  const [growthOpen, setGrowthOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadPosition();
    if (saved) return saved;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    return { x: clamp(vw - 480, 12, vw - 12), y: clamp(80, 12, vh - 12) };
  });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  // An open growth sheet absorbs the dialog-level Escape/close first.
  const mobileDialogRef = useAppDialogBehavior(isOpen && isMobile, growthOpen ? () => setGrowthOpen(false) : onClose);

  const dismissTodayCheckIn = useCheckInStore((s) => s.dismissToday);
  const handleDismissToday = useCallback(() => {
    dismissTodayCheckIn();
    onClose();
  }, [dismissTodayCheckIn, onClose]);

  // Responsive check
  useEffect(() => {
    if (!isOpen) return;
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [isOpen]);

  // Re-clamp on resize/orientationchange
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const reclamp = () => setPos((p) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(460, vw - 24);
      const height = Math.min(540, vh - 32);
      const next = { x: clamp(p.x, 12, vw - width - 12), y: clamp(p.y, 12, vh - height - 12) };
      savePosition(next.x, next.y);
      return next;
    });
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [isOpen, isMobile]);
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const width = Math.min(460, window.innerWidth - 24);
    const height = Math.min(540, window.innerHeight - 32);
    setPos((current) => ({ x: clamp(current.x, 12, window.innerWidth - width - 12), y: clamp(current.y, 12, window.innerHeight - height - 12) }));
  }, [isOpen, isMobile]);

  // Keyboard close — an open growth sheet absorbs Escape first.
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (growthOpen) {
        setGrowthOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isMobile, growthOpen, onClose]);

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
    // Only drag from header area
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [role="button"], [role="tab"]')) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const winW = Math.min(460, vw - 24);
    const winH = Math.min(540, vh - 32);
    const nx = clamp(dragStart.current.px + dx, 12, vw - winW - 12);
    const ny = clamp(dragStart.current.py + dy, 12, vh - winH - 12);
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    savePosition(pos.x, pos.y);
  }, [pos]);

  const handleResetPosition = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newPos = { x: clamp(vw - 480, 12, vw - 12), y: clamp(80, 12, vh - 12) };
    setPos(newPos);
    savePosition(newPos.x, newPos.y);
  }, []);
  const handleCenter = useCallback(() => {
    const width = Math.min(460, window.innerWidth - 24);
    const height = Math.min(540, window.innerHeight - 32);
    const next = { x: Math.max(12, (window.innerWidth - width) / 2), y: Math.max(12, (window.innerHeight - height) / 2) };
    setPos(next); savePosition(next.x, next.y);
  }, []);

  if (!isOpen) return null;

  const tabs: { key: TideRailTab; label: string; icon: React.ReactNode }[] = [
    { key: 'checkin', label: '報備', icon: <CheckInIcon /> },
    { key: 'hydration', label: '今日飲水', icon: <WaterIcon /> },
  ];

  const renderFooter = () => tab === 'checkin' ? <>
    <button type="button" className="dt-dock-footer-btn dt-dock-footer-btn--ghost" onClick={handleDismissToday}>今天不再顯示</button>
    <button type="button" className="dt-dock-footer-btn dt-dock-footer-btn--done" onClick={onClose}>完成</button>
  </> : (
    <>
      <span className="dt-dock-footer-note" data-testid="hyd-autosave-note">設定已同步</span>
      <button type="button" className="dt-dock-footer-btn dt-dock-footer-btn--done" onClick={onClose}>關閉</button>
    </>
  );

  /* ── Mobile: Bottom Sheet ── */
  if (isMobile) {
    return (
      <>
        {createPortal(
      <div className="dt-sheet-overlay" onClick={onClose}>
        <div className="dt-sheet-backdrop" />
        <div ref={mobileDialogRef as React.RefObject<HTMLDivElement>} className="dt-sheet" role="dialog" aria-modal="true" aria-label="報備" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <div className="dt-sheet-handle" />
          <div className="dt-dock-header">
            <div className="dt-dock-tabs">
              {tabs.map((t) => (
                <button key={t.key} type="button" className={`dt-dock-tab${tab === t.key ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(t.key)} aria-label={t.label} title={t.label} aria-pressed={tab === t.key}>
                  {t.icon}
                  <span className="dt-dock-tab-label">{t.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="dt-dock-close" onClick={onClose} aria-label="關閉">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="dt-dock-body">
            {tab === 'checkin' ? <CheckInTabContent onOpenGrowth={() => setGrowthOpen(true)} /> : <HydrationTabContent />}
          </div>
          <div className="dt-dock-footer">
            {renderFooter()}
          </div>
        </div>
      </div>,
        document.body,
        )}
        <GrowthSheet open={growthOpen} onClose={() => setGrowthOpen(false)} />
      </>
    );
  }

  /* ── Desktop: Floating Window ── */
  return (
    <>
      {createPortal(
    <div className="dt-window" ref={windowRef}
      style={{
        position: 'fixed',
        zIndex: 120,
        top: pos.y,
        left: pos.x,
        width: 'clamp(400px, 32vw, 460px)',
        height: 'min(540px, calc(100vh - 32px))',
        minHeight: 420,
        borderRadius: 28,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(18px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.2)',
        border: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
        boxShadow: '0 8px 40px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)',
      }}
    >
      {/* Header (drag handle + tabs + close) */}
      <div className="dt-dock-header" onDoubleClick={handleCenter} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ flexShrink: 0, padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', userSelect: 'none' }}>
        <div className="dt-dock-tabs">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`dt-dock-tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => setActiveTab(t.key)} aria-label={t.label} title={t.label} aria-pressed={tab === t.key}>
              {t.icon}
              <span className="dt-dock-tab-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button type="button" className="dt-dock-reset" onClick={handleResetPosition} aria-label="重置位置" title="重置位置">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 1 9 9" /><path d="M3 3v6h6" /></svg>
          </button>
          <button type="button" className="dt-dock-close" onClick={onClose} aria-label="關閉">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Body (scrollable content) */}
      <div className="dt-dock-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px' }}>
        {tab === 'checkin' ? <CheckInTabContent onOpenGrowth={() => setGrowthOpen(true)} /> : <HydrationTabContent />}
      </div>

      {/* Footer (fixed) */}
      <div className="dt-dock-footer" style={{ flexShrink: 0 }}>
        {renderFooter()}
      </div>
    </div>,
      document.body,
      )}
      <GrowthSheet open={growthOpen} onClose={() => setGrowthOpen(false)} />
    </>
  );
}
