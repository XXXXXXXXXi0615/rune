import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatBubbleSkin } from './types';
import { exportRuneSkinPackage, normalizeBubbleSkinMeaning } from './runeSkinExporter';
import { importRuneSkinAssets, parseRuneSkinPackage, validateRuneSkinPackage } from './runeSkinImporter';

const assets = new Map<string, Blob>();
let nextId = 0;
vi.mock('@/store/assets', () => ({
  getAsset: vi.fn(async (id: string) => assets.get(id) || null),
  savePortableAsset: vi.fn(async (blob: Blob) => { const id = `imported-${++nextId}`; assets.set(id, blob); return id; }),
  deleteAssets: vi.fn(async (ids: string[]) => ids.forEach((id) => assets.delete(id))),
}));

const geometry = { top: 10, right: 12, bottom: 10, left: 12 };
const skin = (mirror = false): ChatBubbleSkin => ({ mode: 'image', source: { kind: 'asset', assetId: 'right-id' }, slice: geometry, insets: { top: 8, right: 10, bottom: 8, left: 10 }, mirror: mirror ? { allowed: true } : { allowed: false, rightAsset: { kind: 'asset', assetId: 'right-id' }, leftAsset: { kind: 'asset', assetId: 'left-id' } }, tail: { kind: 'image-integrated' }, edgeMode: 'round' });

describe('Rune skin exporter', () => {
  beforeEach(() => { assets.clear(); nextId = 0; assets.set('right-id', new Blob(['right'], { type: 'image/png' })); assets.set('left-id', new Blob(['left'], { type: 'image/webp' })); vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 80, close: vi.fn() }))); });
  it('exports explicit self and other assets with stable safe filenames', async () => {
    const result = await exportRuneSkinPackage(skin(), { name: '../Moon / Pearl', author: 'A\u0000B' });
    expect(result.filename).toBe('Moon-Pearl.runeskin');
    expect(result.files).toEqual(['manifest.json', 'self.png', 'other.webp']);
    expect(result.manifest.meta.author).toBe('A B');
    expect(JSON.stringify(result.manifest)).not.toContain('right-id');
  });
  it('exports CSS-only skins without fake images', async () => {
    const result = await exportRuneSkinPackage({ mode: 'css' }, { name: 'CSS Pearl' });
    expect(result.files).toEqual(['manifest.json']);
    expect(result.manifest.variants).toEqual({ self: { mode: 'css' }, other: { mode: 'css' } });
  });
  it('preserves mirrored and integrated-tail semantics through round trip', async () => {
    const original = skin(true);
    const exported = await exportRuneSkinPackage(original, { name: 'Mirror' });
    const imported = await importRuneSkinAssets(await validateRuneSkinPackage(await parseRuneSkinPackage(exported.blob)));
    expect(normalizeBubbleSkinMeaning(imported.skin)).toEqual(normalizeBubbleSkinMeaning(original));
    expect(imported.importedAssets).toHaveLength(1);
  });
  it('preserves directional image bytes while generating new asset IDs', async () => {
    const exported = await exportRuneSkinPackage(skin(), { name: 'Directional' });
    const imported = await importRuneSkinAssets(await validateRuneSkinPackage(await parseRuneSkinPackage(exported.blob)));
    expect(imported.importedAssets).not.toContain('right-id');
    expect(await assets.get(imported.importedAssets[0])?.text()).toBe('right');
    expect(await assets.get(imported.importedAssets[1])?.text()).toBe('left');
  });
  it('produces deterministic manifest meaning and file sets', async () => {
    const a = await exportRuneSkinPackage(skin(), { name: 'Same', description: 'same' });
    const b = await exportRuneSkinPackage(skin(), { name: 'Same', description: 'same' });
    expect(a.manifest).toEqual(b.manifest); expect(a.files).toEqual(b.files);
    const az = await JSZip.loadAsync(a.blob); const bz = await JSZip.loadAsync(b.blob);
    expect(await az.file('manifest.json')!.async('text')).toBe(await bz.file('manifest.json')!.async('text'));
  });
  it('fails cleanly for missing assets and unsupported separate tails', async () => {
    assets.delete('right-id');
    await expect(exportRuneSkinPackage(skin(), { name: 'Missing' })).rejects.toThrow(/找不到/);
    const separate = { ...skin(), tail: { kind: 'separate-image' as const } } as ChatBubbleSkin;
    await expect(exportRuneSkinPackage(separate, { name: 'Tail' })).rejects.toThrow(/tail asset/);
  });
});
