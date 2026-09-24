import type { ReactNode } from 'react';

interface HomeWidgetMetricProps {
  value: ReactNode;
  unit?: ReactNode;
  label?: ReactNode;
  accent?: boolean;
  className?: string;
}

/**
 * HomeWidgetMetric — shared metric block (value + optional unit / label).
 * Typography via .hw-metric / .hw-metric-unit (size-aware).
 */
export function HomeWidgetMetric({ value, unit, label, accent, className }: HomeWidgetMetricProps) {
  return (
    <div className={`hw-widget-metric${className ? ` ${className}` : ''}`} data-home-widget-metric>
      <span className="hw-metric" style={accent ? { color: 'var(--hw-accent)' } : undefined}>
        {value}
      </span>
      {unit && <span className="hw-metric-unit hw-widget-metric-unit">{unit}</span>}
      {label && <span className="hw-meta hw-widget-metric-label">{label}</span>}
    </div>
  );
}
