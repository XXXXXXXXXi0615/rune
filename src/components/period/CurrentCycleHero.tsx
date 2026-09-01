import type { CycleSnapshot } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import { CYCLE_PHASE_COLOR } from '@/components/period/CycleTrendStrip';

function CycleArc({ progress }: { progress: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0.04, progress)));
  return (
    <svg viewBox="0 0 100 100" width={120} height={120} aria-hidden="true">
      <defs>
        <linearGradient id="cc-arc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#b3506e" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="url(#cc-arc-grad)" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 50 50)" />
    </svg>
  );
}

export function CurrentCycleHero({ snapshot }: { snapshot: CycleSnapshot }) {
  const phase = snapshot.status === 'no-data' ? 'no-data' : snapshot.status;
  const label = getCyclePhaseLabel(phase);
  const color = CYCLE_PHASE_COLOR[phase] || '#888';
  const progress = Math.min(1, Math.max(0.04, snapshot.progress ?? 0.06));

  if (snapshot.status === 'no-data') {
    return (
      <section className="cch-glass cch-no-data" aria-label="當前週期">
        <div className="cch-main">
          <div className="cch-info">
            <span className="cch-phase" style={{ color: '#888' }}>尚無週期資料</span>
            <span className="cch-day">記錄第一次週期後，LUNARIS 會開始看見你的節律。</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cch-glass" aria-label="當前週期">
      <div className="cch-main">
        <div className="cch-gauge">
          <CycleArc progress={progress} />
          <span className="cch-day-num">{snapshot.cycleDay ?? '—'}</span>
        </div>
        <div className="cch-info">
          <span className="cch-phase" style={{ color }}>{label}</span>
          <span className="cch-day-label">第 {snapshot.cycleDay} 天</span>
          {snapshot.periodDay && snapshot.periodDay > 0 && (
            <span className="cch-period-day">經期第 {snapshot.periodDay} 天</span>
          )}
          {snapshot.predictedNextStart && snapshot.predictedDaysRemaining != null && (
            <span className="cch-next">
              預估 {snapshot.predictedDaysRemaining} 天後進入下一週期
            </span>
          )}
          {snapshot.confidence === 'low' && (
            <span className="cch-confidence">依目前記錄推估</span>
          )}
        </div>
      </div>
    </section>
  );
}
