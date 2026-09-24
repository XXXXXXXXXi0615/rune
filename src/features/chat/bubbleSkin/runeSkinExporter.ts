import JSZip from 'jszip';
import { getAsset } from '@/store/assets';
import type { BubbleSkinSource, ChatBubbleSkin, ImageBubbleSkin } from './types';
import { RUNE_SKIN_FORMAT, RUNE_SKIN_VERSION, type PortableRuneSkinVariant, type RuneSkinManifest } from './runeSkinImporter';

export interface RuneSkinExportMetadata { name: string; author?: string; description?: string }
export interface RuneSkinExportResult { blob: Blob; filename: string; manifest: RuneSkinManifest; files: string[] }
export class RuneSkinExportError extends Error { constructor(message: string) { super(message); this.name = 'RuneSkinExportError'; } }

const clean = (value: string | undefined, max: number): string | undefined => value?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) || undefined;
const hash = (value: string): string => { let n = 2166136261; for (let index = 0; index < value.length; index += 1) n = Math.imul(n ^ value.charCodeAt(index), 16777619); return (n >>> 0).toString(16).padStart(8, '0'); };
const extensionFor = (blob: Blob): string => blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : '';

async function resolveAsset(source: BubbleSkinSource, label: string): Promise<Blob> {
  if (source.kind !== 'asset') throw new RuneSkinExportError(`${label} 不是可攜式 canonical asset。`);
  const blob = await getAsset(source.assetId);
  if (!blob) throw new RuneSkinExportError(`找不到 ${label} 圖片資產。`);
  if (!extensionFor(blob)) throw new RuneSkinExportError(`${label} 圖片格式不支援。`);
  return blob;
}

const portableImage = (skin: ImageBubbleSkin, file: string): PortableRuneSkinVariant => ({ mode: 'image', image: { file, slice: skin.slice, contentInsets: skin.insets, edgeMode: skin.edgeMode, edgeWidth: skin.edgeWidth, mirror: { allowed: skin.mirror.allowed }, tail: { kind: skin.tail.kind === 'none' ? 'none' : 'integrated' } } });

export async function buildRuneSkinManifest(skin: ChatBubbleSkin, metadata: RuneSkinExportMetadata): Promise<RuneSkinManifest> {
  const name = clean(metadata.name, 120);
  if (!name) throw new RuneSkinExportError('Skin 名稱不可為空。');
  if (skin.mode === 'image' && skin.tail.kind === 'separate-image') throw new RuneSkinExportError('目前 canonical skin 沒有獨立 tail asset reference，無法安全匯出。');
  const variants: RuneSkinManifest['variants'] = skin.mode === 'css'
    ? { self: { mode: 'css' }, other: { mode: 'css' } }
    : skin.mirror.allowed && !skin.mirror.leftAsset
      ? { self: portableImage(skin, 'self.png'), other: portableImage(skin, 'self.png') }
      : { self: portableImage(skin, 'self.png'), other: skin.mirror.leftAsset ? portableImage(skin, 'other.png') : { mode: 'css' } };
  const meaning = JSON.stringify({ name, author: clean(metadata.author, 120), description: clean(metadata.description, 500), skin });
  return { format: RUNE_SKIN_FORMAT, version: RUNE_SKIN_VERSION, meta: { id: `runeskin-${hash(meaning)}`, name, author: clean(metadata.author, 120), description: clean(metadata.description, 500) }, variants };
}

export async function exportRuneSkinPackage(skin: ChatBubbleSkin, metadata: RuneSkinExportMetadata): Promise<RuneSkinExportResult> {
  const manifest = await buildRuneSkinManifest(skin, metadata);
  const zip = new JSZip();
  const files = new Map<string, Blob>();
  if (skin.mode === 'image') {
    const selfSource = skin.mirror.rightAsset || skin.source;
    const selfBlob = await resolveAsset(selfSource, 'self');
    const selfName = `self.${extensionFor(selfBlob)}`;
    if (manifest.variants.self.mode === 'image') manifest.variants.self.image.file = selfName;
    if (manifest.variants.other.mode === 'image' && manifest.variants.other.image.file === 'self.png') manifest.variants.other.image.file = selfName;
    files.set(selfName, selfBlob);
    if (skin.mirror.leftAsset) {
      const otherBlob = await resolveAsset(skin.mirror.leftAsset, 'other');
      const otherName = `other.${extensionFor(otherBlob)}`;
      if (manifest.variants.other.mode === 'image') manifest.variants.other.image.file = otherName;
      files.set(otherName, otherBlob);
    }
  }
  zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [name, blob] of files) zip.file(name, blob);
  const safeFilename = `${nameForFile(manifest.meta.name)}.runeskin`;
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: safeFilename, manifest, files: ['manifest.json', ...files.keys()] };
}

function nameForFile(name: string): string {
  const value = name.normalize('NFKC').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^[.\-]+|[.\-]+$/g, '').slice(0, 80);
  return value || 'rune-bubble-skin';
}

export function normalizeBubbleSkinMeaning(skin: ChatBubbleSkin): unknown {
  if (skin.mode === 'css') return { mode: 'css' };
  return { mode: 'image', slice: skin.slice, insets: skin.insets, mirror: { allowed: skin.mirror.allowed, hasLeft: Boolean(skin.mirror.leftAsset), hasRight: Boolean(skin.mirror.rightAsset) }, tail: skin.tail, edgeMode: skin.edgeMode || 'stretch', edgeWidth: skin.edgeWidth || skin.slice };
}
