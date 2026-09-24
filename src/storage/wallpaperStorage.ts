const DB_NAME = 'lunartide-wallpapers';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';

export const WALLPAPER_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const WALLPAPER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

interface WallpaperRecord {
  id: string;
  original: Blob;
  thumbnail: Blob;
  fileType: string;
  fileName: string;
  createdAt: string;
  protectedOriginal: true;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function validateWallpaperFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtension = extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'webp' || extension === 'avif';
  if (!WALLPAPER_MIME_TYPES.includes(file.type as typeof WALLPAPER_MIME_TYPES[number]) && !allowedExtension) return '僅支援 PNG、JPG、JPEG、WebP 或 AVIF 圖片。';
  if (file.size > WALLPAPER_MAX_FILE_BYTES) return '圖片大小不可超過 20 MB。';
  return null;
}

export async function saveWallpaper(original: Blob, thumbnail: Blob, file: Pick<File, 'name' | 'type'>): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const record: WallpaperRecord = {
    id,
    original,
    thumbnail,
    fileType: original.type || file.type,
    fileName: file.name,
    createdAt: new Date().toISOString(),
    protectedOriginal: true,
  };
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).add(record);
    transaction.oncomplete = () => { db.close(); resolve(id); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function getWallpaper(id: string, thumbnail = false): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => { const record = request.result as WallpaperRecord | undefined; db.close(); resolve(record ? (thumbnail ? record.thumbnail : record.original) : null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteWallpaper(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
