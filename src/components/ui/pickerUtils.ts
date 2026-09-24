/** Split YYYY-MM-DD into { year, month, day } — no Date constructor, no timezone risk */
export function splitDate(dateStr: string): { year: number; month: number; day: number } {
  const parts = (dateStr || '').split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!isNaN(year) && !isNaN(month) && !isNaN(day)) return { year, month, day };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function formatDateLabel(dateStr: string): string {
  const { year, month, day } = splitDate(dateStr);
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, offset: number): string {
  const { year, month, day } = splitDate(dateStr);
  const d = new Date(year, month - 1, day + offset);
  return toLocalDateString(d);
}
