/* ── TideStorage — standalone today mood / tide records ── */

import type { TodayMood } from '@/types';

export interface TideRecord {
  date: string; // YYYY-MM-DD
  mood: TodayMood;
  tideLevel: string;
  symptoms: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export const TIDE_LEVELS = ['漲潮', '滿潮', '平潮', '退潮', '低潮'];

export const SYMPTOM_OPTIONS = [
  '悶痛', '脹氣', '疲勞', '頭痛', '腰痠',
  '食慾增加', '食慾減少', '失眠', '嗜睡', '水腫', '皮膚敏感',
];

const STORAGE_KEY = 'lunartide_tide_records_v1';

export function loadTideRecords(): TideRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTideRecord(record: TideRecord): void {
  const records = loadTideRecords().filter(r => r.date !== record.date);
  records.push(record);
  records.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getTideRecordByDate(date: string): TideRecord | undefined {
  return loadTideRecords().find(r => r.date === date);
}

export function getRecentTideRecords(days: number): TideRecord[] {
  const records = loadTideRecords();
  if (records.length === 0) return [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  return records
    .filter(r => r.date >= startStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function createTideRecord(date: string, mood: TodayMood, tideLevel: string, symptoms: string[], notes: string): TideRecord {
  const now = Date.now();
  return { date, mood, tideLevel, symptoms, notes, createdAt: now, updatedAt: now };
}
