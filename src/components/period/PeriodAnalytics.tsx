import type { CSSProperties } from 'react';
import { CycleTrendStrip, CYCLE_PHASE_COLOR } from '@/components/period/CycleTrendStrip';
import type { CycleSnapshot, TrendDay } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import { toLocalDateString } from '@/utils/date';

export function PeriodCycleHero({ snapshot, onRecord }: { snapshot: CycleSnapshot; onRecord: () => void }) {
  const phaseLabel = getCyclePhaseLabel(snapshot.status);
  const phaseColor = CYCLE_PHASE_COLOR[snapshot.status] ?? CYCLE_PHASE_COLOR.unknown;
  return <article className="health-period-hero" style={{ '--period-phase': phaseColor } as CSSProperties} data-testid="health-period-hero">
    <div>
      <span className="health-period-eyebrow">CURRENT CYCLE</span>
      <h1>{snapshot.status === 'no-data' ? '尚未有週期紀錄' : phaseLabel}</h1>
      {snapshot.cycleDay != null && <p className="health-period-cycle-day">第 {snapshot.cycleDay} / {snapshot.cycleLength} 天</p>}
      {snapshot.periodDay != null && <p>經期第 {snapshot.periodDay} 天</p>}
    </div>
    <div className="health-period-hero__actions">
      <PeriodPredictionSummary snapshot={snapshot}/>
      <button type="button" onClick={onRecord}>{snapshot.status === 'no-data' ? '記錄第一次週期' : '記錄今天'}</button>
    </div>
  </article>;
}

export function PeriodPredictionSummary({ snapshot }: { snapshot: CycleSnapshot }) {
  const confidence = snapshot.confidence === 'medium' ? '中等' : snapshot.confidence === 'low' ? '較低' : '尚無';
  return <section className="health-period-prediction" aria-label="週期預測摘要" data-testid="health-period-prediction">
    <span>下次週期預測</span>
    <strong>{snapshot.predictedNextStart ?? '等待更多紀錄'}</strong>
    {snapshot.predictedDaysRemaining != null && <p>約 {snapshot.predictedDaysRemaining} 天後</p>}
    <small>預測信心：{confidence}。{snapshot.confidence === 'medium' ? '依目前週期歷史推估。' : '資料較少，結果僅供參考。'}</small>
  </section>;
}

export function PeriodCycleTrend({ snapshot, view, onViewChange }: {
  snapshot: CycleSnapshot;
  view: 'trend' | 'week';
  onViewChange: (view: 'trend' | 'week') => void;
}) {
  return <article className="moon-health-card health-period-trend" data-testid="health-period-trend">
    <header><div><span className="health-period-eyebrow">CYCLE</span><h2>週期視覺化</h2></div><div className="health-period-view-tabs" role="tablist" aria-label="週期視圖">
      <button type="button" role="tab" aria-selected={view === 'trend'} onClick={() => onViewChange('trend')}>趨勢</button>
      <button type="button" role="tab" aria-selected={view === 'week'} onClick={() => onViewChange('week')}>週格</button>
    </div></header>
    {view === 'trend' ? <CycleTrendStrip snapshot={snapshot} variant="full" interactive showLegend/> : <PeriodPhaseGrid trend={snapshot.trend}/>} 
  </article>;
}

export function PeriodPhaseGrid({ trend }: { trend: TrendDay[] }) {
  const today = toLocalDateString();
  if (!trend.length) return <p className="health-period-empty">持續記錄後，這裡會出現 28 天週格視圖。</p>;
  return <div className="health-period-week-grid" role="img" aria-label="28 天週期週格視圖" data-testid="health-period-week-grid">
    {trend.map((day) => <div key={day.date} className={day.date === today ? 'is-today' : undefined} style={{ '--period-cell': CYCLE_PHASE_COLOR[day.phase] ?? CYCLE_PHASE_COLOR.unknown } as CSSProperties} title={`${day.date} · ${getCyclePhaseLabel(day.phase)}`}>
      <span>{Number(day.date.slice(8))}</span><small>{getCyclePhaseLabel(day.phase)}</small>
    </div>)}
  </div>;
}
