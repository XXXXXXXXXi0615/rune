import { describe, expect, it } from 'vitest';
import { diffClockGroups, formatClockParts, resolveClockMotion } from './moonGlassClock';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MoonGlassClock model', () => {
  const date = new Date(2026, 7, 2, 15, 7);

  it('formats 12 and 24 hour time without seconds', () => {
    expect(formatClockParts(date, 'en-US', false)).toMatchObject({ hour: '15', minute: '07', dayPeriod: '' });
    expect(formatClockParts(date, 'en-US', true)).toMatchObject({ hour: '03', minute: '07', dayPeriod: 'PM' });
  });

  it('formats the date using the selected locale', () => {
    expect(formatClockParts(date, 'zh-TW', false).dateLabel).toContain('8月2日');
    expect(formatClockParts(date, 'en-US', false).dateLabel).toContain('August');
  });

  it('only marks the digit group that changed', () => {
    const before = formatClockParts(new Date(2026, 7, 2, 15, 7), 'en-US', false);
    const minute = formatClockParts(new Date(2026, 7, 2, 15, 8), 'en-US', false);
    expect(diffClockGroups(before, minute)).toEqual({ hour: false, minute: true });
  });

  it('disables movement while hidden and uses reduced presentation when requested', () => {
    expect(resolveClockMotion(false, true)).toBe('none');
    expect(resolveClockMotion(true, false)).toBe('reduced');
    expect(resolveClockMotion(false, false)).toBe('standard');
  });

  it('uses the shared time hook and does not create a clock store', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/home/MoonGlassClock.tsx'), 'utf8');
    expect(source).toContain("useNow('second')");
    expect(source).not.toMatch(/create\s*\(.*Clock|persist\s*\(/s);
  });
});
