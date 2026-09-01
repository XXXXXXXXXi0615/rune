/**
 * CycleTrendStrip — shared 28-day cycle trend visualization.
 *
 * One component, two variants:
 *  - compact: home dashboard. ~112px tall, no tooltip, no horizontal scroll,
 *             28 days compressed to fit container width.
 *  - full:    /period page. ~220px tall, tooltip + hover/tap/keyboard,
 *             internal horizontal scroll, full Chinese legend.
 *
 * Reads only `snapshot.trend`. Does NOT recompute the cycle.
 * Shares phase colors, today marker, mood/tide dots, history/forecast opacity
 * with both pages so the visual language is unified.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { CycleSnapshot, TrendDay } from '@/features/period/getCycleSnapshot';
import { toLocalDateString } from '@/utils/date';
import { getPeriodMoodLabel, getTideLevelLabel, getCyclePhaseLabel } from '@/features/period/periodLabels';
import './CycleTrendStrip.css';

export interface CycleTrendStripProps {
  snapshot: CycleSnapshot;
  variant: 'compact' | 'full';
  interactive?: boolean;
  showLegend?: boolean;
}

/** Shared phase → color token. Both pages MUST use the same palette. */
export const CYCLE_PHASE_COLOR: Record<string, string> = {
  menstruation: '#b3506e',
  follicular: '#8fb8a6',
  ovulation: '#e8c55a',
  luteal: '#a28fb8',
  unknown: '#888',
  'no-data': '#888',
};

interface ChartConfig {
  width: number;
  height: number;
  padT: number;
  padB: number;
  padL: number;
  padR: number;
}

const COMPACT: ChartConfig = { width: 700, height: 112, padT: 22, padB: 14, padL: 14, padR: 14 };
const FULL: ChartConfig = { width: 700, height: 220, padT: 30, padB: 30, padL: 16, padR: 16 };

function findPeriodSpans(trend: TrendDay[]): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let spanStart = -1;
  for (let i = 0; i < trend.length; i++) {
    if (trend[i].phase === 'menstruation') {
      if (spanStart < 0) spanStart = i;
    } else if (spanStart >= 0) {
      spans.push({ start: spanStart, end: i - 1 });
      spanStart = -1;
    }
  }
  if (spanStart >= 0) spans.push({ start: spanStart, end: trend.length - 1 });
  return spans;
}

interface TooltipProps {
  day: TrendDay;
  cx: number;
  cy: number;
}

function StripTooltip({ day, cx, cy }: TooltipProps) {
  const lines: string[] = [day.date];
  if (day.cycleDay != null) lines.push('第 ' + day.cycleDay + ' 天');
  if (day.mood) lines.push('心情：' + getPeriodMoodLabel(day.mood));
  if (day.tide) lines.push('潮位：' + getTideLevelLabel(day.tide));
  return (
    <g transform={'translate(' + cx + ',' + cy + ')'}>
      <rect
        x={-72}
        y={-8 - lines.length * 14}
        width={144}
        height={lines.length * 14 + 16}
        rx={8}
        fill="var(--bg-primary, var(--surface-3, #fff))"
        stroke="var(--border)"
        opacity={0.96}
      />
      {lines.map(function (line, i) {
        return (
          <text
            key={i}
            x={0}
            y={-8 - (lines.length - 1 - i) * 14}
            textAnchor="middle"
            fontSize={11}
            fill={i === 0 ? 'var(--text-3)' : 'var(--text)'}
          >
            {line}
          </text>
        );
      })}
    </g>
  );
}

export function CycleTrendStrip({ snapshot, variant, interactive = false, showLegend = false }: CycleTrendStripProps) {
  const trend = snapshot.trend;
  const todayStr = toLocalDateString(new Date());
  const cfg = variant === 'full' ? FULL : COMPACT;
  const isFull = variant === 'full';

  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [tapDay, setTapDay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDay = tapDay ?? hoverDay;

  const innerW = cfg.width - cfg.padL - cfg.padR;
  const innerH = cfg.height - cfg.padT - cfg.padB;
  const stepX = trend.length > 1 ? innerW / (trend.length - 1) : innerW;
  const barW = Math.max(3, stepX * (isFull ? 0.5 : 0.62));

  // Close tap tooltip on outside click / Escape (full variant only)
  useEffect(() => {
    if (!isFull || !tapDay) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current || !containerRef.current.contains(e.target as Node)) {
        setTapDay(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setTapDay(null);
    }
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [isFull, tapDay]);

  const handleBarClick = useCallback((date: string) => {
    setTapDay((prev) => (prev === date ? null : date));
  }, []);

  function ariaLabel(d: TrendDay): string {
    const parts = [d.date];
    if (d.cycleDay != null) parts.push('第 ' + d.cycleDay + ' 天');
    parts.push('階段：' + getCyclePhaseLabel(d.phase));
    if (d.mood) parts.push('心情：' + getPeriodMoodLabel(d.mood));
    if (d.tide) parts.push('潮位：' + getTideLevelLabel(d.tide));
    return parts.join('，');
  }

  if (!trend.length) {
    return (
      <section className="cts-glass" data-variant={variant}>
        <div className="cts-empty">
          持續記錄後，將 build 出你的週期趨勢
        </div>
      </section>
    );
  }

  const spans = findPeriodSpans(trend);
  const todayIndex = trend.findIndex((d) => d.date === todayStr);

  return (
    <section className="cts-glass" data-variant={variant} aria-label="週期趨勢">
      <div ref={containerRef} className={isFull ? 'cts-scroll-wrap' : 'cts-fit-wrap'}>
        <svg
          viewBox={'0 0 ' + cfg.width + ' ' + cfg.height}
          preserveAspectRatio="none"
          className="cts-svg"
          style={isFull ? { width: cfg.width + 'px', height: 'auto', minWidth: '100%' } : { width: '100%', height: 'auto' }}
          role="img"
          aria-label="28 天週期趨勢"
        >
          {/* Period bands */}
          {spans.map((sp, i) => {
            const x1 = Math.max(cfg.padL, cfg.padL + sp.start * stepX - stepX / 2);
            const x2 = Math.min(cfg.padL + innerW, cfg.padL + (sp.end + 1) * stepX - stepX / 2);
            return (
              <rect
                key={i}
                x={x1}
                y={cfg.padT}
                width={Math.max(0, x2 - x1)}
                height={innerH}
                rx={4}
                fill="#b3506e"
                opacity={0.1}
              />
            );
          })}

          {/* Baseline */}
          <line
            x1={cfg.padL}
            y1={cfg.padT + innerH}
            x2={cfg.padL + innerW}
            y2={cfg.padT + innerH}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {trend.map((d, i) => {
            const centerX = cfg.padL + i * stepX;
            const x = centerX - barW / 2;
            const h = d.phase === 'menstruation' ? innerH * 0.35 : innerH * 0.25;
            const y = cfg.padT + innerH - h;
            const isToday = d.date === todayStr;
            const isFuture = todayIndex >= 0 && i > todayIndex;
            const color = CYCLE_PHASE_COLOR[d.phase] || '#888';
            const isActive = isFull && activeDay === d.date;
            // History/forecast opacity: today & past = full, future = dimmed.
            const baseOpacity = isToday || isActive ? 0.85 : isFuture ? 0.3 : 0.5;
            const barOpacity = d.phase === 'menstruation' ? baseOpacity : Math.min(baseOpacity, 0.5);

            const interactiveProps = isFull && interactive
              ? {
                  tabIndex: 0,
                  role: 'button' as const,
                  'aria-label': ariaLabel(d),
                  onMouseEnter: () => setHoverDay(d.date),
                  onMouseLeave: () => setHoverDay(null),
                  onClick: () => handleBarClick(d.date),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBarClick(d.date);
                    }
                  },
                  style: { cursor: 'pointer' },
                }
              : {};

            return (
              <g key={d.date}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={barW / 2}
                  fill={color}
                  opacity={barOpacity}
                  {...interactiveProps}
                />
                {isToday && (
                  <>
                    <circle
                      cx={centerX}
                      cy={y - 3}
                      r={4}
                      fill="var(--accent, #d97757)"
                      stroke="var(--bg-primary, #fff)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={centerX}
                      y={cfg.padT + innerH + 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--accent, #d97757)"
                      fontWeight={600}
                    >
                      今天
                    </text>
                  </>
                )}
                {d.mood && (
                  <circle cx={centerX} cy={cfg.padT + innerH - 2} r={2} fill="#b3506e" opacity={0.7} />
                )}
                {d.tide && (
                  <circle cx={centerX} cy={cfg.padT + innerH - 8} r={2} fill="#5ba5c0" opacity={0.7} />
                )}
                {isFull && isActive && <StripTooltip day={d} cx={centerX} cy={cfg.padT - 10} />}
              </g>
            );
          })}
        </svg>
      </div>

      {showLegend && (
        <div className="cts-legend">
          <span>
            <i className="cts-legend-swatch cts-legend-menstruation" />經期中
          </span>
          <span>
            <i className="cts-legend-swatch cts-legend-follicular" />濾泡期
          </span>
          <span>
            <i className="cts-legend-swatch cts-legend-ovulation" />排卵期
          </span>
          <span>
            <i className="cts-legend-swatch cts-legend-luteal" />黃體期
          </span>
          <span className="cts-legend-sep" />
          <span>
            <i className="cts-legend-dot cts-legend-mood" />心情
          </span>
          <span>
            <i className="cts-legend-dot cts-legend-tide" />潮位
          </span>
        </div>
      )}
    </section>
  );
}
