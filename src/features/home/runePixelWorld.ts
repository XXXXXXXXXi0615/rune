import { calendarDateTimeParts, deviceCalendarTimezone } from '@/calendar/core';
import { getModuleById } from '@/features/navigation/appModuleRegistry';
import type { AppModuleId } from '@/features/navigation/types';

export type RuneWorldDaypart = 'dawn' | 'day' | 'dusk' | 'night';

export interface RuneWorldHotspotDefinition {
  id: string;
  moduleId: AppModuleId;
  x: number;
  y: number;
}

const HOTSPOT_LAYOUT: readonly RuneWorldHotspotDefinition[] = [
  { id: 'tidewatch-observatory', moduleId: 'tidewatch', x: 0.20, y: 0.145 },
  { id: 'rune-stash-cottage', moduleId: 'stash', x: 0.62, y: 0.185 },
  { id: 'moonlex-library', moduleId: 'moonlex', x: 0.82, y: 0.365 },
  { id: 'chat-moon-gate', moduleId: 'chat', x: 0.18, y: 0.385 },
  { id: 'music-hall', moduleId: 'music', x: 0.18, y: 0.69 },
  { id: 'calendar-tower', moduleId: 'calendar', x: 0.84, y: 0.705 },
] as const;

export function resolveRuneWorldHotspots() {
  return HOTSPOT_LAYOUT.flatMap((hotspot) => {
    const module = getModuleById(hotspot.moduleId);
    if (!module?.enabled || module.deprecated) return [];
    return [{ ...hotspot, label: module.label, route: module.route }];
  });
}

export function deriveRuneWorldDaypart(
  instant: Date,
  timeZone = deviceCalendarTimezone(),
): RuneWorldDaypart {
  const hour = calendarDateTimeParts(instant, timeZone).hour;
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}
