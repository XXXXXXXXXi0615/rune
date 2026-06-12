export interface CompressImageOptions {
  maxWidth: number;
  maxHeight: number;
  outputType: 'image/webp' | 'image/png' | 'image/jpeg';
  quality: number;
}

async function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function fallbackType(file: File, requestedType: string): string {
  if (requestedType !== 'image/webp') return file.type || 'image/png';
  if (file.type === 'image/jpeg') return 'image/jpeg';
  return 'image/png';
}

export async function compressImageFile(file: File, options: CompressImageOptions): Promise<Blob> {
  const source = await loadImageSource(file);
  const width = source.width;
  const height = source.height;
  const ratio = Math.min(options.maxWidth / width, options.maxHeight / height, 1);
  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    if ('close' in source) source.close();
    throw new Error('Canvas unavailable');
  }

  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  if ('close' in source) source.close();

  const preferred = await canvasToBlob(canvas, options.outputType, options.quality);
  if (preferred) return preferred;

  const fallback = await canvasToBlob(canvas, fallbackType(file, options.outputType), options.quality);
  if (fallback) return fallback;

  throw new Error('Image compression failed');
}

export function compressedImageName(fileName: string, mimeType: string): string {
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : 'png';
  return `${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
}
