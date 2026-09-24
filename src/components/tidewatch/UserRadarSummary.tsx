import type { UserRadarSummary as Summary } from '@/features/tidewatch/userRadar';

const CENTER = 110;
const RADIUS = 72;
const point = (index: number, radius: number) => {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
  return `${CENTER + Math.cos(angle) * radius},${CENTER + Math.sin(angle) * radius}`;
};

export function UserRadarSummary({ summary }: { summary: Summary }) {
  const grid = [1, .66, .33].map((scale) => Array.from({ length: 5 }, (_, index) => point(index, RADIUS * scale)).join(' '));
  const hasCompleteProjection = summary.sufficient && summary.axes.every((axis) => axis.value != null);
  const polygon = hasCompleteProjection
    ? summary.axes.map((axis, index) => point(index, RADIUS * (axis.value! / 100))).join(' ')
    : null;

  return <section className={`tw-section tw-radar-section${summary.sufficient ? ' is-mature' : ' is-forming'}`} data-testid="tidewatch-user-radar" data-maturity={summary.sufficient ? 'mature' : 'forming'}>
    <h2 className="tw-section-title">USER RADAR <span>7 日狀態</span></h2>
    <div className="tw-radar-card">
      <div className="tw-radar-chart">
        <svg viewBox="0 0 220 220" role="img" aria-label={summary.sufficient ? '最近七日使用者狀態雷達圖' : '最近七日資料尚在形成'}>
          {grid.map((points) => <polygon key={points} className="tw-radar-grid" points={points} />)}
          {Array.from({ length: 5 }, (_, index) => <line key={index} className="tw-radar-grid" x1={CENTER} y1={CENTER} x2={point(index, RADIUS).split(',')[0]} y2={point(index, RADIUS).split(',')[1]} />)}
          {polygon && <polygon className="tw-radar-value" points={polygon} />}{summary.sufficient && summary.axes.filter((axis) => axis.value != null).map((axis) => { const index = summary.axes.indexOf(axis); const [cx, cy] = point(index, RADIUS * (axis.value! / 100)).split(','); return <circle key={axis.id} className="tw-radar-point" cx={cx} cy={cy} r="2.5" />; })}
        </svg>
        {summary.axes.map((axis, index) => <span key={axis.id} className={`tw-radar-label is-${index}`}>{axis.label}</span>)}
      </div>
      <div className="tw-radar-copy"><strong>記錄 {summary.distinctCheckInDays} / 7 天</strong>{summary.sufficient ? <ul>{summary.axes.map((axis) => <li key={axis.id}><span>{axis.label}</span><b>{axis.id === 'writing' && summary.writingBaselineStatus === 'forming' ? '基準形成中' : axis.value ?? '—'}</b></li>)}</ul> : <p>數據正在形成</p>}</div>
    </div>
  </section>;
}
