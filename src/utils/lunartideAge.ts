/**
 * LUNARTIDE_CREATED_AT = 2026-05-22
 *
 * Test cases (local date, assuming 2026-05-22 is day 1):
 *   2026-05-22 → dayNumber=1,  elapsedDays=0
 *   2026-05-23 → dayNumber=2,  elapsedDays=1
 *   2026-07-09 → dayNumber=49, elapsedDays=48
 *   2026-01-01 → dayNumber=1,  elapsedDays=0 (clamp)
 */

export interface LunartideAge {
  elapsedDays: number;
  dayNumber: number;
  createdAtLabel: string;
}

const START = new Date(2026, 4, 22); // May 22, 2026 (month is 0-based)

export function getLunartideAge(now: Date = new Date()): LunartideAge {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = today.getTime() - START.getTime();
  const elapsedDays = Math.max(0, Math.floor(ms / 86400000));
  const dayNumber = elapsedDays + 1;

  const y = START.getFullYear();
  const m = String(START.getMonth() + 1).padStart(2, '0');
  const d = String(START.getDate()).padStart(2, '0');

  return {
    elapsedDays,
    dayNumber,
    createdAtLabel: `${y}-${m}-${d}`,
  };
}
