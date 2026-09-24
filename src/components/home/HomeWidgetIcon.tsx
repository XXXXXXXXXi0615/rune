import { AppIcon } from '@/components/icons/AppIcon';
import type { AppIconName } from '@/components/icons/AppIcon';

export type HomeWidgetIconName =
  | 'checkin'
  | 'task'
  | 'period'
  | 'anniversary'
  | 'lunaris'
  | 'activity'
  | 'hydration'
  | 'moonlex';

export type HomeWidgetIconSize = 'xs' | 'sm' | 'md' | 'lg';

interface HomeWidgetIconProps {
  name: HomeWidgetIconName;
  size?: HomeWidgetIconSize;
  decorative?: boolean;
  label?: string;
}

/**
 * Canonical icon mapping — single source of truth.
 * All widget icons resolve here; no widget hard-codes its own icon.
 */
export const HOME_WIDGET_ICON_MAP: Record<HomeWidgetIconName, AppIconName> = {
  checkin: 'checkCircle',
  task: 'listChecks',
  period: 'tideclock',
  anniversary: 'calendarHeart',
  lunaris: 'orbit',
  activity: 'chartActivity',
  hydration: 'water',
  moonlex: 'bookOpen',
};

/** Pixel sizes for the SVG icon inside the shell (16/20/24/28px scale). */
const SIZE_PX: Record<HomeWidgetIconSize, number> = { xs: 16, sm: 20, md: 24, lg: 28 };

/** Back-compat aliases: 'sm'/'md' now follow the canonical 20/24px scale. */
const LEGACY_SIZE_ALIAS: Record<string, HomeWidgetIconSize> = {};

export function HomeWidgetIcon({ name, size = 'md', decorative, label }: HomeWidgetIconProps) {
  const resolvedSize: HomeWidgetIconSize = LEGACY_SIZE_ALIAS[size] ?? size;
  const iconName = HOME_WIDGET_ICON_MAP[name];
  const px = SIZE_PX[resolvedSize];

  return (
    <span
      className="home-widget-icon-shell"
      data-home-widget-icon={name}
      data-home-widget-icon-size={resolvedSize}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative && label ? label : undefined}
    >
      <AppIcon name={iconName} size={px} />
    </span>
  );
}
