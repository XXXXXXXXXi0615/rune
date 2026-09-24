import { describe, expect, it } from 'vitest';
import { deriveRuneWorldDaypart, resolveRuneWorldHotspots } from './runePixelWorld';

describe('Rune Pixel World', () => {
  it.each([
    ['2026-09-08T05:00:00Z', 'dawn'],
    ['2026-09-08T07:59:00Z', 'dawn'],
    ['2026-09-08T08:00:00Z', 'day'],
    ['2026-09-08T16:59:00Z', 'day'],
    ['2026-09-08T17:00:00Z', 'dusk'],
    ['2026-09-08T19:59:00Z', 'dusk'],
    ['2026-09-08T20:00:00Z', 'night'],
    ['2026-09-08T04:59:00Z', 'night'],
  ])('derives %s as %s', (iso, expected) => {
    expect(deriveRuneWorldDaypart(new Date(iso), 'UTC')).toBe(expected);
  });

  it('derives every destination route from the canonical registry', () => {
    expect(resolveRuneWorldHotspots().map(({ moduleId, route }) => [moduleId, route])).toEqual([
      ['tidewatch', '/tidewatch'],
      ['stash', '/stash'],
      ['moonlex', '/moonlex'],
      ['chat', '/chat'],
      ['music', '/music'],
      ['calendar', '/calendar'],
    ]);
  });
});
