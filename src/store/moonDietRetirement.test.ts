import { describe, expect, it } from 'vitest';
import { createDefaultStore, normalizeStore } from './storage';

describe('MoonDiet retirement persistence boundary', () => {
  it('ignores legacy and malformed MoonDiet payloads without restoring retired state', () => {
    const legacy = {
      ...createDefaultStore(),
      mealEntries: 'corrupt',
      dietReceipts: [{ id: null, mealEntries: 'corrupt' }],
      dietSettings: { settlementTime: '25:99' },
      cookingLogs: [{ id: null }],
      recipes: 'corrupt',
    };

    const normalized = normalizeStore(legacy as never) as unknown as Record<string, unknown>;

    expect(normalized).not.toHaveProperty('mealEntries');
    expect(normalized).not.toHaveProperty('dietReceipts');
    expect(normalized).not.toHaveProperty('dietSettings');
    expect(normalized).not.toHaveProperty('cookingLogs');
    expect(normalized).not.toHaveProperty('recipes');
  });
});
