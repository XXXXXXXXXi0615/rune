import type { DailyUsageRecord, UsageEvent, UsageModuleId, UsageSession } from '@/types/usage';
import { toLocalDateString } from '@/utils/date';

export type UsageReportRange = 'today' | '7days' | '30days';

export interface UsageReportDay {
  dateKey: string;
  totalMs: number;
}

export interface UsageReportModule {
  moduleId: UsageModuleId;
  durationMs: number;
}

export interface UsageReportAggregation {
  days: UsageReportDay[];
  totalMs: number;
  previousTotalMs: number | null;
  comparisonPercent: number | null;
  modules: UsageReportModule[];
  moduleBreakdownComplete: boolean;
}

export interface UsageEventSummary {
  lockTriggers: number;
  extensionGrants: number;
  coverageComplete: boolean;
  coverageStartedAt: number;
}

const RANGE_DAYS: Record<UsageReportRange, number> = { today: 1, '7days': 7, '30days': 30 };

function localKeyOffset(now: Date, offset: number): string {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return toLocalDateString(date);
}

export function aggregateUsageReport(
  records: DailyUsageRecord[],
  range: UsageReportRange,
  now = new Date(),
  currentSession: UsageSession | null = null,
): UsageReportAggregation {
  const count = RANGE_DAYS[range];
  const recordMap = new Map(records.map((record) => [record.dateKey, record]));
  const keys = Array.from({ length: count }, (_, index) => localKeyOffset(now, index - count + 1));
  const previousKeys = Array.from({ length: count }, (_, index) => localKeyOffset(now, index - count * 2 + 1));
  const today = toLocalDateString(now);
  const activeTodayMs = currentSession
    ? Math.max(0, now.getTime() - Math.max(currentSession.startedAt, new Date(now).setHours(0, 0, 0, 0)))
    : 0;

  const days = keys.map((dateKey) => ({
    dateKey,
    totalMs: Math.max(0, recordMap.get(dateKey)?.totalDurationMs ?? 0) + (dateKey === today ? activeTodayMs : 0),
  }));
  const totalMs = days.reduce((sum, day) => sum + day.totalMs, 0);
  const previousRecords = previousKeys.map((key) => recordMap.get(key)).filter(Boolean) as DailyUsageRecord[];
  const previousTotalMs = previousRecords.length
    ? previousRecords.reduce((sum, record) => sum + Math.max(0, record.totalDurationMs), 0)
    : null;
  const comparisonPercent = previousTotalMs && previousTotalMs > 0
    ? Math.round(((totalMs - previousTotalMs) / previousTotalMs) * 100)
    : null;

  const moduleMap = new Map<UsageModuleId, number>();
  let moduleSum = 0;
  let moduleBreakdownComplete = true;
  for (const key of keys) {
    const record = recordMap.get(key);
    if (!record) continue;
    const entries = Object.entries(record.moduleDurationsMs ?? {});
    const recordModuleSum = entries.reduce((sum, [, ms]) => sum + (Number.isFinite(ms) ? Math.max(0, ms) : 0), 0);
    if (record.totalDurationMs > 0 && recordModuleSum < record.totalDurationMs) moduleBreakdownComplete = false;
    for (const [moduleId, rawMs] of entries) {
      const ms = Number.isFinite(rawMs) ? Math.max(0, rawMs) : 0;
      moduleSum += ms;
      moduleMap.set(moduleId as UsageModuleId, (moduleMap.get(moduleId as UsageModuleId) ?? 0) + ms);
    }
  }
  if (currentSession && keys.includes(today)) {
    moduleSum += activeTodayMs;
    moduleMap.set(currentSession.moduleId, (moduleMap.get(currentSession.moduleId) ?? 0) + activeTodayMs);
  }
  if (moduleSum < totalMs) moduleBreakdownComplete = false;

  return {
    days,
    totalMs,
    previousTotalMs,
    comparisonPercent,
    modules: [...moduleMap.entries()]
      .map(([moduleId, durationMs]) => ({ moduleId, durationMs }))
      .filter((item) => item.durationMs > 0)
      .sort((a, b) => b.durationMs - a.durationMs || a.moduleId.localeCompare(b.moduleId)),
    moduleBreakdownComplete,
  };
}

export function aggregateUsageEvents(
  events: UsageEvent[],
  eventHistoryStartedAt: number,
  range: UsageReportRange,
  now = new Date(),
): UsageEventSummary {
  const count = RANGE_DAYS[range];
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - count + 1);
  const rangeEnd = new Date(now);
  rangeEnd.setHours(23, 59, 59, 999);
  const relevant = events.filter((event) => (
    Number.isFinite(event.occurredAt)
    && event.occurredAt >= rangeStart.getTime()
    && event.occurredAt <= rangeEnd.getTime()
  ));
  return {
    lockTriggers: relevant.filter((event) => event.type === 'lock_triggered').length,
    extensionGrants: relevant.filter((event) => event.type === 'extension_granted').length,
    coverageComplete: Number.isFinite(eventHistoryStartedAt) && eventHistoryStartedAt <= rangeStart.getTime(),
    coverageStartedAt: eventHistoryStartedAt,
  };
}
