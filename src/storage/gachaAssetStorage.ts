const DB_NAME = 'lunartide-gacha-assets';
const DB_VERSION = 1;
const STORE_NAME = 'gachaImages';
const MAX_DIM = 512;

interface GachaAssetRecord {
  id: string;
  data: Blob;
  mimeType: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      if (width <= MAX_DIM && height <= MAX_DIM) {
        resolve(file);
        return;
      }
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
      const dw = Math.round(width * ratio);
      const dh = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      const size = Math.min(dw, dh);
      const sx = Math.round((width - size) / 2);
      const sy = Math.round((height - size) / 2);
      ctx.drawImage(img, sx, sy, size, size, 0, 0, dw, dh);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        file.type,
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function uploadGachaImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  return saveAsset(compressed, compressed.type || file.type || 'image/png');
}

export async function readGachaImage(id: string): Promise<Blob | null> {
  const shared = await getAsset(id).catch(() => null);
  if (shared) return shared;
  // Read-only compatibility for images created before Phase 3.
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      const record = req.result as GachaAssetRecord | undefined;
      resolve(record ? record.data : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

async function readLegacyGachaImage(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => { db.close(); resolve((req.result as GachaAssetRecord | undefined)?.data || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function migrateLegacyGachaAsset(id: string): Promise<'already-shared' | 'migrated' | 'missing' | 'verification-failed'> {
  if (await getAsset(id).catch(() => null)) return 'already-shared';
  const legacy = await readLegacyGachaImage(id).catch(() => null);
  if (!legacy) return 'missing';
  await saveAssetWithId(id, legacy, legacy.type || 'image/png');
  const verified = await getAsset(id).catch(() => null);
  if (!verified || verified.size !== legacy.size || verified.type !== legacy.type) return 'verification-failed';
  return 'migrated';
}

export async function replaceGachaImage(id: string, file: File): Promise<void> {
  const compressed = await compressImage(file);
  const db = await openDB();
  const record: GachaAssetRecord = {
    id,
    data: compressed,
    mimeType: file.type || 'image/png',
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    txn.objectStore(STORE_NAME).put(record);
    txn.oncomplete = () => {
      db.close();
      resolve();
    };
    txn.onerror = () => {
      db.close();
      reject(txn.error);
    };
  });
}

export async function deleteGachaImage(id: string): Promise<void> {
  await deleteAsset(id).catch(() => undefined);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    txn.objectStore(STORE_NAME).delete(id);
    txn.oncomplete = () => {
      db.close();
      resolve();
    };
    txn.onerror = () => {
      db.close();
      reject(txn.error);
    };
  });
}

export async function deleteGachaImages(ids: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    for (const id of ids) {
      store.delete(id);
    }
    txn.oncomplete = () => {
      db.close();
      resolve();
    };
    txn.onerror = () => {
      db.close();
      reject(txn.error);
    };
  });
}

export async function getAllGachaImageIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => {
      db.close();
      resolve(req.result as string[]);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function cleanupOrphanImages(activeIds: Set<string>): Promise<number> {
  const allIds = await getAllGachaImageIds();
  const orphans = allIds.filter((id) => !activeIds.has(id));
  if (orphans.length > 0) {
    await deleteGachaImages(orphans);
  }
  return orphans.length;
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_TTL_MS = 5 * 60 * 1000;

export function getGachaImageUrl(id: string): string | null {
  const cached = urlCache.get(id);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }
  return null;
}

export async function createGachaImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }
  const blob = await readGachaImage(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, { url, expiresAt: Date.now() + URL_TTL_MS });
  return url;
}

export function revokeGachaImageUrl(id: string): void {
  const cached = urlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached.url);
    urlCache.delete(id);
  }
}

export function revokeAllGachaImageUrls(): void {
  for (const [, entry] of urlCache) {
    URL.revokeObjectURL(entry.url);
  }
  urlCache.clear();
}

export function gachaImagePlaceholderSVG(hue = 210): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect fill='%23f5f0e8' width='160' height='160' rx='16'/%3E%3Ccircle cx='80' cy='68' r='28' fill='none' stroke='hsl(${hue},25%25,78%25)' stroke-width='2.5'/%3E%3Cpath d='M48 118 Q48 148 80 148 Q112 148 112 118' fill='none' stroke='hsl(${hue},25%25,78%25)' stroke-width='2.5'/%3E%3Ccircle cx='80' cy='42' r='14' fill='hsl(${hue},18%25,88%25)'/%3E%3C/svg%3E`;
}
import { deleteAsset, getAsset, saveAsset, saveAssetWithId } from '@/store/assets';
