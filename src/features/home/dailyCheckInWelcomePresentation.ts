import type { CheckInRecord } from '@/features/tideclock/types';

export interface DailyCheckInMonthSummary {
  checked: number;
  missed: number;
}

export function deriveDailyCheckInMonthSummary(records: CheckInRecord[], now: Date): DailyCheckInMonthSummary {
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const statuses = new Map<string, CheckInRecord['status']>();
  for (const record of records) {
    if (record.kind === 'clock_in' && record.date.startsWith(prefix)) statuses.set(record.date, record.status);
  }
  let checked = 0;
  let missed = 0;
  for (const status of statuses.values()) {
    if (status === 'completed' || status === 'late') checked += 1;
    if (status === 'makeup_required') missed += 1;
  }
  return { checked, missed };
}
