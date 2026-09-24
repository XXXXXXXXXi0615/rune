/** Phase 1.0C — safe local date parsing for widget data.
 *  Returns null for any input that cannot produce a valid YYYY-MM-DD.
 */
export function parseValidLocalDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = value.trim();
  if (!s) return null;
  // ISO date: 2026-09-03 or 2026-09-03T12:00:00.000Z
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

/** Days between two dates (local midnight).
 *  Returns NaN only if either input is null.
 */
export function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86_400_000);
}
