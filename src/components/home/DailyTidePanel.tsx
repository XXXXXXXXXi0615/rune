import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useQuestStore } from '@/store/useQuestStore';
import { useReleaseNoticeStore } from '@/features/tideclock/useReleaseNoticeStore';
import { toLocalDateString } from '@/utils/date';
import { getMonthlyAttendance } from '@/features/tideclock/tideclockEngine';
import { buildCheckInCopy } from '@/features/tideclock/checkInCopy';
import type { ReleaseNotice } from '@/config/releaseNotices';

interface DailyTidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}

type PanelTab = 'checkin' | 'update';

const POPOVER_WIDTH = 420;
const POPOVER_MAX_HEIGHT = 620;
const SIDE_OFFSET = 12;
const COLLISION_PADDING = 16;

function computePopoverPosition(
  anchorRect: DOMRect | undefined,
  popoverWidth: number,
  popoverHeight: number,
): { top: number; left: number; flipped: boolean } {
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  // Default: position below anchor, left-aligned
  let top = (anchorRect?.bottom ?? 120) + SIDE_OFFSET;
  let left = anchorRect?.left ?? COLLISION_PADDING;
  let flipped = false;

  // Flip to top if not enough space below
  const spaceBelow = viewportH - (anchorRect?.bottom ?? 120) - COLLISION_PADDING;
  const spaceAbove = (anchorRect?.top ?? 120) - COLLISION_PADDING;
  if (spaceBelow < popoverHeight && spaceAbove > popoverHeight) {
    top = (anchorRect?.top ?? 120) - popoverHeight - SIDE_OFFSET;
    flipped = true;
  }

  // Horizontal shift: prevent overflowing right edge
  const maxLeft = viewportW - popoverWidth - COLLISION_PADDING;
  if (left > maxLeft) {
    left = maxLeft;
  }
  // Prevent overflowing left edge
  if (left < COLLISION_PADDING) {
    left = COLLISION_PADDING;
  }

  // Vertical clamp: never go above viewport
  if (top < COLLISION_PADDING) {
    top = COLLISION_PADDING;
  }

  return { top, left, flipped };
}

function CheckInTab() {
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getCurrentPerfectStreak = useCheckInStore((s) => s.getCurrentPerfectStreak);
  const records = useCheckInStore((s) => s.records);
  const policy = useCheckInStore((s) => s.policy);

  const todayRecord = getTodayStatus();
  const isDone = !!todayRecord;
  const streak = getCurrentPerfectStreak();
  const today = toLocalDateString();
  const monthly = getMonthlyAttendance(records);
  const monthlyChecked = Object.values(monthly).filter((s) => s === 'completed' || s === 'late').length;
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const quests = useQuestStore((s) => s.quests);
  const mainQuestByDate = useQuestStore((s) => s.mainQuestByDate);
  const mainQuest = quests.find((q) => q.id === mainQuestByDate[today]);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const dateDisplay = (() => {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${m}月${day}日 週${weekdays[d.getDay()]}`;
  })();

  const monthTitle = (() => {
    return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
  })();

  const monthDays: (number | null)[] = [];
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();

  for (let i = 0; i < firstDay; i++) monthDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthDays.push(d);

  const todayDay = now.getDate();

  const missedDays: string[] = [];
  for (let d = 1; d < todayDay; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (!monthly[dateStr]) missedDays.push(dateStr);
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
    <div className="dt-panel-tab-content">
      <div className="dt-panel-date">{dateDisplay}</div>
      <div className="dt-panel-time">{timeStr}</div>

      <div className="dt-panel-streak-row">
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num">{isDone ? Math.max(streak, 1) : streak}</span>
          <span className="dt-panel-streak-label">連續天數</span>
        </div>
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num">{monthlyChecked}</span>
          <span className="dt-panel-streak-label">本月打卡</span>
        </div>
        <div className="dt-panel-streak-card">
          <span className="dt-panel-streak-num">{missedCount}</span>
          <span className="dt-panel-streak-label">漏簽天數</span>
        </div>
        {todayRecord?.moonDewAwarded != null && todayRecord.moonDewAwarded > 0 && (
          <div className="dt-panel-streak-card">
            <span className="dt-panel-streak-num">+{todayRecord.moonDewAwarded}</span>
            <span className="dt-panel-streak-label">Moon Dew</span>
          </div>
        )}
      </div>

      <div className="dt-panel-copy" aria-live="polite">
        {dynamicCopy}
      </div>

      <div className="dt-panel-section">
        <div className="dt-panel-section-title dt-panel-month-title">{monthTitle}</div>
        <div className="dt-calendar-grid">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <div key={w} className="dt-calendar-weekday">{w}</div>
          ))}
          {monthDays.map((d, i) => {
            if (d === null) return <div key={`empty-${i}`} className="dt-calendar-cell dt-calendar-cell--empty" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const status = monthly[dateStr];
            const isToday = d === todayDay;
            const isChecked = status === 'completed' || status === 'late';
            const isMissed = status === 'makeup_required';
            return (
              <CalendarCell
                key={dateStr}
                day={d}
                isToday={isToday}
                isChecked={isChecked}
                isMissed={isMissed}
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
            已打卡
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

      {isDone && (
        <div className="dt-panel-section">
          <div className="dt-panel-section-title">今日打卡條</div>
          <div className="dt-panel-receipt">
            <div className="dt-receipt-row">
              <span>日期</span><span>{todayRecord?.date}</span>
            </div>
            <div className="dt-receipt-row">
              <span>打卡時間</span>
              <span>
                {todayRecord?.clockInAt
                  ? (() => {
                      const d = new Date(todayRecord.clockInAt);
                      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    })()
                  : '--:--'}
              </span>
            </div>
            <div className="dt-receipt-row">
              <span>狀態</span>
              <span className={todayRecord?.isLate ? 'dt-text-late' : 'dt-text-ontime'}>
                {todayRecord?.isLate ? '遲到' : '準時'}
              </span>
            </div>
            {todayRecord?.ticketNumber && (
              <div className="dt-receipt-row dt-receipt-row--small">
                <span>小票編號</span><span className="dt-text-mono">{todayRecord.ticketNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {mainQuest && (
        <div className="dt-panel-section">
          <div className="dt-panel-section-title">今日主線</div>
          <div className="dt-panel-main-task">{mainQuest.title}</div>
        </div>
      )}
    </div>
  );
}

/**
 * 日曆格元件：根據 (today, checked, missed) 疊加視覺
 * - isToday：薄荷綠外圈圓環
 * - isChecked：紅色手繪描邊圓圈（只描邊，不填色）
 * - isMissed：紅色手繪描邊叉叉
 * - 三者可疊加：今天 + 已打卡 → 同時顯示圓環 + 紅圈
 */
function CalendarCell({
  day,
  isToday,
  isChecked,
  isMissed,
}: {
  day: number;
  isToday: boolean;
  isChecked: boolean;
  isMissed: boolean;
}) {
  const classes = ['dt-calendar-cell'];
  if (isToday) classes.push('dt-calendar-cell--today');
  if (isChecked) classes.push('dt-calendar-cell--checked');
  if (isMissed) classes.push('dt-calendar-cell--missed');
  if (isToday && isChecked) classes.push('dt-calendar-cell--today-checked');
  if (isToday && isMissed) classes.push('dt-calendar-cell--today-missed');

  return (
    <div className={classes.join(' ')}>
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

function UpdateTab() {
  const notices = useReleaseNoticeStore((s) => s.notices);
  const markRead = useReleaseNoticeStore((s) => s.markRead);

  const sortedNotices = [...notices].sort((a, b) => b.publishedAt - a.publishedAt);

  if (sortedNotices.length === 0) {
    return (
      <div className="dt-panel-tab-content">
        <div className="dt-panel-empty">
          <div className="dt-panel-empty-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="dt-panel-empty-text">當前已是最新版本</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dt-panel-tab-content">
      {sortedNotices.map((notice) => (
        <UpdateNoticeCard key={notice.id} notice={notice} onRead={() => markRead(notice.version)} />
      ))}
    </div>
  );
}

function UpdateNoticeCard({ notice, onRead }: { notice: ReleaseNotice; onRead: () => void }) {
  const sections: { label: string; items: string[]; cls: string }[] = [
    { label: '新增', items: notice.added, cls: 'dt-update-added' },
    { label: '改進', items: notice.improved, cls: 'dt-update-improved' },
    { label: '修復', items: notice.fixed, cls: 'dt-update-fixed' },
    { label: '已知問題', items: notice.knownIssues, cls: 'dt-update-known' },
  ];

  const publishedDate = (() => {
    const d = new Date(notice.publishedAt);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  const isUnread = !notice.readAt;

  useEffect(() => {
    if (isUnread) {
      const tid = setTimeout(() => onRead(), 2000);
      return () => clearTimeout(tid);
    }
  }, [isUnread, onRead]);

  return (
    <div className={`dt-update-card${isUnread ? ' dt-update-card--unread' : ''}`}>
      <div className="dt-update-header">
        <div className="dt-update-version-row">
          <span className="dt-update-version">v{notice.version}</span>
          {isUnread && <span className="dt-update-dot" aria-label="未讀" />}
        </div>
        <span className="dt-update-date">{publishedDate}</span>
      </div>

      {sections.map((section) => {
        if (section.items.length === 0) return null;
        return (
          <div key={section.label} className="dt-update-section">
            <span className={`dt-update-tag ${section.cls}`}>{section.label}</span>
            <ul className="dt-update-list">
              {section.items.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function DailyTidePanel({ isOpen, onClose, anchorRef }: DailyTidePanelProps) {
  const [tab, setTab] = useState<PanelTab>('checkin');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number }>({ top: 120, left: 16 });
  const panelRef = useRef<HTMLDivElement>(null);

  const ensureNotices = useReleaseNoticeStore((s) => s.ensureNotices);
  const hasUnreadNotice = useReleaseNoticeStore((s) => s.hasUnread);

  const dismissTodayCheckIn = useCheckInStore((s) => s.dismissToday);

  useEffect(() => {
    ensureNotices();
  }, [ensureNotices]);

  const handleDismissToday = useCallback(() => {
    dismissTodayCheckIn();
    const state = useReleaseNoticeStore.getState();
    const unreadNotices = state.notices.filter((n) => !n.readAt);
    unreadNotices.forEach((n) => {
      state.dismissToday(n.version);
    });
    onClose();
  }, [dismissTodayCheckIn, onClose]);

  // Reposition on resize/open
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const updatePosition = () => {
      const anchorRect = anchorRef?.current?.getBoundingClientRect();
      const pos = computePopoverPosition(
        anchorRect,
        POPOVER_WIDTH,
        Math.min(POPOVER_MAX_HEIGHT, window.innerHeight - 32),
      );
      setPopoverStyle({ top: pos.top, left: pos.left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isOpen, isMobile, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    return () => {
      prevFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs: { key: PanelTab; label: string; badge?: number }[] = [
    { key: 'checkin', label: '今日簽到' },
    { key: 'update', label: '月潮更新', badge: hasUnreadNotice() ? 1 : 0 },
  ];

  const panel = (
    <div className={`dt-panel${isMobile ? ' dt-panel--sheet' : ''}`} ref={panelRef}>
      <div className="dt-panel-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`dt-panel-tab${tab === t.key ? ' dt-panel-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && <span className="dt-panel-tab-badge" />}
          </button>
        ))}
        <button type="button" className="dt-panel-close" onClick={onClose} aria-label="關閉">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="dt-panel-body">
        {tab === 'checkin' ? <CheckInTab /> : <UpdateTab />}
      </div>

      <div className="dt-panel-footer">
        <button type="button" className="dt-panel-footer-btn dt-panel-footer-btn--ghost" onClick={handleDismissToday}>
          今天不再顯示
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div className="dt-sheet-overlay" onClick={onClose}>
        <div className="dt-sheet-backdrop" />
        <div className="dt-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="dt-sheet-handle" />
          {panel}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="dt-popover-overlay" onClick={onClose}>
      <div
        className="dt-popover"
        style={{
          position: 'fixed',
          top: popoverStyle.top,
          left: popoverStyle.left,
          zIndex: 2100,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {panel}
      </div>
    </div>,
    document.body,
  );
}
