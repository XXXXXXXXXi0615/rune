import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCheckInStore } from '@/features/tideclock/useCheckInStore';
import { useTideRailStore } from '@/store/useTideRailStore';
import { toLocalDateString } from '@/utils/date';
import { buildStreakReaction } from '@/features/tideclock/checkInCopy';
import { deriveStreakTrack, streakSlotLabel } from '@/features/tideclock/streakTrackPresentation';
import { deriveDailyCheckInMonthSummary } from '@/features/home/dailyCheckInWelcomePresentation';
import { HomeCheckInEntry } from './HomeCheckInEntry';
import './DailyCheckInWelcomePanel.css';

type PanelPhase = 'ready' | 'success' | 'collapsing';

/** Success stays readable (track + reaction) before the presentation collapse. */
const SUCCESS_HOLD_MS = 2600;
const SUCCESS_COLLAPSE_MS = 250;

function focusHomeAnchor() {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-testid="home-checkin-entry"]')?.focus();
  }));
}

const SLOT_MARK: Record<string, string> = {
  completed: '✓', 'today-completed': '✓', 'today-available': '✦', future: '·',
};

/**
 * `startCollapsed` is the Phase 2B island preset entry: the panel opens as its
 * own collapsed launcher (HomeCheckInEntry) and expands through the canonical
 * ready → success → collapse morph when the launcher is used. Nothing about the
 * expanded presentation changes, and the default (false) keeps Home unchanged.
 */
export function DailyCheckInWelcomePanel({ startCollapsed = false }: { startCollapsed?: boolean } = {}) {
  const records = useCheckInStore((state) => state.records);
  const milestoneRewards = useCheckInStore((state) => state.milestoneRewards);
  const dismissedTodayDate = useCheckInStore((state) => state.dismissedTodayDate);
  const clockIn = useCheckInStore((state) => state.clockIn);
  const claimMilestone = useCheckInStore((state) => state.claimMilestone);
  const dismissToday = useCheckInStore((state) => state.dismissToday);
  const getCurrentPerfectStreak = useCheckInStore((state) => state.getCurrentPerfectStreak);
  const openDailyTide = useTideRailStore((state) => state.openWindow);
  const now = new Date();
  const today = toLocalDateString(now);
  const todayRecord = records.find((record) => record.kind === 'clock_in' && record.date === today);
  const eligible = !todayRecord && dismissedTodayDate !== today;
  const [visible, setVisible] = useState(eligible && !startCollapsed);
  const [phase, setPhase] = useState<PanelPhase>('ready');
  const [successTime, setSuccessTime] = useState<string | null>(null);
  const escapedDateRef = useRef<string | null>(startCollapsed ? today : null);
  const timersRef = useRef<number[]>([]);
  const summary = useMemo(() => deriveDailyCheckInMonthSummary(records, now), [records, today]);
  const streak = getCurrentPerfectStreak();
  const track = useMemo(
    () => deriveStreakTrack(records, now, streak, milestoneRewards),
    [records, milestoneRewards, streak, today],
  );
  const reaction = buildStreakReaction(
    phase === 'success'
      ? { streak, isDoneToday: true, hasHistory: true }
      : { streak, isDoneToday: false, hasHistory: records.some((record) => record.kind === 'clock_in') },
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    if (eligible && escapedDateRef.current !== today && phase === 'ready') setVisible(true);
    if (!eligible && phase === 'ready') setVisible(false);
  }, [eligible, phase, today]);
  const open = useCallback(() => {
    clearTimers();
    escapedDateRef.current = null;
    if (todayRecord) {
      setSuccessTime(new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(todayRecord.clockInAt || todayRecord.createdAt)));
      setPhase('success');
    } else {
      setSuccessTime(null);
      setPhase('ready');
    }
    setVisible(true);
  }, [clearTimers, todayRecord]);

  const collapse = useCallback((persistForToday: boolean) => {
    clearTimers();
    if (persistForToday) dismissToday();
    else escapedDateRef.current = today;
    setPhase('collapsing');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timersRef.current.push(window.setTimeout(() => {
      setVisible(false);
      setPhase('ready');
      focusHomeAnchor();
    }, reduced ? 100 : 240));
  }, [clearTimers, dismissToday, today]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapse(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [collapse, visible]);

  const handleCheckIn = () => {
    if (phase !== 'ready' || todayRecord) return;
    const record = clockIn();
    if (!record) return;
    setSuccessTime(new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(record.clockInAt || record.createdAt)));
    setPhase('success');
    clearTimers();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      timersRef.current.push(window.setTimeout(() => { setVisible(false); setPhase('ready'); focusHomeAnchor(); }, 110));
    } else {
      timersRef.current.push(window.setTimeout(() => setPhase('collapsing'), SUCCESS_HOLD_MS));
      timersRef.current.push(window.setTimeout(() => { setVisible(false); setPhase('ready'); focusHomeAnchor(); }, SUCCESS_HOLD_MS + SUCCESS_COLLAPSE_MS));
    }
  };

  const trackNode = <ol className="daily-checkin-welcome__track" aria-label="連續報備軌道" data-testid="checkin-streak-track">
    {track.slots.map((slot) => (
      <li
        key={slot.index}
        className={`daily-checkin-welcome__day is-${slot.state}${slot.isRewardDay ? ' is-reward' : ''}${slot.isLate ? ' is-late' : ''}`}
        aria-label={streakSlotLabel(slot)}
        data-slot={slot.index}
        data-slot-state={slot.state}
      >
        <span className="daily-checkin-welcome__day-index" aria-hidden="true">{slot.index}</span>
        <span className="daily-checkin-welcome__day-mark" aria-hidden="true">{SLOT_MARK[slot.state]}</span>
      </li>
    ))}
  </ol>;

  const rewardNode = track.reward.visible && <div
    className={`daily-checkin-welcome__reward${track.reward.claimed ? ' is-claimed' : ''}`}
    data-testid="checkin-reward"
  >
    <div><strong>給自己一個小獎勵</strong><small>連續七天。去選一樣你真的想要的東西。</small></div>
    {track.reward.claimed
      ? <span className="daily-checkin-welcome__reward-claimed">已收下本週的小獎勵</span>
      : <button type="button" data-testid="checkin-reward-claim" onClick={() => claimMilestone(7)}>收下這週的小獎勵</button>}
  </div>;

  return <div
    className={`home-checkin-surface${visible ? ' is-expanded' : ' is-collapsed'}${phase === 'collapsing' ? ' is-collapsing' : ''}`}
    data-testid="home-checkin-surface"
    data-checkin-presentation={visible ? phase : 'collapsed'}
    data-pet-safe-region="interactive"
  >
    {!visible ? <HomeCheckInEntry onOpen={open} /> : <section className={`daily-checkin-welcome is-${phase}`} data-testid="daily-checkin-welcome" aria-label="每日打卡浮動面板">
    <button
      type="button"
      className="daily-checkin-welcome__close"
      data-testid="daily-checkin-close"
      aria-label="關閉打卡面板"
      onClick={() => collapse(false)}
    >×</button>
    {phase === 'success' ? <>
      <div className="daily-checkin-welcome__success" aria-live="polite" role="status">
        <span className="daily-checkin-welcome__success-mark" aria-hidden="true">✓</span><div><strong>今日已記錄</strong><time>{successTime}</time><small>連續 {streak} 天</small></div>
      </div>
      {trackNode}
      <p className="daily-checkin-welcome__reaction" aria-live="polite">{reaction}</p>
      {rewardNode}
    </> : <>
      <div className="daily-checkin-welcome__head">
        <span className="daily-checkin-welcome__medallion" aria-hidden="true">✦</span>
        <span className="daily-checkin-welcome__head-copy"><span>DAILY CHECK-IN</span><h2 id="daily-checkin-welcome-title">今日報備</h2></span>
      </div>
      {trackNode}
      <dl className="daily-checkin-welcome__metrics">
        <div><dt>連續</dt><dd>{streak}<small>天</small></dd></div>
        <div><dt>本月</dt><dd>{summary.checked}<small>次</small></dd></div>
      </dl>
      <p className="daily-checkin-welcome__reaction">{reaction}</p>
      {rewardNode}
      <div className="daily-checkin-welcome__actions">
        <button type="button" className="is-primary" onClick={handleCheckIn}>報備</button>
        <button type="button" className="is-quiet" onClick={() => { openDailyTide('checkin'); collapse(false); }}>查看紀錄</button>
        <button type="button" className="is-tertiary" onClick={() => collapse(true)}>今日不再顯示</button>
      </div>
    </>}
    </section>}
  </div>;
}
