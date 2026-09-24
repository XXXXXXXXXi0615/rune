// ================================================================
// Solar Date Utilities
// ================================================================

/** Format a Date object as YYYY-MM-DD string. */
export function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get today's date as YYYY-MM-DD. */
export function todayStr(): string {
  return formatDateStr(new Date());
}
