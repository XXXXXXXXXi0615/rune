/**
 * CycleSnapshot — unified period cycle calculator.
 * All dates use local calendar days. No millisecond math.
 */
import type { PeriodRecord, PeriodMood } from '@/utils/periodStorage';
import { loadPeriodRecords } from '@/utils/periodStorage';

export type CyclePhase = 'no-data' | 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';

export interface TrendDay {
  date: string;
  cycleDay: number | null;
  phase: CyclePhase;
  mood?: string;
  tide?: string;
}

export interface CycleSnapshot {
  status: CyclePhase;
  cycleDay: number | null;
  cycleLength: number | null;
  periodDay: number | null;
  progress: number | null;
  lastPeriodStart: string | null;
  predictedNextStart: string | null;
  predictedDaysRemaining: number | null;
  currentMood?: string;
  currentTide?: string;
  trend: TrendDay[];
  confidence: 'none' | 'low' | 'medium';
}

const FALLBACK_LENGTH = 28;
const MENSTRUATION_DAYS = 5;
const OVULATION_DAY = 14;
const LUTEAL_FIXED = 14;
const TREND_WINDOW = 14;

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diffDays(a: Date, b: Date): number {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((A.getTime() - B.getTime()) / 86_400_000);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function computeCycleLength(records: PeriodRecord[]): number {
  const sorted = [...records].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = diffDays(toDate(sorted[i].startDate), toDate(sorted[i - 1].startDate));
    if (len >= 14 && len <= 60) lengths.push(len);
  }
  if (lengths.length) return Math.round(lengths.reduce((s, v) => s + v, 0) / lengths.length);
  return FALLBACK_LENGTH;
}

function determinePhase(cycleDay: number, periodDay: number, cycleLength: number): CyclePhase {
  if (periodDay > 0) return 'menstruation';
  if (cycleDay <= cycleLength - LUTEAL_FIXED - 4 && cycleDay < OVULATION_DAY - 2) return 'follicular';
  if (cycleDay >= OVULATION_DAY - 2 && cycleDay <= OVULATION_DAY + 2) return 'ovulation';
  if (cycleDay >= cycleLength - LUTEAL_FIXED) return 'luteal';
  return 'luteal';
}

export interface CycleDateProjection {
  date: string;
  cycleDay: number | null;
  cycleLength: number | null;
  actualPeriodDay: number | null;
  predictedPeriodDay: number | null;
  isFertileWindow: boolean;
  isPredictedOvulation: boolean;
  phase: CyclePhase;
  confidence: CycleSnapshot['confidence'];
}

/** Canonical date-oriented projection used by read-only consumers such as Calendar. */
export function getCycleDateProjection(date: string, records: PeriodRecord[] = loadPeriodRecords()): CycleDateProjection {
  if (!records.length) {
    return { date, cycleDay: null, cycleLength: null, actualPeriodDay: null, predictedPeriodDay: null, isFertileWindow: false, isPredictedOvulation: false, phase: 'no-data', confidence: 'none' };
  }

  const sorted = [...records].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const latest = sorted[sorted.length - 1];
  const cycleLength = computeCycleLength(records);
  const target = toDate(date);
  const actualRecord = sorted.find((record) => {
    const start = toDate(record.startDate);
    const end = record.endDate ? toDate(record.endDate) : addDays(start, MENSTRUATION_DAYS - 1);
    return diffDays(target, start) >= 0 && diffDays(end, target) >= 0;
  });
  const actualPeriodDay = actualRecord ? diffDays(target, toDate(actualRecord.startDate)) + 1 : null;
  const offset = diffDays(target, toDate(latest.startDate));
  const cycleDay = offset >= 0 ? (offset % cycleLength) + 1 : null;
  const predictedPeriodDay = !actualPeriodDay && cycleDay && cycleDay <= MENSTRUATION_DAYS ? cycleDay : null;
  const phase = actualPeriodDay
    ? 'menstruation'
    : cycleDay
      ? determinePhase(cycleDay, 0, cycleLength)
      : 'unknown';

  return {
    date,
    cycleDay,
    cycleLength,
    actualPeriodDay,
    predictedPeriodDay,
    isFertileWindow: !actualPeriodDay && phase === 'ovulation',
    isPredictedOvulation: !actualPeriodDay && cycleDay === OVULATION_DAY,
    phase,
    confidence: sorted.length >= 3 ? 'medium' : 'low',
  };
}

export function getCycleSnapshot(): CycleSnapshot {
  const records = loadPeriodRecords();
  const todayStr = fromDate(new Date());
  const today = toDate(todayStr);

  if (!records.length) {
    return {
      status: 'no-data',
      cycleDay: null,
      cycleLength: null,
      periodDay: null,
      progress: null,
      lastPeriodStart: null,
      predictedNextStart: null,
      predictedDaysRemaining: null,
      trend: [],
      confidence: 'none',
    };
  }

  const sorted = [...records].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const latest = sorted[sorted.length - 1];
  const cycleLength = computeCycleLength(records);
  const confidence = sorted.length >= 3 ? 'medium' : 'low';

  // Find current period if within a record
  let periodDay = 0;
  let latestPeriodStart = latest.startDate;
  for (const r of sorted) {
    const start = toDate(r.startDate);
    const end = r.endDate ? toDate(r.endDate) : addDays(start, MENSTRUATION_DAYS);
    if (diffDays(today, start) >= 0 && diffDays(end, today) >= 0) {
      periodDay = diffDays(today, start) + 1;
      latestPeriodStart = r.startDate;
      break;
    }
  }

  // If no active period, check if we're still within a plausible cycle from the last record
  const cycleDay = periodDay > 0
    ? periodDay
    : diffDays(today, toDate(latestPeriodStart || latest.startDate)) + 1;

  // Cap cycle day
  const cappedCycleDay = Math.max(1, Math.min(cycleDay, cycleLength));

  // Phase
  const phase = periodDay > 0
    ? 'menstruation'
    : cappedCycleDay > cycleLength
      ? 'unknown'
      : determinePhase(cappedCycleDay, periodDay, cycleLength);

  // Next prediction
  const predictedNextStart = fromDate(addDays(toDate(latestPeriodStart || latest.startDate), cycleLength));
  const daysRemaining = Math.max(0, diffDays(toDate(predictedNextStart), today));

  // Progress
  const progress = phase === 'menstruation'
    ? Math.min(1, periodDay / MENSTRUATION_DAYS)
    : Math.min(1, cappedCycleDay / cycleLength);

  // Find today's record for mood/tide
  const todayRecord = sorted.filter((r) => {
    const start = toDate(r.startDate);
    const end = r.endDate ? toDate(r.endDate) : addDays(start, MENSTRUATION_DAYS);
    return diffDays(today, start) >= 0 && diffDays(end, today) >= 0;
  })[0] || null;

  // Build trend (28 days: 13 before today, today, 14 after)
  const trend: TrendDay[] = [];
  for (let i = -13; i <= 14; i++) {
    const day = addDays(today, i);
    const dayStr = fromDate(day);
    const dayFromStart = diffDays(day, toDate(latestPeriodStart || latest.startDate)) + 1;

    // Check if this date is within a recorded period
    let inPeriod = false;
    let dayMood: string | undefined;
    let dayTide: string | undefined;
    for (const r of sorted) {
      const rs = toDate(r.startDate);
      const re = r.endDate ? toDate(r.endDate) : addDays(rs, MENSTRUATION_DAYS);
      if (diffDays(day, rs) >= 0 && diffDays(re, day) >= 0) {
        inPeriod = true;
        dayMood = r.mood;
        dayTide = r.tideLevel;
        break;
      }
    }

    const cDay = dayFromStart > 0 ? Math.min(dayFromStart, cycleLength) : null;
    const tPhase = inPeriod
      ? 'menstruation'
      : cDay && cDay <= cycleLength
        ? determinePhase(cDay, 0, cycleLength)
        : 'unknown';

    trend.push({
      date: dayStr,
      cycleDay: cDay,
      phase: tPhase,
      mood: dayMood,
      tide: dayTide,
    });
  }

  return {
    status: phase,
    cycleDay: cappedCycleDay,
    cycleLength,
    periodDay: periodDay || null,
    progress,
    lastPeriodStart: latestPeriodStart || latest.startDate,
    predictedNextStart: phase === 'unknown' ? null : predictedNextStart,
    predictedDaysRemaining: phase === 'unknown' ? null : daysRemaining,
    currentMood: todayRecord?.mood,
    currentTide: todayRecord?.tideLevel,
    trend,
    confidence,
  };
}
