import { describe, it, expect } from 'vitest';
import { formatCheckInAge } from './checkInStore';

describe('formatCheckInAge', () => {
  it('shows "剛剛" for less than 1 minute', () => {
    expect(formatCheckInAge(Date.now() - 30_000)).toBe('剛剛');
  });

  it('shows minutes for less than 1 hour', () => {
    expect(formatCheckInAge(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(formatCheckInAge(Date.now() - 47 * 60_000)).toBe('47m ago');
  });

  it('shows hours for less than 24 hours', () => {
    expect(formatCheckInAge(Date.now() - 2 * 3600_000)).toBe('2h ago');
  });

  it('shows "昨天" for exactly 1 day ago', () => {
    expect(formatCheckInAge(Date.now() - 24 * 3600_000)).toBe('昨天');
  });

  it('shows days for more than 1 day', () => {
    expect(formatCheckInAge(Date.now() - 3 * 24 * 3600_000)).toBe('3天前');
  });
});
