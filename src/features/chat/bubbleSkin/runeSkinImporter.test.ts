import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importRuneSkinAssets, parseRuneSkinPackage, validateRuneSkinPackage } from './runeSkinImporter';

vi.mock('@/store/assets', () => ({ savePortableAsset: vi.fn(async () => crypto.randomUUID()), deleteAssets: vi.fn(async () => {}) }));

const image = { file: 'self.png', slice: { top: 10, right: 10, bottom: 10, left: 10 }, contentInsets: { top: 8, right: 12, bottom: 8, left: 12 }, mirror: { allowed: false }, tail: { kind: 'integrated' } };
const manifest = (patch: Record<string, unknown> = {}) => ({ format: 'rune-bubble-skin', version: 1, meta: { id: 'portable-id', name: 'Moon Pearl' }, variants: { self: { mode: 'image', image }, other: { mode: 'image', image: { ...image, file: 'other.png' } } }, ...patch });
async function archive(value: unknown = manifest(), entries: Record<string, string> = { 'self.png': 'self', 'other.png': 'other' }) {
  const zip = new JSZip(); zip.file('manifest.json', JSON.stringify(value)); Object.entries(entries).forEach(([name, body]) => zip.file(name, body)); return zip.generateAsync({ type: 'blob' });
}

describe('Rune skin package importer', () => {
  beforeEach(() => vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 80, close: vi.fn() }))));
  it('parses, validates and imports explicit directional assets using generated canonical IDs', async () => {
    const result = await importRuneSkinAssets(await validateRuneSkinPackage(await parseRuneSkinPackage(await archive())));
    expect(result.skin.mode).toBe('image'); expect(result.importedAssets).toHaveLength(2);
    if (result.skin.mode === 'image') expect(result.skin.mirror.leftAsset).toMatchObject({ kind: 'asset' });
  });
  it('accepts a CSS-only package without asset writes', async () => {
    const css = manifest({ variants: { self: { mode: 'css' }, other: { mode: 'css' } } });
    expect((await importRuneSkinAssets(await validateRuneSkinPackage(await parseRuneSkinPackage(await archive(css))))).skin).toEqual({ mode: 'css' });
  });
  it('rejects an archive without manifest.json', async () => {
    const zip = new JSZip(); zip.file('self.png', 'x');
    await expect(parseRuneSkinPackage(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/manifest/);
  });
  it.each([
    ['unsupported format', manifest({ format: 'other' }), /格式/],
    ['unsupported version', manifest({ version: 2 }), /版本/],
    ['malformed manifest', '{bad', /JSON/],
    ['missing self asset', manifest(), /缺少圖片/],
    ['negative insets', manifest({ variants: { self: { mode: 'image', image: { ...image, contentInsets: { top: -1, right: 1, bottom: 1, left: 1 } } }, other: { mode: 'css' } } }), /非負數/],
    ['invalid slices', manifest({ variants: { self: { mode: 'image', image: { ...image, slice: { top: 90, right: 60, bottom: 20, left: 60 } } }, other: { mode: 'css' } } }), /切片/],
  ])('rejects %s', async (_name, value, error) => {
    const entries: Record<string, string> = _name === 'missing self asset' ? { 'other.png': 'other' } : { 'self.png': 'self', 'other.png': 'other' };
    const blob = _name === 'malformed manifest' ? await (() => { const zip = new JSZip(); zip.file('manifest.json', String(value)); return zip.generateAsync({ type: 'blob' }); })() : await archive(value, entries);
    await expect(parseRuneSkinPackage(blob).then(validateRuneSkinPackage)).rejects.toThrow(error);
  });
  it.each(['../self.png', '/self.png', 'C:/self.png', 'scripts/run.js'])('rejects unsafe or unsupported entry %s', async (name) => {
    await expect(parseRuneSkinPackage(await archive(manifest({ variants: { self: { mode: 'css' }, other: { mode: 'css' } } }), { [name]: 'x' }))).rejects.toThrow();
  });
  it('rejects duplicate normalized filenames', async () => {
    await expect(parseRuneSkinPackage(await archive(manifest({ variants: { self: { mode: 'css' }, other: { mode: 'css' } } }), { 'SELF.png': 'a', 'self.png': 'b' }))).rejects.toThrow(/重複/);
  });
});
