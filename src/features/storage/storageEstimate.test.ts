import { describe, expect, it } from 'vitest';
import { formatStorageSize } from './storageEstimate';

describe('formatStorageSize', () => {
  it('uses user-facing ranges instead of precise byte counts', () => {
    expect(formatStorageSize(null)).toBe('无法估算');
    expect(formatStorageSize(0)).toBe('0 B');
    expect(formatStorageSize(51)).toBe('不足 1 KB');
    expect(formatStorageSize(1536, true)).toBe('约 1.5 KB');
    expect(formatStorageSize(12 * 1024)).toBe('12 KB');
  });
});
