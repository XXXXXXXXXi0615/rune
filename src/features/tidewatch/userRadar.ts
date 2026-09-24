import type { ActivityEvent, CheckIn, WritingTelemetryEvent } from './types';

export interface UserRadarAxis {
  id: 'mood' | 'energy' | 'focus' | 'consistency' | 'writing';
  label: string;
  value: number | null;
}

export interface UserRadarSummary {
  distinctCheckInDays: number;
  sufficient: boolean;
  writingBaselineStatus: 'ready' | 'forming';
  axes: UserRadarAxis[];
}

const DAY = 86_400_000;
const clampScore = (value: number) => Math.round(Math.min(100, Math.max(0, value)));
const localDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Pure seven-day presentation projection. It never writes scores or aggregate state. */
export function selectUserRadarSummary(
  checkIns: CheckIn[],
  activityLedger: ActivityEvent[],
  writingEvents: WritingTelemetryEvent[],
  now = Date.now(),
): UserRadarSummary {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const windowStart = today.getTime() - 6 * DAY;
  const windowEnd = today.getTime() + DAY;
  const recent = checkIns.filter((item) => item.createdAt >= windowStart && item.createdAt < windowEnd);
  const days = new Set(recent.map((item) => localDayKey(item.createdAt)));
  const sufficient = days.size >= 3;
  const normalizedAverage = (field: 'mood' | 'energy' | 'focus') => {
    const values = recent.map((item) => item[field]).filter((value): value is number => typeof value === 'number');
    return values.length ? clampScore((values.reduce((sum, value) => sum + value, 0) / values.length - 1) * 25) : null;
  };

  const recentWriting = writingEvents
    .filter((event) => event.actor === 'user' && event.timestamp >= windowStart && event.timestamp < windowEnd)
    .reduce((sum, event) => sum + event.committedChars, 0) / 7;
  const history = writingEvents.filter((event) => event.actor === 'user' && event.timestamp < windowStart);
  const earliest = history.length ? Math.min(...history.map((event) => event.timestamp)) : windowStart;
  const baselineDays = Math.max(1, Math.ceil((windowStart - earliest) / DAY));
  const historicalDailyAverage = history.reduce((sum, event) => sum + event.committedChars, 0) / baselineDays;
  const writingBaselineStatus = historicalDailyAverage > 0 ? 'ready' : 'forming';
  const writing = writingBaselineStatus === 'ready'
    ? (recentWriting === 0 ? 0 : clampScore((recentWriting / historicalDailyAverage) * 50))
    : null;

  // Ledger remains a canonical input seam for later axes; reading it here also makes
  // clear that this selector accepts metadata only and never fabricates check-ins.
  void activityLedger;

  return {
    distinctCheckInDays: days.size,
    sufficient,
    writingBaselineStatus,
    axes: [
      { id: 'mood', label: '心情', value: sufficient ? normalizedAverage('mood') : null },
      { id: 'energy', label: '能量', value: sufficient ? normalizedAverage('energy') : null },
      { id: 'focus', label: '專注', value: sufficient ? normalizedAverage('focus') : null },
      { id: 'consistency', label: '報備規律', value: sufficient ? clampScore(days.size / 7 * 100) : null },
      { id: 'writing', label: '書寫活動', value: sufficient ? writing : null },
    ],
  };
}
