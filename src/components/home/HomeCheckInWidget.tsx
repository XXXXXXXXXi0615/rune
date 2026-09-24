import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useTideRailStore } from '@/store/useTideRailStore';
import type { HomeWidgetSize } from '@/features/home/types';
import type { CheckInRecord } from '@/features/tideclock/types';
import { useNow } from '@/hooks/useNow';
import { buildFlowDayCheckInPresentation } from '@/features/home/flowDayCheckInPresentation';
import './HomeCheckInWidget.css';

interface ReceiptSnapshot {
  date: string;
  time: string;
  streak: number;
  monthlyCount: number;
}

const formatTime = (value: string) => new Date(value).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

function CheckInReceipt({ snapshot, onClose, onDetails }: { snapshot: ReceiptSnapshot; onClose: () => void; onDetails: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (interacted) return;
    const fadeTimer = window.setTimeout(() => setLeaving(true), 1700);
    const closeTimer = window.setTimeout(onClose, 2000);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(closeTimer); };
  }, [interacted, onClose]);

  return createPortal(
    <div className={`home-checkin-receipt-layer${leaving ? ' is-leaving' : ''}`} data-testid="home-checkin-receipt" aria-live="polite">
      <section className="home-checkin-receipt" role="status" onPointerEnter={() => setInteracted(true)} onPointerDown={() => setInteracted(true)}>
        <div className="home-checkin-receipt__notch" aria-hidden="true" />
        <span className="home-checkin-receipt__kicker">TIDECLOCK · DAILY RECEIPT</span>
        <h2>月潮簽到回執</h2>
        <time>{snapshot.date} {snapshot.time}</time>
        <div className="home-checkin-receipt__stamp" aria-hidden="true"><i /><span>今日已打卡</span></div>
        <dl>
          <div><dt>連續簽到</dt><dd>{snapshot.streak} 天</dd></div>
          <div><dt>本月打卡</dt><dd>{snapshot.monthlyCount} 次</dd></div>
        </dl>
        <blockquote>「今天也留下了一格。」</blockquote>
        <div className="home-checkin-receipt__actions">
          <button type="button" onClick={onClose}>收起</button>
          <button type="button" className="is-primary" onClick={onDetails}>查看詳情</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function HomeCheckInWidget({ size }: { size: HomeWidgetSize }) {
  const now = useNow('minute');
  const openDailyTide = useTideRailStore((s) => s.openWindow);
  const records = useCheckInStore((s) => s.records);
  const clockIn = useCheckInStore((s) => s.clockIn);
  const getTodayStatus = useCheckInStore((s) => s.getTodayStatus);
  const getAttendanceStreak = useCheckInStore((s) => s.getAttendanceStreak);
  const today = getTodayStatus();
  const presentation = useMemo(() => buildFlowDayCheckInPresentation(now, today), [now, today]);
  const checkedIn = presentation.status !== 'pending';
  const streak = getAttendanceStreak();
  const [stamping, setStamping] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);

  const monthlyCount = useMemo(() => {
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return new Set(records.filter((record) => record.kind === 'clock_in' && record.clockInAt && record.date.startsWith(prefix) && (record.status === 'completed' || record.status === 'late')).map((record) => record.date)).size;
  }, [now, records]);

  const openDetails = () => openDailyTide('checkin');
  const makeSnapshot = (record: CheckInRecord): ReceiptSnapshot => ({
    date: record.date,
    time: formatTime(record.clockInAt || record.createdAt),
    streak: useCheckInStore.getState().getAttendanceStreak(),
    monthlyCount: new Set(useCheckInStore.getState().records.filter((item) => item.kind === 'clock_in' && item.clockInAt && item.date.startsWith(record.date.slice(0, 7)) && (item.status === 'completed' || item.status === 'late')).map((item) => item.date)).size,
  });

  const handleQuickCheckIn = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (checkedIn || stamping) return;
    setStamping(true);
    const record = clockIn();
    if (record) {
      window.setTimeout(() => setReceipt(makeSnapshot(record)), 280);
    }
    window.setTimeout(() => setStamping(false), 680);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(); }
  };

  const time = today?.clockInAt ? formatTime(today.clockInAt) : null;
  const ctaLabel = presentation.status === 'pending'
    ? (stamping ? '正在落印' : '留下今日潮印')
    : presentation.status === 'late'
      ? `已留下今日潮印 · 遲到`
      : `今日潮印${time ? ` ${time}` : ''}`;

  return (
    <>
      <article className={`hwg-widget hwg-widget--checkin home-checkin-machine${stamping ? ' is-stamping' : ''}`} data-home-widget-id="home-checkin" data-home-widget-state={presentation.status} data-home-widget-size={size} onClick={openDetails} onKeyDown={handleKeyDown} role="button" tabIndex={0} aria-label={`${presentation.ariaLabel}。開啟每日儀式完整面板`}>
        <div className="home-checkin-machine__main">
          <div className="home-checkin-machine__pillar" aria-label={presentation.ariaLabel}>
            <span className={`home-checkin-machine__glyph element-${presentation.dayPillar.stemElement}`} data-element={presentation.dayPillar.stemElement} aria-label={`${presentation.dayPillar.stem} · ${presentation.stemElementLabel}`}>{presentation.dayPillar.stem}</span>
            <span className="home-checkin-machine__pillar-divider" aria-hidden="true" />
            <span className={`home-checkin-machine__glyph element-${presentation.dayPillar.branchElement}`} data-element={presentation.dayPillar.branchElement} aria-label={`${presentation.dayPillar.branch} · ${presentation.branchElementLabel}`}>{presentation.dayPillar.branch}</span>
          </div>
          <div className="home-checkin-machine__copy">
            <span className="hw-kicker">五行流日打卡</span>
            <strong className="hw-title home-checkin-machine__elements">{presentation.stemElementLabel} · {presentation.branchElementLabel}</strong>
            <span className="home-checkin-machine__context">{presentation.calendarContext}</span>
            <span className="hw-meta">連續 {streak} 天 · 本月 {monthlyCount} 次</span>
          </div>
          <span className={`home-checkin-machine__stamp${checkedIn ? ' is-visible' : ''}`} aria-hidden="true"><i>✓</i><small>今日潮印</small>{time && <time>{time}</time>}</span>
        </div>
        {!checkedIn ? <button type="button" className="home-checkin-machine__action" data-pet-safe-region="interactive" onClick={handleQuickCheckIn} disabled={stamping}>{ctaLabel}</button> : <span className="home-checkin-machine__completed" role="status">{ctaLabel}</span>}
      </article>
      {receipt && <CheckInReceipt snapshot={receipt} onClose={() => setReceipt(null)} onDetails={() => { setReceipt(null); openDetails(); }} />}
    </>
  );
}
