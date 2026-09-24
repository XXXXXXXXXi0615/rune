import JSZip from 'jszip';
import { deleteAssets, savePortableAsset } from '@/store/assets';
import { useChatThemeStore, type ChatTheme } from '@/store/useChatThemeStore';
import type { BubbleSkinInsets, BubbleSkinSlice, ChatBubbleSkin, ImageBubbleSkin } from './types';

export const RUNE_SKIN_FORMAT = 'rune-bubble-skin' as const;
export const RUNE_SKIN_VERSION = 1 as const;
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Map([['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]);

export type PortableRuneSkinImage = {
  file: string;
  slice: BubbleSkinSlice;
  contentInsets: BubbleSkinInsets;
  edgeMode?: ImageBubbleSkin['edgeMode'];
  edgeWidth?: BubbleSkinSlice;
  mirror?: { allowed?: boolean };
  tail?: { kind?: 'integrated' | 'none' };
};
export type PortableRuneSkinVariant = { mode: 'css' } | { mode: 'image'; image: PortableRuneSkinImage };
export interface RuneSkinManifest {
  format: typeof RUNE_SKIN_FORMAT;
  version: typeof RUNE_SKIN_VERSION;
  meta: { id: string; name: string; author?: string; description?: string };
  variants: { self: PortableRuneSkinVariant; other: PortableRuneSkinVariant };
}
export interface ParsedRuneSkinPackage { manifest: RuneSkinManifest; files: ReadonlyMap<string, Blob> }
export interface ValidatedRuneSkinPackage extends ParsedRuneSkinPackage { dimensions: ReadonlyMap<string, { width: number; height: number }> }
export interface RuneSkinImportResult { skin: ChatBubbleSkin; importedAssets: string[]; warnings: string[] }
export interface ExternalThemeAdapter<T> { toBubbleSkin(input: T): Promise<ChatBubbleSkin> | ChatBubbleSkin }

export class RuneSkinValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'RuneSkinValidationError'; }
}

function safePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new RuneSkinValidationError(`套件包含不安全的路徑：${path}`);
  }
  return normalized;
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function finiteBox(value: unknown, label: string): BubbleSkinSlice {
  if (!record(value)) throw new RuneSkinValidationError(`${label} 格式無效。`);
  const keys = ['top', 'right', 'bottom', 'left'] as const;
  const result = {} as BubbleSkinSlice;
  for (const key of keys) {
    const number = value[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) throw new RuneSkinValidationError(`${label}.${key} 必須是非負數。`);
    result[key] = number;
  }
  return result;
}

function parseVariant(value: unknown, label: string): PortableRuneSkinVariant {
  if (!record(value) || (value.mode !== 'css' && value.mode !== 'image')) throw new RuneSkinValidationError(`${label} mode 無效。`);
  if (value.mode === 'css') return { mode: 'css' };
  if (!record(value.image) || typeof value.image.file !== 'string') throw new RuneSkinValidationError(`${label} 缺少 image.file。`);
  const tail: PortableRuneSkinImage['tail'] = record(value.image.tail) && (value.image.tail.kind === 'integrated' || value.image.tail.kind === 'none') ? { kind: value.image.tail.kind } : undefined;
  const edgeMode = value.image.edgeMode;
  if (edgeMode !== undefined && !['stretch', 'repeat', 'round', 'space'].includes(String(edgeMode))) throw new RuneSkinValidationError(`${label}.edgeMode 無效。`);
  return { mode: 'image', image: { file: safePath(value.image.file), slice: finiteBox(value.image.slice, `${label}.slice`), contentInsets: finiteBox(value.image.contentInsets, `${label}.contentInsets`), edgeMode: edgeMode as ImageBubbleSkin['edgeMode'], edgeWidth: value.image.edgeWidth === undefined ? undefined : finiteBox(value.image.edgeWidth, `${label}.edgeWidth`), mirror: record(value.image.mirror) ? { allowed: value.image.mirror.allowed === true } : undefined, tail } };
}

function parseManifest(value: unknown): RuneSkinManifest {
  if (!record(value)) throw new RuneSkinValidationError('manifest.json 格式無效。');
  if (value.format !== RUNE_SKIN_FORMAT) throw new RuneSkinValidationError('不支援的 Rune skin 格式。');
  if (value.version !== RUNE_SKIN_VERSION) throw new RuneSkinValidationError(`不支援的 Rune skin 版本：${String(value.version)}`);
  if (!record(value.meta) || typeof value.meta.id !== 'string' || typeof value.meta.name !== 'string' || !value.meta.id.trim() || !value.meta.name.trim()) throw new RuneSkinValidationError('套件 meta.id 與 meta.name 為必填。');
  if (!record(value.variants)) throw new RuneSkinValidationError('套件缺少 variants。');
  return { format: RUNE_SKIN_FORMAT, version: RUNE_SKIN_VERSION, meta: { id: value.meta.id, name: value.meta.name, author: typeof value.meta.author === 'string' ? value.meta.author : undefined, description: typeof value.meta.description === 'string' ? value.meta.description : undefined }, variants: { self: parseVariant(value.variants.self, 'variants.self'), other: parseVariant(value.variants.other, 'variants.other') } };
}

export async function parseRuneSkinPackage(file: Blob): Promise<ParsedRuneSkinPackage> {
  if (file.size > MAX_PACKAGE_BYTES) throw new RuneSkinValidationError('Rune skin 套件超過 20 MB。');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(file); } catch { throw new RuneSkinValidationError('無法讀取 Rune skin 壓縮檔。'); }
  const files = new Map<string, Blob>();
  const normalized = new Set<string>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const originalName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName;
    if (originalName && originalName !== entry.name) safePath(originalName);
    const path = safePath(entry.name);
    const key = path.toLowerCase();
    if (normalized.has(key)) throw new RuneSkinValidationError(`套件包含重複檔名：${path}`);
    normalized.add(key);
    if (key !== 'manifest.json' && !IMAGE_TYPES.has(path.split('.').pop()?.toLowerCase() || '')) throw new RuneSkinValidationError(`不支援的套件內容：${path}`);
    files.set(path, await entry.async('blob'));
  }
  const manifestBlob = [...files].find(([name]) => name.toLowerCase() === 'manifest.json')?.[1];
  if (!manifestBlob) throw new RuneSkinValidationError('套件缺少 manifest.json。');
  let raw: unknown;
  try { raw = JSON.parse(await manifestBlob.text()); } catch { throw new RuneSkinValidationError('manifest.json 不是有效的 JSON。'); }
  return { manifest: parseManifest(raw), files };
}

async function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch { throw new RuneSkinValidationError('套件中的圖片無法解碼。'); }
}

export async function validateRuneSkinPackage(parsed: ParsedRuneSkinPackage): Promise<ValidatedRuneSkinPackage> {
  const dimensions = new Map<string, { width: number; height: number }>();
  for (const variant of [parsed.manifest.variants.self, parsed.manifest.variants.other]) {
    if (variant.mode === 'css') continue;
    const blob = parsed.files.get(variant.image.file);
    if (!blob) throw new RuneSkinValidationError(`套件缺少圖片：${variant.image.file}`);
    const extension = variant.image.file.split('.').pop()?.toLowerCase() || '';
    const expectedType = IMAGE_TYPES.get(extension);
    if (!expectedType || (blob.type && blob.type !== expectedType)) throw new RuneSkinValidationError(`圖片類型無效：${variant.image.file}`);
    if (blob.size > MAX_ASSET_BYTES) throw new RuneSkinValidationError(`圖片超過 8 MB：${variant.image.file}`);
    const size = dimensions.get(variant.image.file) || await imageDimensions(blob);
    dimensions.set(variant.image.file, size);
    if (variant.image.slice.left + variant.image.slice.right > size.width || variant.image.slice.top + variant.image.slice.bottom > size.height) throw new RuneSkinValidationError(`切片尺寸超過圖片範圍：${variant.image.file}`);
  }
  return { ...parsed, dimensions };
}

export async function importRuneSkinAssets(pkg: ValidatedRuneSkinPackage): Promise<RuneSkinImportResult> {
  const { self, other } = pkg.manifest.variants;
  if (self.mode === 'css' && other.mode === 'css') return { skin: { mode: 'css' }, importedAssets: [], warnings: [] };
  if (self.mode === 'css' && other.mode === 'image') throw new RuneSkinValidationError('目前 canonical skin 不支援僅 other 使用圖片。');
  const importedAssets: string[] = [];
  try {
    const ids = new Map<string, string>();
    for (const variant of [self, other]) {
      if (variant.mode !== 'image') continue;
      if (!ids.has(variant.image.file)) {
        const blob = pkg.files.get(variant.image.file)!;
        ids.set(variant.image.file, await savePortableAsset(blob, IMAGE_TYPES.get(variant.image.file.split('.').pop()!.toLowerCase())!));
        importedAssets.push(ids.get(variant.image.file)!);
      }
    }
    if (self.mode !== 'image') throw new RuneSkinValidationError('self variant 格式無效。');
    const sameMirroredSource = other.mode === 'image' && other.image.file === self.image.file && self.image.mirror?.allowed === true;
    const mirror: ImageBubbleSkin['mirror'] = sameMirroredSource
      ? { allowed: true }
      : other.mode === 'image'
        ? { allowed: false, rightAsset: { kind: 'asset', assetId: ids.get(self.image.file)! }, leftAsset: { kind: 'asset', assetId: ids.get(other.image.file)! } }
        : { allowed: false };
    const skin: ImageBubbleSkin = { mode: 'image', source: { kind: 'asset', assetId: ids.get(self.image.file)! }, slice: self.image.slice, insets: self.image.contentInsets, mirror, tail: { kind: self.image.tail?.kind === 'none' ? 'none' : 'image-integrated' }, edgeMode: self.image.edgeMode, edgeWidth: self.image.edgeWidth };
    return { skin, importedAssets, warnings: self.image.mirror?.allowed ? ['已提供方向圖片，因此不需要鏡像。'] : [] };
  } catch (error) {
    if (importedAssets.length) await deleteAssets(importedAssets);
    throw error;
  }
}

export function applyBubbleSkinToTheme(skin: ChatBubbleSkin): ChatTheme {
  useChatThemeStore.getState().updateCurrent({ bubbleSkin: skin });
  return useChatThemeStore.getState().currentTheme;
}
