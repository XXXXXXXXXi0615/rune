import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Hydration canonical ownership', () => {
  it('removes active legacy hydration writes from Period and quick actions', () => {
    const period = readFileSync('src/pages/PeriodPage.tsx', 'utf8');
    const menu = readFileSync('src/components/modals/AllModals.tsx', 'utf8');
    const waterSection = readFileSync('src/components/calendar/WaterSection.tsx', 'utf8');
    for (const source of [period, menu, waterSection]) {
      expect(source).not.toMatch(/\.addWater\(|s\s*=>\s*s\.addWater|resetWaterIfNeeded/);
      expect(source).toContain('useHydrationStore');
    }
  });

  it('keeps hydration outside the Period domain', () => {
    for (const file of ['src/utils/periodStorage.ts', 'src/components/period/PeriodRecordSheet.tsx', 'src/features/calendar/calendarPeriodAdapter.ts', 'src/features/period/getCycleSnapshot.ts']) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/hydration|waterMl|dailyGoalMl/i);
    }
  });
});
