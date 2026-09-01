import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('PeriodRecordSheet ownership', () => {
  it('is shared by Calendar and PeriodPage without a Calendar period store', () => {
    const calendar = readFileSync('src/pages/CalendarPage.tsx', 'utf8');
    const period = readFileSync('src/pages/PeriodPage.tsx', 'utf8');
    expect(calendar).toContain("from '@/components/period/PeriodRecordSheet'");
    expect(period).toContain("from '@/components/period/PeriodRecordSheet'");
    expect(calendar).not.toContain("localStorage.setItem('lunartide_period_records_v1'");
    expect(calendar).not.toContain('calendarPeriodStore');
  });
});
