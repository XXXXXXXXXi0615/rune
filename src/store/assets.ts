const DB_NAME = 'lunartide-assets';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

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

interface AssetRecord {
  id: string;
  data: Blob | ArrayBuffer;
  fileType: string;
  createdAt: string;
}

export async function savePortableAsset(blob: Blob, fileType: string): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const record: AssetRecord = {
    id,
    data: await blob.arrayBuffer(),
    fileType,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    txn.objectStore(STORE_NAME).add(record);
    txn.oncomplete = () => {
      db.close();
      resolve(id);
    };
    txn.onerror = () => {
      const error = txn.error || new Error('IndexedDB asset transaction failed');
      db.close();
      reject(error);
    };
  });
}

export async function saveAsset(blob: Blob, fileType: string): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const record: AssetRecord = {
    id,
    data: blob,
    fileType,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    txn.objectStore(STORE_NAME).add(record);
    txn.oncomplete = () => {
      db.close();
      resolve(id);
    };
    txn.onerror = () => {
      db.close();
      reject(txn.error);
    };
  });
}

export async function getAsset(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      const record = req.result as AssetRecord | undefined;
      resolve(record ? (record.data instanceof Blob ? record.data : new Blob([record.data], { type: record.fileType })) : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteAsset(id: string): Promise<void> {
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

export async function deleteAssets(ids: string[]): Promise<void> {
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

export async function getAllAssetIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readonly');
    const req = txn.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => { db.close(); resolve(req.result as string[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function saveAssetWithId(id: string, blob: Blob, fileType: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    txn.objectStore(STORE_NAME).put({ id, data: blob, fileType, createdAt: new Date().toISOString() } satisfies AssetRecord);
    txn.oncomplete = () => { db.close(); resolve(); };
    txn.onerror = () => { db.close(); reject(txn.error); };
  });
}
