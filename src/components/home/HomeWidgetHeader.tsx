import type { ReactNode } from 'react';

interface HomeWidgetHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
}

/**
 * HomeWidgetHeader — shared widget header row.
 * Title / subtitle / optional trailing action slot.
 */
export function HomeWidgetHeader({ title, subtitle, action, meta }: HomeWidgetHeaderProps) {
  return (
    <div className="hw-widget-header" data-home-widget-header>
      <div className="hw-widget-header-main">
        <div className="hw-widget-header-row">
          <span className="hw-title hw-widget-header-title">{title}</span>
          {meta && <span className="hw-meta hw-widget-header-meta">{meta}</span>}
        </div>
        {subtitle && <span className="hw-secondary hw-widget-header-subtitle">{subtitle}</span>}
      </div>
      {action && <div className="hw-widget-header-action">{action}</div>}
    </div>
  );
}
