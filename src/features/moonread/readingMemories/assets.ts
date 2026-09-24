import { deleteAsset, savePortableAsset } from '@/store/assets';
import type { ReadingMemoryBoard } from './types';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);
export const READING_MEMORY_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

export function validateReadingMemoryImage(file: File) {
  if (!ACCEPTED.has(file.type)) throw new Error('僅支援 PNG、JPEG、WebP 或 AVIF 圖片');
  if (file.size > READING_MEMORY_IMAGE_MAX_BYTES) throw new Error('圖片不可超過 12 MB');
}

export async function createReadingMemoryThumbnail(file: File): Promise<Blob> {
  validateReadingMemoryImage(file);
  const objectUrl = URL.createObjectURL(file);
  const source = new Image();
  source.src = objectUrl;
  await new Promise<void>((resolve, reject) => {
    source.onload = () => resolve();
    source.onerror = () => reject(new Error('無法解碼圖片'));
  });
  const width = source.naturalWidth;
  const height = source.naturalHeight;
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(objectUrl);
  const type = file.type === 'image/avif' ? 'image/webp' : file.type;
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法建立圖片縮圖')), type, 0.9));
}

export async function saveReadingMemoryImage(file: File) {
  try {
    const blob = await createReadingMemoryThumbnail(file);
    const fileType = blob.type || file.type;
    const portableBlob = new Blob([await blob.arrayBuffer()], { type: fileType });
    return await savePortableAsset(portableBlob, fileType);
  } catch (error) {
    throw new Error(error instanceof Error ? `圖片保存失敗：${error.message}` : '圖片保存失敗');
  }
}

export function isAssetReferenced(assetId: string, boards: ReadingMemoryBoard[]) {
  return boards.some((board) => board.imageLayers.some((item) => item.assetId === assetId));
}

export async function deleteReadingMemoryAssetIfUnreferenced(assetId: string, boards: ReadingMemoryBoard[]) {
  if (isAssetReferenced(assetId, boards)) return false;
  await deleteAsset(assetId);
  return true;
}
