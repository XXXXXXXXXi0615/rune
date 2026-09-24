import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import './HomeWidgetShell.css';

export type HomeWidgetPreset = 'island' | 'small' | 'medium' | 'large' | 'orb';
export type HomeWidgetMaterial = 'surface' | 'bare';

type HomeWidgetShellProps<T extends ElementType = 'section'> = {
  as?: T;
  children: ReactNode;
  preset: HomeWidgetPreset;
  material?: HomeWidgetMaterial;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function HomeWidgetShell<T extends ElementType = 'section'>({
  as,
  children,
  preset,
  material = 'surface',
  className,
  ...props
}: HomeWidgetShellProps<T>) {
  const Component = as ?? 'section';
  const classes = [
    'home-widget-shell',
    `home-widget-shell--${preset}`,
    `home-widget-shell--${material}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component
      className={classes}
      data-home-widget-shell
      data-home-widget-preset={preset}
      data-home-widget-material={material}
      {...props}
    >
      {children}
    </Component>
  );
}
