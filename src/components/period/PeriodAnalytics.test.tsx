import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Health Period analytics ownership', () => {
  it('keeps presentation free of persistence, CRUD and prediction formulas', () => {
    const source = readFileSync('src/components/period/PeriodAnalytics.tsx', 'utf8');
    expect(source).not.toMatch(/localStorage|sessionStorage|savePeriodRecord|createPeriodRecord|deletePeriodRecord/);
    expect(source).not.toMatch(/FALLBACK_LENGTH|MENSTRUATION_DAYS|OVULATION_DAY|computeCycleLength/);
  });

  it('reuses the canonical snapshot and shared editor on the Health route', () => {
    const page = readFileSync('src/pages/HealthPeriodPage.tsx', 'utf8');
    expect(page).toContain("from '@/features/period/getCycleSnapshot'");
    expect(page).toContain("from '@/components/period/PeriodRecordSheet'");
    expect(page).not.toMatch(/localStorage|calendarPeriodStore|useHealthStore/);
  });
});
