const DB_NAME = 'lunartide-fonts';
const DB_VERSION = 1;
const STORE_NAME = 'font-blobs';

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

interface FontBlobRecord {
  id: string;
  data: Blob;
  format: string;
  createdAt: string;
}

export async function saveFontBlob(id: string, blob: Blob, format: string): Promise<void> {
  const db = await openDB();
  const record: FontBlobRecord = {
    id,
    data: blob,
    format,
    createdAt: new Date().toISOString(),
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

export async function getFontBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      const record = req.result as FontBlobRecord | undefined;
      resolve(record ? record.data : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteFontBlob(id: string): Promise<void> {
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

export async function fontBlobExists(id: string): Promise<boolean> {
  const blob = await getFontBlob(id).catch(() => null);
  return blob !== null;
}

export async function getAllFontBlobIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as string[]) || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
