import type { ReactNode } from 'react';

export type HomeWidgetState = 'empty' | 'active' | 'completed' | 'disabled';

export type HomeWidgetSizeAttr = 'small' | 'medium' | 'wide' | 'large' | 'full';

interface HomeWidgetSurfaceProps {
  children: ReactNode;
  state?: HomeWidgetState;
  size?: HomeWidgetSizeAttr;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * HomeWidgetSurface — shared glass surface primitive.
 *
 * Visual-only wrapper (tokens in home-widget-visual.css). Does NOT touch
 * the grid cell, drag, or layout: it renders inside the existing cell.
 */
export function HomeWidgetSurface({
  children,
  state = 'active',
  size,
  interactive = false,
  className,
  onClick,
}: HomeWidgetSurfaceProps) {
  return (
    <div
      className={`hw-surface${interactive ? ' hw-surface--interactive' : ''}${className ? ` ${className}` : ''}`}
      data-home-widget-state={state}
      data-home-widget-size={size}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
