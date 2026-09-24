export const SLEEP_RECORDS_STORAGE_KEY = 'lunartide_sleep_records';

export type SleepStageType = 'awake' | 'rem' | 'core' | 'deep';

export type SleepQuality = 'poor' | 'fair' | 'good' | 'great';

export const SLEEP_QUALITY_LABELS: Record<SleepQuality, string> = {
  poor: '很差',
  fair: '一般',
  good: '不錯',
  great: '很好',
};

export interface SleepStageSegment {
  type: SleepStageType;
  minutes: number;
}

export interface SleepHeartRate {
  average: number;
  min: number;
  max: number;
  samples: number[];
}

export interface SleepAppUsage {
  name: string;
  durationMinutes: number;
  openCount: number;
}

export interface SleepRecord {
  id: string;
  date: string;
  sleepStart: string;
  sleepEnd: string;
  durationMinutes: number;
  stages: SleepStageSegment[];
  heartRate: SleepHeartRate;
  steps: number;
  activeEnergy: number;
  restingHeartRate: number;
  appUsage: SleepAppUsage[];
  note: string;
  quality: SleepQuality;
  createdAt: number;
}

export interface SleepStageTotals {
  awake: number;
  rem: number;
  core: number;
  deep: number;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function generateId(): string {
  return `sleep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function splitMinutes(total: number, ratios: number[]): number[] {
  const safeTotal = Math.max(0, Math.round(total));
  let used = 0;
  return ratios.map((ratio, index) => {
    if (index === ratios.length - 1) return safeTotal - used;
    const value = Math.round(safeTotal * ratio);
    used += value;
    return value;
  });
}

export function buildSleepStages(totals: SleepStageTotals): SleepStageSegment[] {
  const awake = splitMinutes(totals.awake, [0.5, 0.5]);
  const rem = splitMinutes(totals.rem, [0.45, 0.55]);
  const core = splitMinutes(totals.core, [0.24, 0.26, 0.23, 0.27]);
  const deep = splitMinutes(totals.deep, [0.55, 0.45]);

  const sequence: SleepStageSegment[] = [
    { type: 'awake', minutes: awake[0] },
    { type: 'core', minutes: core[0] },
    { type: 'deep', minutes: deep[0] },
    { type: 'core', minutes: core[1] },
    { type: 'rem', minutes: rem[0] },
    { type: 'core', minutes: core[2] },
    { type: 'deep', minutes: deep[1] },
    { type: 'core', minutes: core[3] },
    { type: 'rem', minutes: rem[1] },
    { type: 'awake', minutes: awake[1] },
  ];

  return sequence.filter((segment) => segment.minutes > 0);
}

export function createHeartRate(average: number): SleepHeartRate {
  const safeAverage = Math.max(35, Math.round(average || 57));
  const offsets = [-2, 1, -4, -1, 3, 0, -3, 2, 5, 1, -2, 0, 4, -1, 2, -3];
  const samples = offsets.map((offset) => safeAverage + offset);
  return {
    average: safeAverage,
    min: Math.min(...samples),
    max: Math.max(...samples),
    samples,
  };
}

export function loadSleepRecords(): SleepRecord[] {
  try {
    const raw = localStorage.getItem(SLEEP_RECORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Partial<SleepRecord>[])
      .filter((record) => record && typeof record.id === 'string' && typeof record.date === 'string')
      .map((record) => ({ quality: 'fair', ...record } as SleepRecord))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveSleepRecord(record: SleepRecord): SleepRecord[] {
  const records = loadSleepRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.push(record);
  records.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  localStorage.setItem(SLEEP_RECORDS_STORAGE_KEY, JSON.stringify(records));
  return records;
}

export function createSleepRecord(input: Omit<SleepRecord, 'id' | 'createdAt' | 'quality'> & { quality?: SleepQuality }): SleepRecord {
  return {
    quality: 'fair',
    ...input,
    id: generateId(),
    createdAt: Date.now(),
  };
}

/**
 * Check if a record matches the demo/sample signature (created by createSampleSleepRecord).
 * Requires at least 3 matching fields to avoid false-positively deleting real user data.
 */
export function isSampleSleepRecord(record: Partial<SleepRecord>): boolean {
  let matches = 0;
  if (record.sleepStart === '02:15') matches++;
  if (record.sleepEnd === '08:02') matches++;
  if (record.durationMinutes === 344) matches++;
  if (record.steps === 6842) matches++;
  if (record.activeEnergy === 386) matches++;
  if (record.restingHeartRate === 55) matches++;
  if (record.heartRate?.average === 57 && record.heartRate?.min === 49 && record.heartRate?.max === 68) matches++;
  if (typeof record.note === 'string' && (record.note.includes('凌晨才躺下') || record.note.includes('昨天的草稿收尾'))) matches++;
  return matches >= 3;
}

/**
 * Load records, filter out any sample/demo records, write back if cleaned.
 * Called once during SleepCenter initialization.
 */
export function migrateSleepRecords(): SleepRecord[] {
  const records = loadSleepRecords();
  const clean = records.filter((r) => !isSampleSleepRecord(r));
  if (clean.length !== records.length) {
    localStorage.setItem(SLEEP_RECORDS_STORAGE_KEY, JSON.stringify(clean));
  }
  return clean;
}

export function createSampleSleepRecord(): SleepRecord {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return createSleepRecord({
    date: localDateKey(yesterday),
    sleepStart: '02:15',
    sleepEnd: '08:02',
    durationMinutes: 344,
    stages: buildSleepStages({ awake: 3, rem: 76, core: 230, deep: 38 }),
    heartRate: {
      average: 57,
      min: 49,
      max: 68,
      samples: [58, 56, 55, 52, 54, 57, 53, 51, 56, 59, 61, 58, 55, 57, 60, 56, 54, 57],
    },
    steps: 6842,
    activeEnergy: 386,
    restingHeartRate: 55,
    appUsage: [
      { name: 'Claude', durationMinutes: 94, openCount: 18 },
      { name: 'ChatGPT', durationMinutes: 52, openCount: 11 },
      { name: 'Gemini', durationMinutes: 28, openCount: 6 },
      { name: 'X', durationMinutes: 47, openCount: 22 },
      { name: '微信', durationMinutes: 63, openCount: 31 },
      { name: '小紅書', durationMinutes: 36, openCount: 14 },
    ],
    note: '凌晨才躺下，但深睡占比還不錯。今早醒來腦袋比預期清醒，適合先把昨天的草稿收尾。',
    quality: 'good',
  });
}
