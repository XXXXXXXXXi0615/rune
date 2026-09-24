import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

interface HomeWidgetProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * HomeWidget — shared card wrapper for home dashboard cards.
 *
 * Provides consistent glass-card styling with an optional header row
 * (title + optional subtitle + optional action slot).
 */
export function HomeWidget({ title, subtitle, action, className, children }: HomeWidgetProps) {
  return (
    <Card className={`home-dashboard-card${className ? ` ${className}` : ''}`}>
      {(title || action) && (
        <div className="dash-card-header">
          <div className="dash-card-header-left">
            {title && <span className="dash-card-title">{title}</span>}
            {subtitle && <span className="dash-card-subtitle">{subtitle}</span>}
          </div>
          {action && <div className="dash-card-action-slot">{action}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}
