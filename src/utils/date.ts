export type LocalDateKey = string;

export function toLocalDateString(date = new Date()): LocalDateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const localDateKey = toLocalDateString;

export function parseLocalDateKey(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(Number.NaN);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localDateKey(date) === value ? date : new Date(Number.NaN);
}

export function isLocalDateKey(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(parseLocalDateKey(value).getTime());
}
