import { beforeEach, describe, expect, it } from 'vitest';
import { mixHexColors, suggestStashType, useRuneStashStore } from '@/features/stash/useRuneStashStore';

describe('Rune Stash canonical store', () => {
  beforeEach(() => useRuneStashStore.setState({ items: [] }));

  it('keeps one collection and cleans deleted color references', () => {
    const colorId = useRuneStashStore.getState().addItem({ type: 'color', value: '#abcdef', tags: [] });
    const paletteId = useRuneStashStore.getState().addItem({ type: 'palette', value: 'Ocean', title: 'Ocean', tags: [], colorIds: [colorId] });
    useRuneStashStore.getState().deleteItem(colorId);
    const palette = useRuneStashStore.getState().items.find((item) => item.id === paletteId);
    expect(palette?.type === 'palette' ? palette.colorIds : null).toEqual([]);
  });

  it('suggests only deterministic local types and mixes colors', () => {
    expect(suggestStashType('#112233')).toBe('color');
    expect(suggestStashType('✦')).toBe('symbol');
    expect(suggestStashType('remember this')).toBe('text');
    expect(mixHexColors('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('owns ordered normalized swatches inside one additive collection item', () => {
    const id = useRuneStashStore.getState().addItem({
      type: 'color_collection', value: 'Moon tide', title: 'Moon tide', tags: [' cool ', 'cool'],
      swatches: [
        { id: 'a', name: ' Mist ', hex: '#aabbcc' },
        { id: 'b', name: 'Ink', hex: '#112233', note: ' deep ' },
      ],
    });
    const item = useRuneStashStore.getState().items.find((entry) => entry.id === id);
    expect(item?.type).toBe('color_collection');
    if (item?.type !== 'color_collection') return;
    expect(item.tags).toEqual(['cool']);
    expect(item.swatches).toEqual([
      { id: 'a', name: 'Mist', hex: '#AABBCC', note: undefined },
      { id: 'b', name: 'Ink', hex: '#112233', note: 'deep' },
    ]);
  });
});
