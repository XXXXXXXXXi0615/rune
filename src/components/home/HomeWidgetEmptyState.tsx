import type { ReactNode } from 'react';
import { HomeWidgetAction } from './HomeWidgetAction';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

/**
 * HomeWidgetEmptyState — shared empty state primitive.
 * Structured: icon / title / description / optional CTA (tokens in home-widget-visual.css).
 */
export function HomeWidgetEmptyState({ icon, title, description, actionLabel, onAction, compact }: Props) {
  return (
    <div className={`hw-empty-state${compact ? ' hw-empty-state--compact' : ''}`}>
      {icon && <span className="hw-empty-state__icon">{icon}</span>}
      <span className="hw-empty-state__title">{title}</span>
      {description && <span className="hw-empty-state__desc">{description}</span>}
      {actionLabel && onAction && (
        <span className="hw-empty-state__action">
          <HomeWidgetAction onClick={() => onAction()} variant="primary">{actionLabel}</HomeWidgetAction>
        </span>
      )}
    </div>
  );
}
