import { useId, type CSSProperties } from 'react';

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

interface WidgetProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}

/**
 * WidgetProgressRing — reusable SVG circular progress.
 * - CSS / SVG only (no canvas)
 * - value clamped to 0–1 internally
 * - animation only on value change (stroke-dashoffset transition)
 * - reduced-motion handled in home-widget-visual.css
 */
export function WidgetProgressRing({
  value,
  size = 80,
  strokeWidth = 4.5,
  color,
  trackColor,
  label,
}: WidgetProgressRingProps) {
  const pct = clamp01(value);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const uid = useId();
  const fillVar = color ? ({ '--hw-progress-fill': color } as CSSProperties) : undefined;

  return (
    <svg
      className="hw-progress-ring"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={fillVar}
    >
      <circle
        className="hw-progress-ring__track"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor ?? 'var(--hw-progress-track)'}
        strokeWidth={strokeWidth}
      />
      <circle
        className="hw-progress-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--hw-progress-fill, var(--hw-accent))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

interface LinearWidgetProgressProps {
  value: number;
  className?: string;
  label?: string;
}

/**
 * LinearWidgetProgress — reusable linear progress bar.
 * value clamped to 0–1; width transition on change only.
 */
export function LinearWidgetProgress({ value, className, label }: LinearWidgetProgressProps) {
  const pct = clamp01(value);
  return (
    <div
      className={`hw-progress-linear${className ? ` ${className}` : ''}`}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <i className="hw-progress-linear__fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}
