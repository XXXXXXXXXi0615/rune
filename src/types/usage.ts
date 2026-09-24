// ================================================================
// Usage Control Types — Phase 1
// Module-level time tracking, daily aggregates, time lock.
// ================================================================

export type UsageModuleId =
  | 'home'
  | 'chat'
  | 'journal'
  | 'music'
  | 'calendar'
  | 'moonread'
  | 'quests'
  | 'health'
  | 'settings'
  | 'focus'
  | 'ledger'
  | 'objects'
  | 'playroom'
  | 'works'
  | 'inspiration'
  | 'period'
  | 'life-rhythm'
  | 'gacha'
  | 'call'
  | 'timeline'
  | 'profile'
  | 'forum'
  | 'other';

export interface UsageSession {
  id: string;
  moduleId: UsageModuleId;
  startedAt: number;
  endedAt?: number;
  dateKey: string;
}

export interface DailyUsageRecord {
  dateKey: string;
  moduleDurationsMs: Partial<Record<UsageModuleId, number>>;
  totalDurationMs: number;
}

export interface UsageLockSettings {
  enabled: boolean;
  dailyLimitMinutes: number;
  allowTemporaryExtension: boolean;
}

export const DEFAULT_LOCK_SETTINGS: UsageLockSettings = {
  enabled: false,
  dailyLimitMinutes: 120,
  allowTemporaryExtension: false,
};

export interface UsageState {
  currentSession: UsageSession | null;
  isTracking: boolean;
  sessions: UsageSession[];
  dailyRecords: DailyUsageRecord[];
  lockSettings: UsageLockSettings;
  temporaryExtensionMinutes: number;
  extensionExpiresAt: number;
  extensionGrantedDateKey?: string;
  passwordBypassExpiresAt?: number;
  usageEvents: UsageEvent[];
  eventHistoryStartedAt: number;
  lockEpisodeActive: boolean;
}

export type UsageEventType = 'lock_triggered' | 'extension_granted';

export interface UsageEvent {
  id: string;
  type: UsageEventType;
  occurredAt: number;
  dateKey: string;
  dailyUsageMs?: number;
  dailyLimitMinutes?: number;
  extensionMinutes?: number;
}

export type TemporaryExtensionFailureReason =
  | 'not-allowed'
  | 'not-at-limit'
  | 'already-used-today'
  | 'already-active';

export type TemporaryExtensionGrantResult =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: TemporaryExtensionFailureReason };

export const PRESET_LIMITS = [30, 40, 60, 90, 120, 180] as const;

/**
 * Route path → UsageModuleId mapping.
 * First match wins.
 */
export const ROUTE_MODULE_MAP: [string | RegExp, UsageModuleId][] = [
  [/^\/$/, 'home'],
  [/^\/home(?:\/|$)/, 'home'],
  [/^\/chat\//, 'chat'],
  [/^\/chat$/, 'chat'],
  [/^\/journal\//, 'journal'],
  [/^\/journal$/, 'journal'],
  [/^\/diary\//, 'journal'],
  [/^\/music\//, 'music'],
  [/^\/music$/, 'music'],
  [/^\/calendar\//, 'calendar'],
  [/^\/calendar$/, 'calendar'],
  [/^\/moonread\//, 'moonread'],
  [/^\/moonread$/, 'moonread'],
  [/^\/quests\//, 'quests'],
  [/^\/quests$/, 'quests'],
  [/^\/todo/, 'quests'],
  [/^\/todos/, 'quests'],
  [/^\/health\//, 'health'],
  [/^\/health$/, 'health'],
  [/^\/settings\//, 'settings'],
  [/^\/settings$/, 'settings'],
  [/^\/focus\//, 'focus'],
  [/^\/focus$/, 'focus'],
  // Phase D: the Tide Ledger (/ledger) is retired — Moon Dew lives in the Home 報備
  // window and Exchange is the standalone /exchange utility, so the route no longer
  // owns a module id (same treatment as retired /diet).
  [/^\/objects\//, 'objects'],
  [/^\/objects$/, 'objects'],
  [/^\/playroom\//, 'playroom'],
  [/^\/works/, 'works'],
  [/^\/inspiration/, 'inspiration'],
  [/^\/period/, 'period'],
  [/^\/life-rhythm/, 'life-rhythm'],
  [/^\/gacha/, 'gacha'],
  [/^\/call/, 'call'],
  [/^\/timeline/, 'timeline'],
  [/^\/profile/, 'profile'],
  [/^\/forum/, 'forum'],
  [/^\/usage/, 'settings'],
];

export function resolveUsageModule(pathname: string): UsageModuleId {
  for (const [pattern, modId] of ROUTE_MODULE_MAP) {
    if (typeof pattern === 'string' && pathname === pattern) return modId;
    if (pattern instanceof RegExp && pattern.test(pathname)) return modId;
  }
  return 'other';
}

/** @deprecated Use resolveUsageModule. Kept for compatibility with existing consumers. */
export const resolveModuleId = resolveUsageModule;

export const MODULE_LABELS: Record<UsageModuleId, string> = {
  home: '首頁',
  chat: '聊天',
  journal: '手記',
  music: '音樂',
  calendar: '行事曆',
  moonread: '月讀',
  quests: '任務',
  health: '健康',
  settings: '設定',
  focus: '專注',
  ledger: '帳簿',
  objects: '物品',
  playroom: '遊樂室',
  works: '作品',
  inspiration: '靈感',
  period: '生理期',
  'life-rhythm': '生活節奏',
  gacha: '抽卡',
  call: '通話',
  timeline: '時間線',
  profile: '個人',
  forum: '論壇',
  other: '其他',
};

export const MODULE_LABELS_SHORT: Record<UsageModuleId, string> = {
  home: '首頁',
  chat: '聊天',
  journal: '手記',
  music: '音樂',
  calendar: '行事曆',
  moonread: '月讀',
  quests: '任務',
  health: '健康',
  settings: '設定',
  focus: '專注',
  ledger: '帳簿',
  objects: '物品',
  playroom: '遊樂',
  works: '作品',
  inspiration: '靈感',
  period: '生理',
  'life-rhythm': '生活',
  gacha: '抽卡',
  call: '通話',
  timeline: '時間',
  profile: '個人',
  forum: '論壇',
  other: '其他',
};
