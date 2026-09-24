import { describe, expect, it } from 'vitest';
import type { HealthRecord } from './healthDomain';
import { buildTodayHealthSummary } from './todayHealthSummary';

const dateKey = '2026-09-11';
const record = (id: string, value: HealthRecord['value']): HealthRecord => ({
  id, occurredOn: dateKey, type: value.kind, value, source: 'manual',
  createdAt: `${dateKey}T08:00:00.000Z`, updatedAt: `${dateKey}T08:00:00.000Z`,
});

describe('buildTodayHealthSummary', () => {
  it('formats only canonical records that exist today', () => {
    const summary = buildTodayHealthSummary({
      dateKey,
      records: [
        record('sleep', { kind: 'sleep', sleptAt: '2026-09-10T23:00:00.000Z', wokeAt: '2026-09-11T06:20:00.000Z', durationMinutes: 440, quality: 4 }),
        record('weight', { kind: 'weight', kilograms: 52.4 }),
        record('blood', { kind: 'blood_pressure', systolic: 118, diastolic: 76 }),
        record('symptom-a', { kind: 'symptom', name: '頭痛', severity: 2 }),
        record('symptom-b', { kind: 'symptom', name: '疲倦', severity: 3 }),
      ],
      hydrationEntries: [{ id: 'water', dateKey, amountMl: 1200, recordedAt: 1, source: 'custom' }],
      hydrationGoalMl: 2000,
      periods: [{ id: 'period', startDate: '2026-09-09', endDate: '2026-09-12', symptoms: [], notes: '', flowLevel: '輕', createdAt: 1 }],
    });

    expect(summary).toBe('今日健康摘要｜2026/09/11\n\n睡眠：7 小時 20 分\n飲水：1200 / 2000 ml\n週期：第 3 天，經量輕\n體重：52.4 kg\n血壓：118 / 76 mmHg\n身體信號：頭痛、疲倦');
    expect(summary).not.toMatch(/missing|unavailable|缺少|blood_pressure|weight/);
  });

  it('omits absent and non-today fields', () => {
    expect(buildTodayHealthSummary({
      dateKey,
      records: [{ ...record('old', { kind: 'weight', kilograms: 50 }), occurredOn: '2026-09-10' }],
      hydrationEntries: [], hydrationGoalMl: 2000, periods: [],
    })).toBeNull();
  });
});
