import type { GachaItem } from '@/types';

export interface DrawError {
  code: 'NO_ENABLED_ITEMS' | 'CYCLE_COMPLETE' | 'INVALID_WEIGHTS';
  message: string;
}

export interface DrawResult {
  item: GachaItem;
  probability: number;
}

export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

export function selectWeightedGachaItem(
  items: readonly GachaItem[],
  randomValue: number,
): DrawResult | DrawError {
  const enabled = items.filter((i) => i.enabled);
  if (enabled.length === 0) {
    return { code: 'NO_ENABLED_ITEMS', message: 'No enabled items in pool' };
  }

  const totalWeight = enabled.reduce((sum, i) => {
    if (!Number.isFinite(i.weight) || i.weight < 1) return sum;
    return sum + Math.round(i.weight);
  }, 0);

  if (totalWeight <= 0) {
    return { code: 'INVALID_WEIGHTS', message: 'Total weight is zero or negative' };
  }

  let cursor = randomValue * totalWeight;
  for (const item of enabled) {
    const w = Math.round(item.weight);
    if (!Number.isFinite(w) || w < 1) continue;
    cursor -= w;
    if (cursor <= 0) {
      return { item, probability: w / totalWeight };
    }
  }

  const last = enabled[enabled.length - 1];
  return { item: last, probability: Math.round(last.weight) / totalWeight };
}

export function selectEqualGachaItem(
  items: readonly GachaItem[],
  randomValue: number,
): DrawResult | DrawError {
  const enabled = items.filter((i) => i.enabled);
  if (enabled.length === 0) {
    return { code: 'NO_ENABLED_ITEMS', message: 'No enabled items in pool' };
  }

  const idx = Math.floor(randomValue * enabled.length);
  const clamped = Math.max(0, Math.min(idx, enabled.length - 1));
  return { item: enabled[clamped], probability: 1 / enabled.length };
}

export function gachaDraw(
  items: readonly GachaItem[],
  mode: 'equal' | 'weighted',
  excludedItemIds: ReadonlySet<string>,
  randomValue: number,
): DrawResult | DrawError {
  const available = items.filter((i) => !excludedItemIds.has(i.id));
  if (available.length === 0) {
    return { code: 'CYCLE_COMPLETE', message: 'All items have been drawn this cycle' };
  }

  if (mode === 'equal') {
    return selectEqualGachaItem(available, randomValue);
  }
  return selectWeightedGachaItem(available, randomValue);
}

export function computeProbabilities(
  items: readonly GachaItem[],
  mode: 'equal' | 'weighted',
): Map<string, number> {
  const map = new Map<string, number>();
  const enabled = items.filter((i) => i.enabled);

  if (mode === 'equal') {
    if (enabled.length === 0) return map;
    const p = 1 / enabled.length;
    for (const item of enabled) {
      map.set(item.id, p);
    }
    return map;
  }

  const totalWeight = enabled.reduce((sum, i) => sum + Math.round(i.weight), 0);
  if (totalWeight <= 0) return map;
  for (const item of enabled) {
    map.set(item.id, Math.round(item.weight) / totalWeight);
  }
  return map;
}
