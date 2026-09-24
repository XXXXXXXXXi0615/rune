import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCycleSnapshot } from '@/features/period/getCycleSnapshot';
import { getCyclePhaseLabel } from '@/features/period/periodLabels';
import { CYCLE_PHASE_COLOR } from '@/components/period/CycleTrendStrip';
import type { HomeWidgetSize } from '@/features/home/types';
import { HomeWidgetIcon } from './HomeWidgetIcon';

interface Props { size: HomeWidgetSize; }

function CycleRing({ pct, color }: { pct: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(pct, 0), 1));
  return (
    <svg className="home-cycle-ring" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
      <circle className="home-cycle-ring__phase phase-menstrual" cx="40" cy="40" r={r} pathLength="100" strokeDasharray="20 80" strokeDashoffset="0" />
      <circle className="home-cycle-ring__phase phase-follicular" cx="40" cy="40" r={r} pathLength="100" strokeDasharray="28 72" strokeDashoffset="-22" />
      <circle className="home-cycle-ring__phase phase-ovulation" cx="40" cy="40" r={r} pathLength="100" strokeDasharray="10 90" strokeDashoffset="-52" />
      <circle className="home-cycle-ring__phase phase-luteal" cx="40" cy="40" r={r} pathLength="100" strokeDasharray="36 64" strokeDashoffset="-64" />
      <circle className="home-cycle-ring__progress" cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 40 40)" />
      <circle className="home-cycle-ring__core" cx="40" cy="40" r="25" />
    </svg>
  );
}

export function PeriodHomeWidget({ size }: Props) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const snapshot = useMemo(() => getCycleSnapshot(), [tick]);

  useEffect(() => {
    window.addEventListener('period-records-updated', () => setTick((t) => t + 1));
  }, []);

  const hasData = (snapshot.cycleDay ?? 0) > 0;
  const phaseLabel = hasData ? getCyclePhaseLabel(snapshot.status) : '尚無記錄';
  const phaseColor = CYCLE_PHASE_COLOR[snapshot.status] ?? 'var(--hwg-accent)';
  const cycleLength = snapshot.cycleLength ?? 28;
  const progressPct = hasData ? (snapshot.cycleDay ?? 0) / Math.max(1, cycleLength) : 0;

  const handleClick = () => navigate('/period');

  if (!hasData) {
    return (
      <button type="button" className="hwg-widget hwg-widget--period hwg-widget--small" onClick={handleClick}
        data-home-widget-state={hasData ? 'active' : 'empty'}
        data-home-widget-size="small"
        aria-label="生理週期：尚無記錄">
        <div className="hwg-period-empty">
          <span style={{ '--hwg-icon-color': 'var(--hwg-text-muted)', '--hwg-icon-tint': 'rgba(128,128,128,0.06)' } as React.CSSProperties}>
            <HomeWidgetIcon name="period" size="md" decorative />
          </span>
          <span>週期尚未記錄</span>
          <span>開始記錄</span>
        </div>
      </button>
    );
  }

  if (size === 'small') {
    return (
      <button type="button" className="hwg-widget hwg-widget--period hwg-widget--small" onClick={handleClick}
        data-home-widget-state="active"
        data-home-widget-size="small"
        aria-label={`生理週期：${phaseLabel}，第 ${snapshot.cycleDay} 天`}>
        <div className="hwg-period-small">
          <CycleRing pct={progressPct} color={phaseColor} />
          <div className="hwg-period-info">
            <strong style={{ color: phaseColor }}>{phaseLabel}</strong>
            <span>第 {snapshot.cycleDay} 天</span>
            {(snapshot.predictedDaysRemaining ?? 0) > 0 && (
              <small>距預測週期 {snapshot.predictedDaysRemaining} 天</small>
            )}
          </div>
        </div>
      </button>
    );
  }

  // medium
  return (
    <button type="button" className="hwg-widget hwg-widget--period hwg-widget--medium" onClick={handleClick}
      data-home-widget-state="active"
      data-home-widget-size="medium"
      aria-label={`生理週期：${phaseLabel}，點擊查看完整儀表板`}>
      <div className="hwg-period-medium">
        <div className="hwg-period-medium-left">
          <CycleRing pct={progressPct} color={phaseColor} />
          <div className="hwg-period-info">
            <strong style={{ color: phaseColor }}>{phaseLabel}</strong>
            <span>第 {snapshot.cycleDay} 天 / {cycleLength} 天週期</span>
          </div>
        </div>
        {snapshot.predictedNextStart && (
          <div className="hwg-period-medium-right">
            <div className="hwg-period-next">
              <small>預測開始</small>
              <span>{snapshot.predictedNextStart}</span>
            </div>
            {(snapshot.predictedDaysRemaining ?? 0) > 0 && (
              <p className="hwg-period-tip">還有 {snapshot.predictedDaysRemaining} 天</p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
