import { compressImageFile } from '@/utils/imageCompression';

export interface ProcessedBoardImage {
  imageUrl: string;
  mimeType: string;
  hasAlpha: boolean;
}

function outputTypeFor(file: File): 'image/png' | 'image/webp' | 'image/jpeg' {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  if (file.type === 'image/jpeg') return 'image/jpeg';
  return 'image/png';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function detectAlpha(blob: Blob): Promise<boolean> {
  if (blob.type === 'image/jpeg') return false;
  const bitmap: ImageBitmap | HTMLImageElement = 'createImageBitmap' in window
    ? await createImageBitmap(blob)
    : await new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Alpha detection image load failed')); };
      image.src = url;
    });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) { if ('close' in bitmap) bitmap.close(); return false; }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  if ('close' in bitmap) bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 255) return true;
  return false;
}

export async function processBoardImage(file: File): Promise<ProcessedBoardImage> {
  const outputType = outputTypeFor(file);
  let blob = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, outputType, quality: .82 });
  if (blob.size > 800 * 1024) blob = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, outputType, quality: .68 });
  const mimeType = blob.type || outputType;
  return { imageUrl: await blobToDataUrl(blob), mimeType, hasAlpha: await detectAlpha(blob) };
}
