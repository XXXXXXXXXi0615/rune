export type FocusAchievementId =
  | 'focus-001' | 'focus-005' | 'focus-010' | 'focus-020'
  | 'focus-longest-060' | 'focus-sessions-005' | 'focus-day-120'
  | 'focus-streak-003' | 'focus-dawn-001' | 'focus-quest-001';

export interface FocusAchievementContext {
  totalFocusSeconds: number;
  focusSessionCount: number;
  longestFocusSeconds: number;
  bestDayFocusSeconds: number;
  longestFocusStreakDays: number;
  dawnOrLateSessionCount: number;
  mainQuestFocusSessionCount: number;
}

export interface FocusAchievementEvaluation {
  unlocked: boolean;
  current: number;
  target: number;
  progress: number;
}

export interface FocusAchievementDefinition {
  id: FocusAchievementId;
  title: string;
  description: string;
  conditionLabel: string;
  progressUnit: '秒' | '次' | '天';
  category: 'duration' | 'sessions' | 'streak' | 'time' | 'milestone';
  iconId: string;
  hidden: boolean;
  sortOrder: number;
  evaluate: (context: FocusAchievementContext) => FocusAchievementEvaluation;
}

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const threshold = (read: (context: FocusAchievementContext) => number, target: number) =>
  (context: FocusAchievementContext): FocusAchievementEvaluation => {
    const current = safe(read(context));
    return { unlocked: current >= target, current, target, progress: Math.max(0, Math.min(1, current / target)) };
  };

export const FOCUS_ACHIEVEMENT_REGISTRY: readonly FocusAchievementDefinition[] = [
  { id: 'focus-001', title: '初次靠岸', description: '在專注航程中累積一小時。', conditionLabel: '生涯專注達 1 小時', progressUnit: '秒', category: 'duration', iconId: 'first-landfall', hidden: false, sortOrder: 10, evaluate: threshold((c) => c.totalFocusSeconds, 3600) },
  { id: 'focus-005', title: '點亮桌燈', description: '讓桌燈陪你守住五小時。', conditionLabel: '生涯專注達 5 小時', progressUnit: '秒', category: 'duration', iconId: 'desk-lamp', hidden: false, sortOrder: 20, evaluate: threshold((c) => c.totalFocusSeconds, 5 * 3600) },
  { id: 'focus-010', title: '潮聲漸近', description: '累積十小時，潮聲開始有了方向。', conditionLabel: '生涯專注達 10 小時', progressUnit: '秒', category: 'duration', iconId: 'rising-tide', hidden: false, sortOrder: 30, evaluate: threshold((c) => c.totalFocusSeconds, 10 * 3600) },
  { id: 'focus-020', title: '長潮不息', description: '把二十小時專注留在潮線上。', conditionLabel: '生涯專注達 20 小時', progressUnit: '秒', category: 'duration', iconId: 'endless-tide', hidden: false, sortOrder: 40, evaluate: threshold((c) => c.totalFocusSeconds, 20 * 3600) },
  { id: 'focus-longest-060', title: '一程望月', description: '完成一段至少一小時的單次航程。', conditionLabel: '單次最長航程達 1 小時', progressUnit: '秒', category: 'milestone', iconId: 'long-voyage', hidden: false, sortOrder: 50, evaluate: threshold((c) => c.longestFocusSeconds, 3600) },
  { id: 'focus-sessions-005', title: '五次守約', description: '正式完成五次專注航程。', conditionLabel: '完成 5 次航程', progressUnit: '次', category: 'sessions', iconId: 'five-voyages', hidden: false, sortOrder: 60, evaluate: threshold((c) => c.focusSessionCount, 5) },
  { id: 'focus-day-120', title: '滿潮之日', description: '在同一個本地日期累積兩小時專注。', conditionLabel: '單日專注達 2 小時', progressUnit: '秒', category: 'duration', iconId: 'full-tide-day', hidden: false, sortOrder: 70, evaluate: threshold((c) => c.bestDayFocusSeconds, 2 * 3600) },
  { id: 'focus-streak-003', title: '三日潮線', description: '連續三個本地日期留下專注紀錄。', conditionLabel: '連續專注 3 日', progressUnit: '天', category: 'streak', iconId: 'three-day-tide', hidden: false, sortOrder: 80, evaluate: threshold((c) => c.longestFocusStreakDays, 3) },
  { id: 'focus-dawn-001', title: '星月交班', description: '在深夜或清晨完成一趟航程。', conditionLabel: '23:00–06:59 開始並完成 1 次航程', progressUnit: '次', category: 'time', iconId: 'dawn-watch', hidden: false, sortOrder: 90, evaluate: threshold((c) => c.dawnOrLateSessionCount, 1) },
  { id: 'focus-quest-001', title: '主航線確立', description: '完成一趟已連結今日主任務的專注。', conditionLabel: '完成 1 次主任務專注', progressUnit: '次', category: 'milestone', iconId: 'main-quest', hidden: false, sortOrder: 100, evaluate: threshold((c) => c.mainQuestFocusSessionCount, 1) },
] as const;

export const FOCUS_ACHIEVEMENT_BY_ID = new Map(FOCUS_ACHIEVEMENT_REGISTRY.map((item) => [item.id, item]));

export function getFocusAchievementSummary(definition: FocusAchievementDefinition, evaluation: FocusAchievementEvaluation) {
  if (definition.hidden && !evaluation.unlocked) return { title: '隱藏潮痕', description: '完成條件後才會揭曉。', conditionLabel: '條件尚未揭曉' };
  return { title: definition.title, description: definition.description, conditionLabel: definition.conditionLabel };
}
