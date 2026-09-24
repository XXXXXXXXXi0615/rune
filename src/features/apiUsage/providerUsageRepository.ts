import type { ProviderUsageRecord } from './apiUsageTypes';

export const PROVIDER_USAGE_DB_NAME = 'lunartide-provider-usage';
export const PROVIDER_USAGE_DB_VERSION = 1;
export const PROVIDER_USAGE_RECORDS_STORE = 'provider_usage_records';
export const PROVIDER_USAGE_DAILY_ROLLUPS_STORE = 'provider_usage_daily_rollups';
export const PROVIDER_USAGE_META_STORE = 'provider_usage_meta';

export interface ProviderUsageRepository {
  add(record: ProviderUsageRecord): Promise<void>;
  getAll(): Promise<ProviderUsageRecord[]>;
  clear(): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export class IndexedDbProviderUsageRepository implements ProviderUsageRepository {
  private dbPromise?: Promise<IDBDatabase>;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(PROVIDER_USAGE_DB_NAME, PROVIDER_USAGE_DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(PROVIDER_USAGE_RECORDS_STORE)) {
            const records = db.createObjectStore(PROVIDER_USAGE_RECORDS_STORE, { keyPath: 'id' });
            for (const key of ['completedAt', 'providerConfigId', 'providerType', 'model', 'requestType', 'operationId', 'status']) {
              records.createIndex(key, key, { unique: false });
            }
          }
          if (!db.objectStoreNames.contains(PROVIDER_USAGE_DAILY_ROLLUPS_STORE)) {
            db.createObjectStore(PROVIDER_USAGE_DAILY_ROLLUPS_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(PROVIDER_USAGE_META_STORE)) {
            db.createObjectStore(PROVIDER_USAGE_META_STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Unable to open usage database'));
      });
    }
    return this.dbPromise;
  }

  async add(record: ProviderUsageRecord): Promise<void> {
    const db = await this.open();
    await requestResult(db.transaction(PROVIDER_USAGE_RECORDS_STORE, 'readwrite')
      .objectStore(PROVIDER_USAGE_RECORDS_STORE).add(record));
  }

  async getAll(): Promise<ProviderUsageRecord[]> {
    const db = await this.open();
    return requestResult(db.transaction(PROVIDER_USAGE_RECORDS_STORE, 'readonly')
      .objectStore(PROVIDER_USAGE_RECORDS_STORE).getAll());
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await requestResult(db.transaction(PROVIDER_USAGE_RECORDS_STORE, 'readwrite')
      .objectStore(PROVIDER_USAGE_RECORDS_STORE).clear());
  }
}

/** Deterministic repository for lifecycle tests; production always uses IndexedDB. */
export class MemoryProviderUsageRepository implements ProviderUsageRepository {
  private readonly records: ProviderUsageRecord[];
  constructor(records: ProviderUsageRecord[] = []) { this.records = records; }
  async add(record: ProviderUsageRecord) { this.records.push(structuredClone(record)); }
  async getAll() { return this.records.map((record) => structuredClone(record)); }
  async clear() { this.records.splice(0); }
}
