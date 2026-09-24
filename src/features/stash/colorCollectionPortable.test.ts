import { describe, expect, it } from 'vitest';
import type { RuneStashColorCollectionItem } from './useRuneStashStore';
import { colorCollectionCssVariables, colorCollectionFilename, colorCollectionHexList, colorCollectionMarkdown, cssVariableSlug, parseColorCollectionDocument, serializeColorCollection, toPortableColorCollection } from './colorCollectionPortable';

const item: RuneStashColorCollectionItem = {
  id: 'local-only', type: 'color_collection', title: 'Moon Mist', value: 'Moon Mist', note: '  Quiet sky  ', tags: ['cool', ' soft '], favorite: true, createdAt: 10, updatedAt: 20,
  swatches: [{ id: 'a', name: ' Mist ', hex: '#aabbcc', note: ' pale ' }, { id: 'b', name: 'Mist', hex: '#112233' }, { id: 'c', name: '月光', hex: '#F4E6CC' }],
};

describe('Rune color collection portable format', () => {
  it('serializes only versioned portable meaning and round-trips in order', () => {
    const serialized = serializeColorCollection(item);
    expect(serialized).not.toContain('local-only'); expect(serialized).not.toContain('createdAt'); expect(serialized).not.toContain('favorite');
    const parsed = parseColorCollectionDocument(serialized);
    expect(parsed).toEqual(toPortableColorCollection(item));
    expect(parsed.collection.swatches.map((swatch) => swatch.hex)).toEqual(['#AABBCC', '#112233', '#F4E6CC']);
    expect(parsed.collection).toMatchObject({ title: 'Moon Mist', subtitle: 'Quiet sky', tags: ['cool', 'soft'] });
  });
  it.each([
    ['malformed JSON', '{'],
    ['unsupported format', JSON.stringify({ format: 'other', version: 1, collection: {} })],
    ['unsupported version', JSON.stringify({ format: 'rune-color-collection', version: 2, collection: {} })],
    ['missing title', JSON.stringify({ format: 'rune-color-collection', version: 1, collection: { title: '', swatches: [{ name: 'A', hex: '#AABBCC' }] } })],
    ['empty swatches', JSON.stringify({ format: 'rune-color-collection', version: 1, collection: { title: 'A', swatches: [] } })],
    ['invalid HEX', JSON.stringify({ format: 'rune-color-collection', version: 1, collection: { title: 'A', swatches: [{ name: 'A', hex: 'red' }] } })],
    ['invalid field type', JSON.stringify({ format: 'rune-color-collection', version: 1, collection: { title: 'A', tags: 'x', swatches: [{ name: 'A', hex: '#AABBCC' }] } })],
    ['absurd swatch count', JSON.stringify({ format: 'rune-color-collection', version: 1, collection: { title: 'A', swatches: Array.from({ length: 129 }, () => ({ name: 'A', hex: '#AABBCC' })) } })],
  ])('rejects %s without silently dropping data', (_label, source) => expect(() => parseColorCollectionDocument(source)).toThrow());
  it('produces deterministic CSS slugs and duplicate suffixes', () => {
    expect(cssVariableSlug(' Moon Cream ')).toBe('moon-cream');
    expect(colorCollectionCssVariables(item)).toBe(':root {\n  --mist: #AABBCC;\n  --mist-2: #112233;\n  --color-3: #F4E6CC;\n}');
  });
  it('produces ordered HEX, Markdown and a safe deterministic filename', () => {
    expect(colorCollectionHexList(item)).toBe('#AABBCC\n#112233\n#F4E6CC');
    expect(colorCollectionMarkdown(item)).toContain('# Moon Mist\n\nQuiet sky\n\n#cool #soft');
    expect(colorCollectionMarkdown(item)).toContain('| Mist | `#AABBCC` |');
    expect(colorCollectionFilename(item)).toBe('moon-mist.rune-colors.json');
  });
});
