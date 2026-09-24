import { toLocalDateString } from '@/utils/date';

export interface ActivityHeatmapRange {
  startDate: Date;
  endDate: Date;
  today: Date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfLocalDay(result);
}

/** Returns a Monday-Sunday grid which always contains the current local week. */
export function getActivityHeatmapRange(todayInput = new Date(), weeks = 8): ActivityHeatmapRange {
  const today = startOfLocalDay(todayInput);
  const dayFromMonday = (today.getDay() + 6) % 7;
  const currentWeekStart = addLocalDays(today, -dayFromMonday);
  const startDate = addLocalDays(currentWeekStart, -(Math.max(1, weeks) - 1) * 7);
  const endDate = addLocalDays(currentWeekStart, 6);
  return { startDate, endDate, today };
}

export function getActivityHeatmapDateKeys(todayInput = new Date(), weeks = 8): string[] {
  const { startDate, endDate } = getActivityHeatmapRange(todayInput, weeks);
  const keys: string[] = [];
  for (let current = startDate; current <= endDate; current = addLocalDays(current, 1)) {
    keys.push(toLocalDateString(current));
  }
  return keys;
}

/** Shared deterministic count thresholds for activity contribution grids. */
export function getActivityHeatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}
