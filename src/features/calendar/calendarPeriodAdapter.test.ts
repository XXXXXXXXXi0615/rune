import { describe, expect, it } from 'vitest';
import { resolveCalendarPeriodMetadata } from './calendarPeriodAdapter';
import type { PeriodRecord } from '@/utils/periodStorage';

const records: PeriodRecord[] = [
  { id: 'p1', startDate: '2026-06-01', endDate: '2026-06-05', symptoms: [], notes: '', createdAt: 1 },
  { id: 'p2', startDate: '2026-06-29', endDate: '2026-07-03', symptoms: [], notes: '', createdAt: 2 },
  { id: 'p3', startDate: '2026-07-27', endDate: '2026-07-31', symptoms: ['腹痛'], symptomTags: ['腹痛'], notes: '', mood: 'calm', createdAt: 3 },
];

describe('calendarPeriodAdapter', () => {
  it('projects actual period and record metadata', () => {
    expect(resolveCalendarPeriodMetadata('2026-07-28', records)).toMatchObject({ actualPeriodDay: 2, predictedPeriodDay: null, hasMoodRecord: true, hasSymptomRecord: true });
  });

  it('uses the canonical projection for predicted period, fertile window and ovulation', () => {
    expect(resolveCalendarPeriodMetadata('2026-08-24', records).predictedPeriodDay).toBe(1);
    expect(resolveCalendarPeriodMetadata('2026-08-09', records)).toMatchObject({ isFertileWindow: true, isOvulationDay: true });
    expect(resolveCalendarPeriodMetadata('2026-08-08', records)).toMatchObject({ isFertileWindow: true, isOvulationDay: false });
  });
});
