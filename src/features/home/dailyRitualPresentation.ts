/**
 * Canonical daily water progress — the single owner of hydration percentage.
 * Every presentation surface (Daily Status vessel, home widget, calendar water
 * section, period page, health overview) derives from this one value so the
 * percentage text, the liquid fill and any progress meter always agree.
 * Empty-goal fallback: a non-positive goal reads as 0% (never 100%).
 */
export function deriveWaterProgress(totalMl: number, goalMl: number): number {
  if (!Number.isFinite(totalMl) || !Number.isFinite(goalMl) || goalMl <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((totalMl / goalMl) * 100)));
}

export function ritualMarkVariant(dateKey: string): { rotation: number; offset: number } {
  const seed = [...dateKey].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return { rotation: seed * 1.4 - 2.8, offset: seed - 2 };
}
