export type GlobalUtilityId = 'search' | 'appearance' | 'rune' | 'quick-actions' | 'apps';

export interface GlobalUtilityDefinition {
  id: GlobalUtilityId;
  label: string;
  ariaLabel: string;
  route?: string;
  command?: 'open-quick-actions' | 'open-app-launcher';
}

export const GLOBAL_UTILITY_REGISTRY: readonly GlobalUtilityDefinition[] = [
  { id: 'search', label: '搜尋', ariaLabel: '開啟搜尋', route: '/chat?utility=search' },
  { id: 'appearance', label: '外觀', ariaLabel: '開啟外觀設定', route: '/settings/appearance' },
  { id: 'rune', label: 'Rune', ariaLabel: '開啟 Rune 與智能體設定', route: '/settings/agent' },
  { id: 'quick-actions', label: '快捷操作', ariaLabel: '開啟快捷操作', command: 'open-quick-actions' },
  { id: 'apps', label: '應用', ariaLabel: '開啟應用', command: 'open-app-launcher' },
] as const;

export function getGlobalUtilities(): readonly GlobalUtilityDefinition[] {
  return GLOBAL_UTILITY_REGISTRY;
}
