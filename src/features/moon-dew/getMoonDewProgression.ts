import type { MoonDewLedgerEntry, FocusSessionEntry } from '@/types';
import { toLocalDateString } from '@/utils/date';
import { computeMoonDewBalance } from '@/utils/moonDewEngine';

export interface MoonDewDailyTask {
  id: string;
  title: string;
  completed: boolean;
  current: number;
  target: number;
}

export interface MoonDewProgression {
  currentBalance: number;
  lifetimeEarned: number;
  lifetimeLost: number;

  level: number;
  levelTitle: string;
  currentLevelStart: number;
  nextLevelTarget?: number;
  levelProgress: number;

  todayEarned: number;
  todayLost: number;

  checkInStreak: number;
  focusStreak: number;

  latestFocus?: {
    outcome: string;
    amount: number;
    createdAt: string;
  };

  dailyTasks: MoonDewDailyTask[];
}

export interface MoonDewLevelDef {
  level: number;
  title: string;
  start: number;
}

export const MOON_DEW_LEVELS: MoonDewLevelDef[] = [
  { level: 1, title: '初潮', start: 0 },
  { level: 2, title: '微光', start: 50 },
  { level: 3, title: '涨潮', start: 150 },
  { level: 4, title: '月湾', start: 300 },
  { level: 5, title: '满潮', start: 600 },
];

function getLevel(lifetime: number): { level: number; title: string; start: number; nextTarget?: number; progress: number } {
  let current: MoonDewLevelDef = MOON_DEW_LEVELS[0];
  for (const lvl of MOON_DEW_LEVELS) {
    if (lifetime >= lvl.start) current = lvl;
  }
  const next = MOON_DEW_LEVELS.find((l) => l.start > current.start);
  const progress = next
    ? Math.min(1, (lifetime - current.start) / (next.start - current.start))
    : 1;
  return {
    level: current.level,
    title: current.title,
    start: current.start,
    nextTarget: next?.start,
    progress: Number.isNaN(progress) ? 0 : progress,
  };
}

function localDateStr(isoStr: string): string {
  return isoStr.slice(0, 10);
}

export function getMoonDewProgression(
  ledger: MoonDewLedgerEntry[],
  focusSessions: FocusSessionEntry[] = [],
  /** Canonical streak from `useCheckInStore` (see `canonicalCheckInStreak.ts`). */
  checkInStreak = 0,
): MoonDewProgression {
  const todayStr = toLocalDateString();

  let lifetimeEarned = 0;
  let lifetimeLost = 0;
  let todayEarned = 0;
  let todayLost = 0;

  for (const entry of ledger) {
    if (entry.source === 'migration') continue;

    // Reversal entries offset the original
    if (entry.source === 'reversal') {
      const reversedAmount = entry.amount;
      if (reversedAmount > 0) {
        lifetimeEarned = Math.max(0, lifetimeEarned - reversedAmount);
      } else if (reversedAmount < 0) {
        lifetimeLost = Math.max(0, lifetimeLost - Math.abs(reversedAmount));
      }
      continue;
    }

    if (entry.amount > 0) {
      lifetimeEarned += entry.amount;
    } else if (entry.amount < 0) {
      lifetimeLost += Math.abs(entry.amount);
    }

    if (localDateStr(entry.createdAt) === todayStr) {
      if (entry.amount > 0) todayEarned += entry.amount;
      else if (entry.amount < 0) todayLost += Math.abs(entry.amount);
    }
  }

  lifetimeEarned = Number.isFinite(lifetimeEarned) ? lifetimeEarned : 0;
  lifetimeLost = Number.isFinite(lifetimeLost) ? lifetimeLost : 0;
  todayEarned = Number.isFinite(todayEarned) ? todayEarned : 0;
  todayLost = Number.isFinite(todayLost) ? todayLost : 0;

  const currentBalance = computeMoonDewBalance(ledger);
  const levelInfo = getLevel(lifetimeEarned);

  // Check-in streak — canonical source is useCheckInStore (passed by the caller);
  // the legacy check-in mirror in useAppStore is fenced and no longer read here.

  // Focus streak — consecutive days with completed focus sessions
  const focusDays = new Set<string>();
  for (const s of focusSessions) {
    if (s.status === 'completed' && s.date) {
      focusDays.add(s.date);
    }
  }
  let focusStreak = 0;
  let cursor = new Date();
  while (true) {
    const ds = toLocalDateString(cursor);
    if (focusDays.has(ds)) {
      focusStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Latest focus entry
  const focusEntries = ledger
    .filter((e) => e.source === 'focus')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestFocus = focusEntries.length > 0
    ? {
        outcome: focusEntries[0].reasonCode.includes('early_exit')
          ? 'early_exit'
          : focusEntries[0].reasonCode.includes('completed')
            ? 'completed'
            : focusEntries[0].reasonCode,
        amount: focusEntries[0].amount,
        createdAt: focusEntries[0].createdAt,
      }
    : undefined;

  // Daily tasks
  const checkinToday = ledger.some(
    (e) => e.source === 'daily_checkin' && localDateStr(e.createdAt) === todayStr,
  );

  const focusTodayCompleted = focusSessions.some(
    (s) => s.status === 'completed' && s.date === todayStr,
  );

  const focusMinutesToday = focusSessions
    .filter((s) => s.date === todayStr)
    .reduce((sum, s) => sum + (s.actualFocusMinutes || 0), 0);

  const honestCompletionToday = focusSessions.some(
    (s) => s.date === todayStr && s.flags?.honestCompletion === true,
  );

  const noEarlyEscapeToday = !focusSessions.some(
    (s) => s.date === todayStr && s.flags?.earlyEscape === true,
  );

  const dailyTasks: MoonDewDailyTask[] = [
    {
      id: 'checkin',
      title: '每日签到',
      completed: checkinToday,
      current: checkinToday ? 1 : 0,
      target: 1,
    },
    {
      id: 'focus-round',
      title: '完成一轮专注',
      completed: focusTodayCompleted,
      current: focusTodayCompleted ? 1 : 0,
      target: 1,
    },
    {
      id: 'focus-minutes',
      title: '累计专注 50 分钟',
      completed: focusMinutesToday >= 50,
      current: Math.min(focusMinutesToday, 50),
      target: 50,
    },
    {
      id: 'honest-recall',
      title: '完成诚实回报',
      completed: honestCompletionToday,
      current: honestCompletionToday ? 1 : 0,
      target: 1,
    },
    {
      id: 'no-early-exit',
      title: '今日无提前离开',
      completed: focusSessions.filter((s) => s.date === todayStr).length > 0 ? noEarlyEscapeToday : false,
      current: noEarlyEscapeToday ? 1 : 0,
      target: 1,
    },
  ];

  return {
    currentBalance,
    lifetimeEarned,
    lifetimeLost,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    currentLevelStart: levelInfo.start,
    nextLevelTarget: levelInfo.nextTarget,
    levelProgress: levelInfo.progress,
    todayEarned,
    todayLost,
    checkInStreak,
    focusStreak,
    latestFocus,
    dailyTasks,
  };
}