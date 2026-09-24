import type { AppIconName } from '@/components/icons/AppIcon';
import type { AppModuleId } from './types';

const APP_MODULE_ICON_MAP: Partial<Record<AppModuleId, AppIconName>> = {
  chat: 'chat',
  music: 'music',
  calendar: 'calendar',
  stash: 'archiveBox',
  quests: 'quest',
  works: 'portfolio',
  settings: 'settings',
  lifeLedger: 'listChecks',
  inspiration: 'lightbulb',
  tidewatch: 'tidewatch',
  moonlex: 'dictionary',
};

export function resolveAppModuleIconName(id: AppModuleId): AppIconName {
  return APP_MODULE_ICON_MAP[id] ?? 'sparkle';
}
