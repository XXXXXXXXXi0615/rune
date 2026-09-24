import { describe, expect, it } from 'vitest';
import { getGlobalUtilities } from './globalUtilityRegistry';

describe('GlobalUtilityRegistry', () => {
  it('keeps the four primary utilities in product order', () => {
    expect(getGlobalUtilities().map((item) => item.id)).toEqual(['search', 'appearance', 'rune', 'quick-actions', 'apps']);
  });

  it('dispatches only through canonical routes or commands', () => {
    expect(getGlobalUtilities().every((item) => Boolean(item.route) !== Boolean(item.command))).toBe(true);
  });
});
