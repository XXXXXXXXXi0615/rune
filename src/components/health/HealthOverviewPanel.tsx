import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHydrationStore, getDailyTotal } from '@/store/useHydrationStore';
import { deriveWaterProgress } from '@/features/home/dailyRitualPresentation';
import { useHealthStore } from '@/store/useHealthStore';
import { buildTodayHealthSummary } from '@/features/health/todayHealthSummary';
import { loadPeriodRecords } from '@/utils/periodStorage';
import { toLocalDateString } from '@/utils/date';
import '@/styles/moon-health.css';

/** Calendar overview projection. Canonical writes remain with Health, Hydration,
 * Period and other canonical health owners; this surface only derives today's presentation. */
export function HealthOverviewPanel() {
  const navigate = useNavigate();
  const records = useHealthStore((s) => s.records);
  const hydrationEntries = useHydrationStore((s) => s.entries);
  const hydrationGoal = useHydrationStore((s) => s.settings.dailyGoalMl);
  const todayKey = toLocalDateString();
  const hydrationToday = useMemo(() => getDailyTotal(hydrationEntries, todayKey), [hydrationEntries, todayKey]);
  const sleep = records.find((record) => record.type === 'sleep' && record.occurredOn === todayKey);
  const periods = loadPeriodRecords();
  const todayRecords = records.filter((record) => record.occurredOn === todayKey);
  const symptomCount = todayRecords.filter((record) => record.type === 'symptom').length;
  const currentPeriod = periods.find((record) => record.startDate <= todayKey && record.endDate >= todayKey);
  const latestPeriod = [...periods].filter((record) => record.startDate <= todayKey).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const periodStatus = currentPeriod
    ? `進行中${currentPeriod.flowLevel ? ` · ${currentPeriod.flowLevel}` : ''}`
    : latestPeriod ? `最近記錄 ${latestPeriod.startDate}` : '尚未記錄';
  const summary = useMemo(() => buildTodayHealthSummary({ dateKey: todayKey, records, hydrationEntries, hydrationGoalMl: hydrationGoal, periods }), [todayKey, records, hydrationEntries, hydrationGoal, periods]);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const copySummary = async () => {
    if (!summary) return false;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800);
    return true;
  };
  const hydrationPercent = deriveWaterProgress(hydrationToday, hydrationGoal);

  return <section className="health-overview-panel" data-testid="health-overview-panel" aria-label="今日健康">
    <header className="health-overview-heading">
      <span>TODAY HEALTH</span>
      <h2 id="health-today">今日健康</h2>
      <time dateTime={todayKey}>{todayKey}</time>
    </header>

    <section className="health-summary-card" aria-labelledby="health-summary-title">
      <div><span>今日摘要</span><strong id="health-summary-title">{todayRecords.length} 項健康記錄</strong></div>
      <p>{hydrationPercent}% 補水進度 · {sleep ? '已記錄睡眠' : '睡眠尚未記錄'} · {symptomCount} 項身體信號</p>
      <div className="health-summary-actions"><Link to="/calendar?view=body">管理身體記錄</Link><Link to="/calendar?action=period">記錄生理周期</Link></div>
    </section>

    <section aria-labelledby="health-core-title">
      <h3 className="health-section-title" id="health-core-title">核心記錄</h3>
      <div className="health-core-grid">
        <article className="health-surface-card health-core-card health-core-card--wide health-core-card--water">
          <div className="health-card-head"><span>飲水</span><small>{hydrationPercent}%</small></div>
          <strong>{hydrationToday} <small>/ {hydrationGoal} ml</small></strong>
          <div className="health-water-meter" aria-label={`今日饮水进度 ${hydrationPercent}%`}><span style={{ width: `${hydrationPercent}%` }} /></div>
          <p>直接读取 canonical HydrationStore。</p>
        </article>
        <article className="health-surface-card health-core-card health-core-card--compact">
          <span>睡眠</span><strong>{sleep?.value.kind === 'sleep' ? `${Math.floor(sleep.value.durationMinutes / 60)} 小時` : '尚未記錄'}</strong>
          <Link to="/calendar?view=body">記錄睡眠</Link>
        </article>
        <article className="health-surface-card health-core-card health-core-card--compact">
          <span>身體信號</span><strong>{symptomCount} 項</strong>
          <Link to="/calendar?view=body">查看身體</Link>
        </article>
        <article className="health-surface-card health-core-card health-core-card--wide health-core-card--period">
          <div><span>生理周期</span><strong>{periodStatus}</strong></div>
          <Link to="/calendar?action=period">快速記錄</Link>
        </article>
      </div>
    </section>

    <section aria-labelledby="health-life">
      <h3 className="health-section-title" id="health-life">生活記錄入口</h3>
      <div className="health-life-actions">
        {([['咖啡因', '日常攝取'], ['日照', '戶外光照'], ['活動量', '今日活動']] as const).map(([title, detail]) => <article className="health-life-action" key={title}><span>{title}</span><small>{detail}</small></article>)}
      </div>
    </section>

    <section aria-labelledby="health-trends">
      <h3 className="health-section-title" id="health-trends">趨勢</h3>
      <article className="health-surface-card health-trend-card"><div aria-hidden="true" className="health-trend-mark">⌁</div><div><strong>趨勢資料邊界</strong><p>趨勢僅使用既有健康、週期與生活記錄，不建立資料副本。</p></div></article>
    </section>

    <section className="health-surface-card health-copy-card" aria-labelledby="health-copy-title">
      <div className="health-copy-card__content">
        <h3 id="health-copy-title">健康摘要</h3>
        <p>把今天的身體紀錄整理成一段文字。<br />不會自動傳送給 AI。</p>
        {!summary && <p className="health-copy-card__empty">今天還沒有可整理的健康紀錄。</p>}
      </div>
      <div className="health-copy-card__actions">
        <button type="button" disabled={!summary} onClick={() => void copySummary()}>複製今日摘要</button>
        <button type="button" disabled={!summary} onClick={() => void copySummary().then((didCopy) => { if (didCopy) navigate('/chat'); })}>複製並前往 Chat</button>
      </div>
      <p className="health-copy-card__status" aria-live="polite">{copied ? '✓ 已複製' : ''}</p>
    </section>
  </section>;
}
