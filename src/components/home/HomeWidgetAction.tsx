import type { ReactNode, MouseEvent } from 'react';

interface HomeWidgetActionProps {
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  variant?: 'primary' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
  label?: string;
}

/**
 * HomeWidgetAction — shared widget CTA / quick-action button.
 * Visual-only; stops propagation so it never triggers cell drag/click.
 */
export function HomeWidgetAction({
  children,
  onClick,
  variant = 'ghost',
  className,
  type = 'button',
  label,
}: HomeWidgetActionProps) {
  return (
    <button
      type={type}
      className={`hw-action${variant === 'primary' ? ' hw-action--primary' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
      data-no-widget-drag
      data-pet-safe-region="interactive"
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
    >
      {children}
    </button>
  );
}
