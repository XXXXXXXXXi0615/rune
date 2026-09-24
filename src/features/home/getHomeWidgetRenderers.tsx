import type { ReactNode } from 'react';
import type { HomeWidgetSize } from '@/features/home/types';
import { PeriodHomeWidget } from '@/components/home/PeriodHomeWidget';
import { MoonLexHomeWidget } from '@/components/home/MoonLexHomeWidget';

/**
 * Maps widget IDs to their content renderers.
 * Each widget reuses existing data sources — no new stores.
 */
export function getHomeWidgetRenderers(
  overrides: Partial<Record<string, (props: { size: HomeWidgetSize }) => ReactNode>> = {},
): Record<string, (props: { size: HomeWidgetSize }) => ReactNode> {
  return {
    'home-period': ({ size }) => <PeriodHomeWidget size={size} />,
    'home-moonlex': ({ size }) => <MoonLexHomeWidget size={size} />,
    ...overrides,
  };
}
