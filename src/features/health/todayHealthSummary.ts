import type { HealthRecord } from './healthDomain';
import type { HydrationEntry } from '@/store/useHydrationStore';
import type { PeriodRecord } from '@/utils/periodStorage';

export interface TodayHealthSummaryInput {
  dateKey: string;
  records: HealthRecord[];
  hydrationEntries: HydrationEntry[];
  hydrationGoalMl: number;
  periods: PeriodRecord[];
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours} 小時 ${remainder} 分`;
  if (hours) return `${hours} 小時`;
  return `${remainder} 分`;
}

function latest(records: HealthRecord[]): HealthRecord | undefined {
  return [...records].sort((a, b) => {
    const aTime = a.occurredAt || a.updatedAt;
    const bTime = b.occurredAt || b.updatedAt;
    return bTime.localeCompare(aTime);
  })[0];
}

function periodDay(record: PeriodRecord, dateKey: string): number {
  const start = Date.parse(`${record.startDate}T00:00:00Z`);
  const date = Date.parse(`${dateKey}T00:00:00Z`);
  return Math.floor((date - start) / 86_400_000) + 1;
}

/** Pure read-only projection for text the user can choose to paste elsewhere. */
export function buildTodayHealthSummary(input: TodayHealthSummaryInput): string | null {
  const { dateKey, records, hydrationEntries, hydrationGoalMl, periods } = input;
  const todayRecords = records.filter((record) => record.occurredOn === dateKey);
  const lines: string[] = [];

  const sleep = latest(todayRecords.filter((record) => record.value.kind === 'sleep'));
  if (sleep?.value.kind === 'sleep') lines.push(`睡眠：${formatDuration(sleep.value.durationMinutes)}`);

  const water = hydrationEntries
    .filter((entry) => entry.dateKey === dateKey)
    .reduce((total, entry) => total + entry.amountMl, 0);
  if (water > 0) lines.push(`飲水：${water} / ${hydrationGoalMl} ml`);

  const period = periods.find((record) => record.startDate <= dateKey && record.endDate >= dateKey);
  if (period) {
    const details = [`第 ${periodDay(period, dateKey)} 天`];
    if (period.flowLevel) details.push(`經量${period.flowLevel}`);
    lines.push(`週期：${details.join('，')}`);
  }

  const weight = latest(todayRecords.filter((record) => record.value.kind === 'weight'));
  if (weight?.value.kind === 'weight') lines.push(`體重：${weight.value.kilograms} kg`);

  const bloodPressure = latest(todayRecords.filter((record) => record.value.kind === 'blood_pressure'));
  if (bloodPressure?.value.kind === 'blood_pressure') {
    const pulse = bloodPressure.value.pulse ? `，脈搏 ${bloodPressure.value.pulse} bpm` : '';
    lines.push(`血壓：${bloodPressure.value.systolic} / ${bloodPressure.value.diastolic} mmHg${pulse}`);
  }

  const symptoms = [...new Set(todayRecords.flatMap((record) => record.value.kind === 'symptom' ? [record.value.name.trim()] : []).filter(Boolean))];
  if (symptoms.length) lines.push(`身體信號：${symptoms.join('、')}`);

  if (!lines.length) return null;
  return `今日健康摘要｜${dateKey.replaceAll('-', '/')}\n\n${lines.join('\n')}`;
}
