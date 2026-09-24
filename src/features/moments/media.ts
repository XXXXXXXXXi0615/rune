import { deleteAssets, savePortableAsset } from '@/store/assets';
import { compressImageFile } from '@/utils/imageCompression';
import { createMomentMediaItem, type MomentMediaItem } from './domain';

export const MOMENT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const MOMENT_IMAGE_MAX_COUNT = 9;
export const MOMENT_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class MomentMediaError extends Error {}

export function validateMomentImageFiles(files: File[]): void {
  if (files.length > MOMENT_IMAGE_MAX_COUNT) throw new MomentMediaError('每則動態最多 9 張圖片');
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) throw new MomentMediaError('只支援 PNG、JPG 與 WebP 圖片');
    if (file.size > MOMENT_IMAGE_MAX_SOURCE_BYTES) throw new MomentMediaError('單張圖片不可超過 12 MB');
  }
}

export async function storeMomentImages(files: File[]): Promise<string[]> {
  validateMomentImageFiles(files);
  const assetIds: string[] = [];
  try {
    for (const file of files) {
      const blob = await compressImageFile(file, {
        maxWidth: 1800,
        maxHeight: 1800,
        outputType: 'image/webp',
        quality: .86,
      }).catch(() => file.slice(0, file.size, file.type));
      assetIds.push(await savePortableAsset(blob, blob.type || 'image/webp'));
    }
    return assetIds;
  } catch (error) {
    if (assetIds.length) await deleteAssets(assetIds).catch(() => {});
    if (error instanceof MomentMediaError) throw error;
    throw new MomentMediaError('圖片處理失敗，請再試一次');
  }
}

async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch { return {}; }
}

export async function storeMomentMediaItems(files: File[], startOrder = 0): Promise<MomentMediaItem[]> {
  const dimensions = await Promise.all(files.map(readImageDimensions));
  const assetIds = await storeMomentImages(files);
  return assetIds.map((assetId, index) => createMomentMediaItem(assetId, startOrder + index, dimensions[index]));
}

export async function releaseMomentMedia(assetIds: string[]): Promise<void> {
  if (assetIds.length) await deleteAssets([...new Set(assetIds)]);
}
