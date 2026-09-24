import type { FocusSessionEntry, MoonDewLedgerEntry, MemoryEntry } from '@/types';
import { toLocalDateString } from '@/utils/date';

export type TimeSlotId =
  | 'early_morning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'late_night';

export interface WeeklyDay {
  date: string;
  label: string;
  minutes: number;
  completedSessions: number;
}

export interface TimeSlotStat {
  id: TimeSlotId;
  label: string;
  minutes: number;
  sessionCount: number;
}

export interface FocusOutcomes {
  kept: number;
  interrupted: number;
  caught: number;
}

export interface MoonDewWeekly {
  earnedThisWeek: number;
  lostThisWeek: number;
}

export interface FocusStatistics {
  todayMinutes: number;
  yesterdayMinutes: number;
  weekMinutes: number;
  previousWeekMinutes: number;
  monthCompletedSessions: number;
  monthTotalSessions: number;
  currentStreakDays: number;
  longestStreakDays: number;
  completionRate: number;
  weeklyDays: WeeklyDay[];
  timeSlots: TimeSlotStat[];
  bestTimeSlot?: string;
  outcomes: FocusOutcomes;
  moonDew: MoonDewWeekly;
  totalMinutes: number;
  totalSessions: number;
  totalCompletedSessions: number;
}

export interface FocusAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const TIME_SLOT_CONFIG: { id: TimeSlotId; label: string; start: number; end: number }[] = [
  { id: 'early_morning', label: '早晨', start: 6, end: 9 },
  { id: 'morning', label: '上午', start: 9, end: 12 },
  { id: 'afternoon', label: '下午', start: 12, end: 17 },
  { id: 'evening', label: '傍晚', start: 17, end: 20 },
  { id: 'night', label: '夜晚', start: 20, end: 24 },
  { id: 'late_night', label: '深夜', start: 0, end: 6 },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isValidSession(entry: FocusSessionEntry): boolean {
  if (!entry || !entry.id) return false;
  if (typeof entry.actualFocusMinutes !== 'number' || isNaN(entry.actualFocusMinutes)) return false;
  if (entry.actualFocusMinutes < 0) return false;
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  if (typeof entry.startTime !== 'number' || isNaN(entry.startTime)) return false;
  return true;
}

/** Get effective endTime, using startTime + actualFocusMinutes as fallback for old records. */
function getEffectiveEndTime(entry: FocusSessionEntry): number {
  if (typeof entry.endTime === 'number' && !isNaN(entry.endTime) && entry.endTime > entry.startTime) {
    return entry.endTime;
  }
  if (import.meta.env.DEV) {
    console.warn('[focusStats] session %s missing valid endTime, estimating from startTime + actualFocusMinutes', entry.id);
  }
  return entry.startTime + Math.max(entry.actualFocusMinutes, 0) * 60 * 1000;
}

function getTimeSlotForHour(hour: number): TimeSlotId {
  if (hour >= 6 && hour < 9) return 'early_morning';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20 && hour < 24) return 'night';
  return 'late_night';
}

/** Split a session's minutes across local calendar dates when it crosses midnight. */
function splitByLocalDate(
  startTime: number,
  endTime: number,
  totalMinutes: number,
): { date: string; minutes: number; timeSlotMinutes: Record<TimeSlotId, number> }[] {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startStr = toLocalDateString(start);
  const endStr = toLocalDateString(end);

  if (startStr === endStr) {
    const slotId = getTimeSlotForHour(start.getHours());
    return [{
      date: startStr,
      minutes: totalMinutes,
      timeSlotMinutes: makeTimeSlotRecord(slotId, totalMinutes),
    }];
  }

  // Cross-midnight: split proportionally
  const msTotal = endTime - startTime;
  if (msTotal <= 0) {
    return [{ date: startStr, minutes: totalMinutes, timeSlotMinutes: makeTimeSlotRecord(getTimeSlotForHour(start.getHours()), totalMinutes) }];
  }

  // Midnight after start
  const midnight = new Date(start);
  midnight.setHours(24, 0, 0, 0);
  const msBeforeMidnight = midnight.getTime() - startTime;
  const fractionBefore = msBeforeMidnight / msTotal;
  const minutesBefore = Math.round(totalMinutes * fractionBefore);
  const minutesAfter = totalMinutes - minutesBefore;

  const startSlot = getTimeSlotForHour(start.getHours());
  const endSlot = getTimeSlotForHour(end.getHours());

  const result: { date: string; minutes: number; timeSlotMinutes: Record<TimeSlotId, number> }[] = [];

  if (minutesBefore > 0) {
    result.push({ date: startStr, minutes: minutesBefore, timeSlotMinutes: makeTimeSlotRecord(startSlot, minutesBefore) });
  }
  if (minutesAfter > 0) {
    result.push({ date: endStr, minutes: minutesAfter, timeSlotMinutes: makeTimeSlotRecord(endSlot, minutesAfter) });
  }

  if (result.length === 0) {
    result.push({ date: startStr, minutes: totalMinutes, timeSlotMinutes: makeTimeSlotRecord(startSlot, totalMinutes) });
  }

  return result;
}

/** Create a time slot minutes record with a single slot set. */
function makeTimeSlotRecord(slotId: TimeSlotId, minutes: number): Record<TimeSlotId, number> {
  return { [slotId]: minutes } as Record<TimeSlotId, number>;
}
function buildSessionFallback(
  memories: MemoryEntry[] | undefined,
  ledger: MoonDewLedgerEntry[],
): Map<string, { outcome?: string; goodRecovery?: boolean }> {
  const map = new Map<string, { outcome?: string; goodRecovery?: boolean }>();

  // From memory entries with source='focus'
  if (memories) {
    for (const m of memories) {
      if (m.source !== 'focus') continue;
      const meta = m.metadata as Record<string, unknown> | undefined;
      const sid = meta?.sessionId as string | undefined;
      if (!sid) continue;
      const existing = map.get(sid) || {};
      if (meta?.eventType === 'completed') existing.outcome = 'kept';
      else if (meta?.eventType === 'early_exit' || meta?.eventType === 'abandoned') existing.outcome = 'caught';
      else existing.outcome = 'recorded';
      const f = meta?.flags as Record<string, unknown> | undefined;
      if (f?.goodRecovery === true) existing.goodRecovery = true;
      map.set(sid, existing);
    }
  }

  // From ledger with reasonCode 'focus:good_recovery'
  for (const e of ledger) {
    if (e.source !== 'focus') continue;
    const sid = e.relatedEntityId;
    if (!sid) continue;
    if (e.reasonCode === 'focus:good_recovery') {
      const existing = map.get(sid) || {};
      existing.goodRecovery = true;
      map.set(sid, existing);
    }
  }

  return map;
}

function computeStreaks(sessions: FocusSessionEntry[]): { current: number; longest: number } {
  const completedDates = new Set<string>();
  for (const s of sessions) {
    if (isValidSession(s) && s.status === 'completed') {
      completedDates.add(s.date);
    }
  }

  if (completedDates.size === 0) return { current: 0, longest: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(today);
  const yesterdayStr = toLocalDateString(addDays(today, -1));

  let current = 0;
  let cursor = new Date(today);

  if (completedDates.has(todayStr)) {
    current = 1;
    // Check if yesterday also has a completed session
    cursor = addDays(today, -1);
    while (completedDates.has(toLocalDateString(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
    }
  } else if (completedDates.has(yesterdayStr)) {
    current = 1;
    // Yesterday has completed, check day before
    cursor = addDays(today, -2);
    while (completedDates.has(toLocalDateString(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
    }
  } else {
    return { current: 0, longest: computeLongestStreak(completedDates) };
  }

  return { current, longest: computeLongestStreak(completedDates) };
}

function computeLongestStreak(completedDates: Set<string>): number {
  if (completedDates.size === 0) return 0;

  const sorted = Array.from(completedDates).sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);

    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function getFocusStatistics(
  sessions: FocusSessionEntry[],
  ledger: MoonDewLedgerEntry[],
  memories?: MemoryEntry[],
): FocusStatistics {
  const validSessions = sessions.filter(isValidSession);
  const fallbackMap = buildSessionFallback(memories, ledger);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(now);
  const yesterdayStr = toLocalDateString(addDays(now, -1));

  const monday = getMonday(now);
  const sunday = addDays(monday, 6);
  const prevMonday = addDays(monday, -7);
  const prevSunday = addDays(prevMonday, 6);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStr = toLocalDateString(monthStart);

  let todayMinutes = 0;
  let yesterdayMinutes = 0;
  let weekMinutes = 0;
  let previousWeekMinutes = 0;
  let monthCompletedSessions = 0;
  let monthTotalSessions = 0;
  let totalMinutes = 0;
  let totalSessions = 0;
  let totalCompletedSessions = 0;

  const outcomes: FocusOutcomes = { kept: 0, interrupted: 0, caught: 0 };

  const timeSlotMap = new Map<TimeSlotId, { minutes: number; sessionCount: number }>();
  for (const slot of TIME_SLOT_CONFIG) {
    timeSlotMap.set(slot.id, { minutes: 0, sessionCount: 0 });
  }

  const weeklyDayMap = new Map<string, { minutes: number; completedSessions: number }>();
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const ds = toLocalDateString(d);
    weeklyDayMap.set(ds, { minutes: 0, completedSessions: 0 });
  }

  for (const s of validSessions) {
    const endTime = getEffectiveEndTime(s);
    const mins = Math.max(0, Math.round(s.actualFocusMinutes));
    const dateSlices = splitByLocalDate(s.startTime, endTime, mins);
    const isCompleted = s.status === 'completed';

    // Determine outcome via priority: session field → fallback → default
    let sessionOutcome: 'kept' | 'recorded' | 'caught';
    if (s.outcome) {
      sessionOutcome = s.outcome;
    } else if (isCompleted) {
      sessionOutcome = 'kept';
    } else {
      // Fallback: check memory/ledger by sessionId
      const fb = s.sessionId ? fallbackMap.get(s.sessionId) : undefined;
      if (fb?.outcome === 'kept') sessionOutcome = 'kept';
      else if (fb?.outcome === 'caught') sessionOutcome = 'caught';
      else sessionOutcome = 'recorded'; // default for interrupted without evidence
    }

    totalMinutes += mins;
    totalSessions++;

    if (isCompleted) {
      totalCompletedSessions++;
    }

    if (sessionOutcome === 'kept') outcomes.kept++;
    else if (sessionOutcome === 'caught') outcomes.caught++;
    else outcomes.interrupted++;

    // Cross-midnight: distribute minutes across date slices
    let monthCounted = false;
    for (const slice of dateSlices) {
      const sliceMins = slice.minutes;

      if (slice.date === todayStr) {
        todayMinutes += sliceMins;
      } else if (slice.date === yesterdayStr) {
        yesterdayMinutes += sliceMins;
      }

      const sliceDate = new Date(slice.date + 'T00:00:00');
      if (sliceDate >= monday && sliceDate <= sunday) {
        weekMinutes += sliceMins;
        const dayData = weeklyDayMap.get(slice.date);
        if (dayData) {
          dayData.minutes += sliceMins;
          if (isCompleted) dayData.completedSessions++;
        }
      } else if (sliceDate >= prevMonday && sliceDate <= prevSunday) {
        previousWeekMinutes += sliceMins;
      }

      if (slice.date >= monthStr && !monthCounted) {
        monthTotalSessions++;
        if (isCompleted) monthCompletedSessions++;
        monthCounted = true;
      }

      // Time slot split: distribute across time slots
      for (const [slotId, slotMins] of Object.entries(slice.timeSlotMinutes)) {
        const slotData = timeSlotMap.get(slotId as TimeSlotId);
        if (slotData) {
          slotData.minutes += slotMins;
          if (slice === dateSlices[0] && Object.entries(slice.timeSlotMinutes)[0][0] === slotId) {
            // Only count session for the first time slot to avoid double counting
            if (dateSlices.length === 1 || slice === dateSlices[0]) {
              // Count session for the first slice only
            }
          }
        }
      }
    }

    // Count session in the time slot of the start time
    const startHour = new Date(s.startTime).getHours();
    const startSlotId = getTimeSlotForHour(startHour);
    const startSlotData = timeSlotMap.get(startSlotId);
    if (startSlotData) {
      startSlotData.sessionCount++;
    }
  }

  const completionRate = totalSessions > 0
    ? Math.round((totalCompletedSessions / totalSessions) * 100)
    : 0;

  const weeklyDays: WeeklyDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const ds = toLocalDateString(d);
    const data = weeklyDayMap.get(ds) || { minutes: 0, completedSessions: 0 };
    weeklyDays.push({
      date: ds,
      label: WEEKDAY_LABELS[i],
      minutes: data.minutes,
      completedSessions: data.completedSessions,
    });
  }

  const timeSlots: TimeSlotStat[] = TIME_SLOT_CONFIG.map((cfg) => {
    const data = timeSlotMap.get(cfg.id) || { minutes: 0, sessionCount: 0 };
    return { id: cfg.id, label: cfg.label, minutes: data.minutes, sessionCount: data.sessionCount };
  });

  let bestTimeSlot: string | undefined;
  if (totalSessions >= 5) {
    let maxMinutes = 0;
    for (const slot of timeSlots) {
      if (slot.minutes > maxMinutes) {
        maxMinutes = slot.minutes;
        bestTimeSlot = slot.label;
      }
    }
  }

  const { current: currentStreakDays, longest: longestStreakDays } = computeStreaks(validSessions);

  const todayFocusLedger = ledger.filter((e) => {
    if (e.source !== 'focus') return false;
    const entryDate = e.createdAt.slice(0, 10);
    return entryDate >= toLocalDateString(monday) && entryDate <= todayStr;
  });

  let earnedThisWeek = 0;
  let lostThisWeek = 0;
  for (const e of todayFocusLedger) {
    if (e.amount > 0) earnedThisWeek += e.amount;
    else lostThisWeek += Math.abs(e.amount);
  }

  return {
    todayMinutes,
    yesterdayMinutes,
    weekMinutes,
    previousWeekMinutes,
    monthCompletedSessions,
    monthTotalSessions,
    currentStreakDays,
    longestStreakDays,
    completionRate,
    weeklyDays,
    timeSlots,
    bestTimeSlot,
    outcomes,
    moonDew: { earnedThisWeek, lostThisWeek },
    totalMinutes,
    totalSessions,
    totalCompletedSessions,
  };
}

export function getFocusAchievements(
  stats: FocusStatistics,
  sessions: FocusSessionEntry[],
  ledger: MoonDewLedgerEntry[],
): FocusAchievement[] {
  const maxSingleSession = sessions.reduce((max, s) => {
    if (!isValidSession(s)) return max;
    return Math.max(max, Math.round(s.actualFocusMinutes));
  }, 0);

  // Phase 2.1: priority — session.flags.goodRecovery first, then ledger fallback
  const hasRecoveryInSessions = sessions.some(
    (s) => isValidSession(s) && s.flags?.goodRecovery === true,
  );
  const hasRecoveryInLedger = ledger.some((e) => e.source === 'focus' && e.reasonCode === 'focus:good_recovery');
  const hasRecovery = hasRecoveryInSessions || hasRecoveryInLedger;

  const achievements: FocusAchievement[] = [
    {
      id: 'moonrise',
      title: '月升',
      description: '首次完成一輪專注',
      icon: 'moonrise',
      unlocked: stats.totalCompletedSessions >= 1,
      progress: Math.min(stats.totalCompletedSessions, 1),
      target: 1,
    },
    {
      id: 'punctual',
      title: '守時者',
      description: '累計專注 10 小時',
      icon: 'punctual',
      unlocked: stats.totalMinutes >= 600,
      progress: Math.min(stats.totalMinutes, 600),
      target: 600,
    },
    {
      id: 'tide',
      title: '潮流',
      description: '完成 50 輪專注',
      icon: 'tide',
      unlocked: stats.totalCompletedSessions >= 50,
      progress: Math.min(stats.totalCompletedSessions, 50),
      target: 50,
    },
    {
      id: 'streak7',
      title: '連續守約',
      description: '連續 7 天完成專注',
      icon: 'streak',
      unlocked: stats.longestStreakDays >= 7,
      progress: Math.min(stats.longestStreakDays, 7),
      target: 7,
    },
    {
      id: 'deep',
      title: '深度',
      description: '單輪專注達到 60 分鐘',
      icon: 'deep',
      unlocked: maxSingleSession >= 60,
      progress: Math.min(maxSingleSession, 60),
      target: 60,
    },
    {
      id: 'recovery',
      title: '恢復者',
      description: '完成一次暫停後仍守約',
      icon: 'recovery',
      unlocked: hasRecovery,
      progress: hasRecovery ? 1 : 0,
      target: 1,
    },
  ];

  return achievements;
}

export function getLunarisObservation(stats: FocusStatistics): string {
  if (stats.totalSessions === 0) {
    return '還沒有專注記錄，完成第一輪後，這裡會開始記錄你的節奏。';
  }

  const weekDelta = stats.weekMinutes - stats.previousWeekMinutes;
  const parts: string[] = [];

  if (stats.previousWeekMinutes > 0 && weekDelta !== 0) {
    const pct = Math.round(Math.abs(weekDelta) / stats.previousWeekMinutes * 100);
    if (weekDelta > 0) {
      parts.push(`本週比上週增加了 ${pct}% 的專注時間。`);
    } else {
      parts.push(`本週比上週減少了 ${pct}% 的專注時間。`);
    }
  } else if (stats.weekMinutes > 0) {
    parts.push(`本週已累積 ${formatMinutes(stats.weekMinutes)} 的專注。`);
  }

  if (stats.bestTimeSlot) {
    parts.push(`你的高效時段在${stats.bestTimeSlot}。`);
  } else if (stats.totalSessions < 5) {
    parts.push('繼續記錄後，這裡會形成你的專注節奏。');
  }

  if (stats.currentStreakDays >= 7) {
    parts.push(`你已經連續守約 ${stats.currentStreakDays} 天，節奏很穩定。`);
  } else if (stats.currentStreakDays >= 3) {
    parts.push(`連續守約 ${stats.currentStreakDays} 天，保持下去。`);
  } else if (stats.currentStreakDays === 0 && stats.totalCompletedSessions > 0) {
    parts.push('連續記錄中斷了，今天再開一輪吧。');
  }

  if (stats.completionRate >= 80) {
    parts.push(`完成率 ${stats.completionRate}%，守約品質很好。`);
  } else if (stats.completionRate >= 50) {
    parts.push(`完成率 ${stats.completionRate}%，還不錯，繼續穩定。`);
  } else if (stats.totalSessions >= 3) {
    parts.push(`完成率 ${stats.completionRate}%，試著把每輪做完整。`);
  }

  return parts.length > 0 ? parts.join('') : '專注的節奏正在形成中。';
}

export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 分鐘';
  if (mins < 60) return `${mins} 分鐘`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分`;
}
