import { describe, expect, it } from 'vitest';
import {
  selectWeightedGachaItem,
  selectEqualGachaItem,
  computeProbabilities,
  gachaDraw,
  type DrawError,
  type DrawResult,
} from './gachaDraw';
import type { GachaItem } from '@/types';

function makeItem(overrides: Partial<GachaItem> & { id: string }): GachaItem {
  return {
    poolId: 'pool-1',
    title: overrides.id,
    enabled: true,
    weight: 10,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function isError(r: DrawResult | DrawError): r is DrawError {
  return 'code' in r;
}

describe('selectWeightedGachaItem', () => {
  it('selects based on cumulative weight', () => {
    const items = [
      makeItem({ id: 'a', weight: 10 }),
      makeItem({ id: 'b', weight: 20 }),
      makeItem({ id: 'c', weight: 70 }),
    ];

    const r = selectWeightedGachaItem(items, 0.05); // 0.05 * 100 = 5 → item 'a'
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('a');
  });

  it('selects last item when randomValue = 0.999', () => {
    const items = [
      makeItem({ id: 'a', weight: 10 }),
      makeItem({ id: 'b', weight: 20 }),
      makeItem({ id: 'c', weight: 70 }),
    ];

    const r = selectWeightedGachaItem(items, 0.999);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('c');
  });

  it('returns error when no enabled items', () => {
    const items = [
      makeItem({ id: 'a', enabled: false, weight: 10 }),
    ];
    const r = selectWeightedGachaItem(items, 0.5);
    expect(isError(r)).toBe(true);
    expect((r as DrawError).code).toBe('NO_ENABLED_ITEMS');
  });

  it('returns accurate probability', () => {
    const items = [
      makeItem({ id: 'a', weight: 30 }),
      makeItem({ id: 'b', weight: 70 }),
    ];
    const r = selectWeightedGachaItem(items, 0.15); // 0.15 * 100 = 15 → 'a'
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).probability).toBeCloseTo(0.3, 5);
  });

  it('ignores negative weights', () => {
    const items = [
      makeItem({ id: 'a', weight: 10 }),
      makeItem({ id: 'b', weight: -5 }),
    ];
    const r = selectWeightedGachaItem(items, 0.9);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('a');
  });

  it('treats NaN weight as invalid and skips', () => {
    const items = [
      makeItem({ id: 'a', weight: NaN }),
      makeItem({ id: 'b', weight: 10 }),
    ];
    const r = selectWeightedGachaItem(items, 0.9);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('b');
  });

  it('treats Infinity weight as invalid', () => {
    const items = [
      makeItem({ id: 'a', weight: Infinity }),
      makeItem({ id: 'b', weight: 10 }),
    ];
    const r = selectWeightedGachaItem(items, 0.9);
    expect(isError(r)).toBe(false);
    // 'a' (Infinity) is excluded, only 'b' (10) remains → always draws 'b'
    expect((r as DrawResult).item.id).toBe('b');
    expect((r as DrawResult).probability).toBeCloseTo(1.0, 5);
  });

  it('does not mutate input items', () => {
    const items = [
      makeItem({ id: 'a', weight: 50 }),
      makeItem({ id: 'b', weight: 50 }),
    ];
    const copy = items.map((i) => ({ ...i }));
    selectWeightedGachaItem(items, 0.5);
    expect(items).toEqual(copy);
  });
});

describe('selectEqualGachaItem', () => {
  it('selects with equal probability', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
      makeItem({ id: 'd' }),
    ];
    const r = selectEqualGachaItem(items, 0.0);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('a');
    expect((r as DrawResult).probability).toBeCloseTo(0.25, 5);
  });

  it('returns error when no enabled items', () => {
    const items = [
      makeItem({ id: 'a', enabled: false }),
    ];
    const r = selectEqualGachaItem(items, 0.5);
    expect(isError(r)).toBe(true);
    expect((r as DrawError).code).toBe('NO_ENABLED_ITEMS');
  });

  it('selects last item', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ];
    const r = selectEqualGachaItem(items, 0.999);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('c');
  });
});

describe('computeProbabilities', () => {
  it('equal mode computes 1/n', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
      makeItem({ id: 'c' }),
    ];
    const probs = computeProbabilities(items, 'equal');
    expect(probs.get('a')).toBeCloseTo(1 / 3, 5);
    expect(probs.get('b')).toBeCloseTo(1 / 3, 5);
    expect(probs.get('c')).toBeCloseTo(1 / 3, 5);
  });

  it('weighted mode normalizes', () => {
    const items = [
      makeItem({ id: 'a', weight: 20 }),
      makeItem({ id: 'b', weight: 30 }),
      makeItem({ id: 'c', weight: 50 }),
    ];
    const probs = computeProbabilities(items, 'weighted');
    expect(probs.get('a')).toBeCloseTo(0.2, 5);
    expect(probs.get('b')).toBeCloseTo(0.3, 5);
    expect(probs.get('c')).toBeCloseTo(0.5, 5);
  });

  it('excludes disabled items in both modes', () => {
    const items = [
      makeItem({ id: 'a', weight: 50 }),
      makeItem({ id: 'b', weight: 50, enabled: false }),
    ];
    const probs = computeProbabilities(items, 'weighted');
    expect(probs.get('a')).toBeCloseTo(1.0, 5);
    expect(probs.has('b')).toBe(false);
  });

  it('empty enabled returns empty map', () => {
    const items = [
      makeItem({ id: 'a', enabled: false }),
    ];
    const probs = computeProbabilities(items, 'equal');
    expect(probs.size).toBe(0);
  });
});

describe('gachaDraw', () => {
  it('withReplacement allows duplicates', () => {
    const items = [
      makeItem({ id: 'a', weight: 100 }),
    ];
    const excluded = new Set<string>();
    const r1 = gachaDraw(items, 'weighted', excluded, 0.5);
    expect(isError(r1)).toBe(false);
    const r2 = gachaDraw(items, 'weighted', excluded, 0.5);
    expect(isError(r2)).toBe(false);
    // Both return the only enabled item
    expect((r1 as DrawResult).item.id).toBe('a');
    expect((r2 as DrawResult).item.id).toBe('a');
  });

  it('withoutReplacement: excluded items not drawn', () => {
    const items = [
      makeItem({ id: 'a', weight: 10 }),
      makeItem({ id: 'b', weight: 90 }),
    ];
    const excluded = new Set(['a']);
    // With random 0.05, 'a' would be drawn without exclusion; with exclusion, 'b' is drawn
    const r = gachaDraw(items, 'weighted', excluded, 0.05);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('b');
  });

  it('withoutReplacement: cycle complete when all excluded', () => {
    const items = [
      makeItem({ id: 'a' }),
      makeItem({ id: 'b' }),
    ];
    const excluded = new Set(['a', 'b']);
    const r = gachaDraw(items, 'equal', excluded, 0.5);
    expect(isError(r)).toBe(true);
    expect((r as DrawError).code).toBe('CYCLE_COMPLETE');
  });

  it('snapshot unaffected by later edits', () => {
    const items = [
      makeItem({ id: 'a', weight: 10, title: 'Original' }),
      makeItem({ id: 'b', weight: 90 }),
    ];
    const excluded = new Set<string>();
    const r = gachaDraw(items, 'weighted', excluded, 0.05);
    expect(isError(r)).toBe(false);
    const snapTitle = (r as DrawResult).item.title;

    // Simulate later edit
    items[0].title = 'Changed';

    // snapshot should still be 'Original'
    expect(snapTitle).toBe('Original');
  });

  it('disabled items are excluded', () => {
    const items = [
      makeItem({ id: 'a', weight: 100, enabled: false }),
      makeItem({ id: 'b', weight: 10 }),
    ];
    const excluded = new Set<string>();
    const r = gachaDraw(items, 'weighted', excluded, 0.5);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('b');
  });

  it('equal mode with weighted items', () => {
    const items = [
      makeItem({ id: 'a', weight: 10 }),
      makeItem({ id: 'b', weight: 1 }),
    ];
    const excluded = new Set<string>();
    const r = gachaDraw(items, 'equal', excluded, 0.25);
    expect(isError(r)).toBe(false);
    expect((r as DrawResult).item.id).toBe('a');
    expect((r as DrawResult).probability).toBeCloseTo(0.5, 5);
  });
});
