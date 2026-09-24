import {
  LIFE_LEDGER_DB_NAME,
  LIFE_LEDGER_DB_VERSION,
  type LifeLedgerDietReceipt,
  type LifeLedgerCookingLog,
  type LifeLedgerEntry,
  type LifeLedgerItemLifecycleEvent,
  type LifeLedgerMigrationMeta,
  type LifeLedgerRecipe,
  type LifeLedgerEntryType,
  type LifeLedgerSourceOwner,
} from './domain';
import { LIFE_LEDGER_CHANGED_EVENT } from '@/features/integration/appEntityReference';

function notifyLifeLedgerChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LIFE_LEDGER_CHANGED_EVENT));
}

export type LifeLedgerStoreName = 'entries' | 'recipes' | 'item_lifecycle_events' | 'diet_receipts' | 'cooking_logs' | 'migration_meta';
export type LifeLedgerRecordMap = {
  entries: LifeLedgerEntry;
  recipes: LifeLedgerRecipe;
  item_lifecycle_events: LifeLedgerItemLifecycleEvent;
  diet_receipts: LifeLedgerDietReceipt;
  cooking_logs: LifeLedgerCookingLog;
  migration_meta: LifeLedgerMigrationMeta;
};

export interface LifeLedgerRepository {
  put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]): Promise<void>;
  getAll<K extends LifeLedgerStoreName>(store: K): Promise<LifeLedgerRecordMap[K][]>;
  getById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined>;
  deleteById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<void>;
  withTransaction<T>(storeNames: LifeLedgerStoreName[], mode: 'readonly' | 'readwrite', fn: (tx: LifeLedgerTransactionContext) => Promise<T>): Promise<T>;
  getAllEntries(): Promise<LifeLedgerEntry[]>;
  getEntryById(id: string): Promise<LifeLedgerEntry | undefined>;
  getEntriesByType(type: LifeLedgerEntryType): Promise<LifeLedgerEntry[]>;
  getEntriesByDateRange(from: string, to: string): Promise<LifeLedgerEntry[]>;
  getEntriesBySourceOwner(owner: LifeLedgerSourceOwner): Promise<LifeLedgerEntry[]>;
  getRecipes(): Promise<LifeLedgerRecipe[]>;
  getCookingLogs(): Promise<LifeLedgerCookingLog[]>;
  getItemLifecycleByItem(itemEntryId: string): Promise<LifeLedgerItemLifecycleEvent[]>;
  getDietReceipts(): Promise<LifeLedgerDietReceipt[]>;
  getMigrationHealth(): Promise<LifeLedgerMigrationMeta | undefined>;
}

export interface LifeLedgerTransactionContext {
  put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]): void;
  delete<K extends LifeLedgerStoreName>(store: K, ids: (string | number)[]): void;
  get<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined>;
}

const compareText = (a: string, b: string) => a.localeCompare(b, 'en');
const newestFirst = <T extends { id: string }>(date: (record: T) => string) =>
  (a: T, b: T) => date(b).localeCompare(date(a)) || compareText(a.id, b.id);

function createReadApi(getAll: LifeLedgerRepository['getAll']): Omit<LifeLedgerRepository, 'put' | 'getAll' | 'getById' | 'deleteById' | 'withTransaction'> {
  const entries = async () => (await getAll('entries')).sort(newestFirst((entry) => entry.occurredAt));
  return {
    getAllEntries: entries,
    async getEntryById(id) { return (await getAll('entries')).find((entry) => entry.id === id); },
    async getEntriesByType(type) { return (await entries()).filter((entry) => entry.type === type); },
    async getEntriesByDateRange(from, to) {
      return (await entries()).filter((entry) => entry.occurredAt >= from && entry.occurredAt <= to);
    },
    async getEntriesBySourceOwner(owner) { return (await entries()).filter((entry) => entry.source.owner === owner); },
    async getRecipes() { return (await getAll('recipes')).sort(newestFirst((record) => record.updatedAt)); },
    async getCookingLogs() { return (await getAll('cooking_logs')).sort(newestFirst((record) => record.cookedAt)); },
    async getItemLifecycleByItem(itemEntryId) {
      return (await getAll('item_lifecycle_events'))
        .filter((event) => event.itemEntryId === itemEntryId)
        .sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt) || compareText(a.id, b.id));
    },
    async getDietReceipts() { return (await getAll('diet_receipts')).sort(newestFirst((record) => record.date)); },
    async getMigrationHealth() {
      return (await getAll('migration_meta')).sort((a, b) => b.migrationVersion - a.migrationVersion)[0];
    },
  };
}

function openLifeLedgerDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIFE_LEDGER_DB_NAME, LIFE_LEDGER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['entries', 'recipes', 'item_lifecycle_events', 'diet_receipts'] as const) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('source_identity', ['source.owner', 'source.legacyId'], { unique: true });
        }
      }
      if (!db.objectStoreNames.contains('migration_meta')) {
        db.createObjectStore('migration_meta', { keyPath: 'migrationVersion' });
      }
      if (!db.objectStoreNames.contains('cooking_logs')) {
        const store = db.createObjectStore('cooking_logs', { keyPath: 'id' });
        store.createIndex('source_identity', ['source.owner', 'source.legacyId'], { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const indexedDbBase: Pick<LifeLedgerRepository, 'put' | 'getAll' | 'getById' | 'deleteById' | 'withTransaction'> = {
  async put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]) {
    if (records.length === 0) return;
    const db = await openLifeLedgerDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      records.forEach((record) => objectStore.put(record));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).finally(() => db.close());
    notifyLifeLedgerChanged();
  },
  async getAll<K extends LifeLedgerStoreName>(store: K): Promise<LifeLedgerRecordMap[K][]> {
    const db = await openLifeLedgerDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result as LifeLedgerRecordMap[K][]);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => db.close();
    });
  },
  async getById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined> {
    const db = await openLifeLedgerDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = transaction.objectStore(store).get(id);
      request.onsuccess = () => resolve(request.result as LifeLedgerRecordMap[K] | undefined);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => db.close();
    });
  },
  async deleteById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<void> {
    const db = await openLifeLedgerDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).finally(() => db.close());
    notifyLifeLedgerChanged();
  },
  async withTransaction<T>(storeNames: LifeLedgerStoreName[], mode: 'readonly' | 'readwrite', fn: (tx: LifeLedgerTransactionContext) => Promise<T>): Promise<T> {
    const db = await openLifeLedgerDB();
    try {
      const transaction = db.transaction(storeNames, mode);
      const stores = new Map<string, IDBObjectStore>();
      for (const name of storeNames) {
        stores.set(name, transaction.objectStore(name));
      }
      const ctx: LifeLedgerTransactionContext = {
        put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]) {
          const objectStore = stores.get(store)!;
          for (const record of records) objectStore.put(record);
        },
        delete<K extends LifeLedgerStoreName>(store: K, ids: (string | number)[]) {
          const objectStore = stores.get(store)!;
          for (const id of ids) objectStore.delete(id);
        },
        get<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined> {
          return new Promise((resolve, reject) => {
            const request = stores.get(store)!.get(id);
            request.onsuccess = () => resolve(request.result as LifeLedgerRecordMap[K] | undefined);
            request.onerror = () => reject(request.error);
          });
        },
      };
      const result = await fn(ctx);
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      return result;
    } finally {
      db.close();
    }
  },
};

export const lifeLedgerRepository: LifeLedgerRepository = {
  ...indexedDbBase,
  ...createReadApi(indexedDbBase.getAll),
};

export class MemoryLifeLedgerRepository implements LifeLedgerRepository {
  private readonly stores: { [K in LifeLedgerStoreName]: Map<string | number, LifeLedgerRecordMap[K]> } = {
    entries: new Map(), recipes: new Map(), item_lifecycle_events: new Map(), diet_receipts: new Map(), cooking_logs: new Map(), migration_meta: new Map(),
  };
  async put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]): Promise<void> {
    for (const record of records) {
      const key = store === 'migration_meta'
        ? (record as LifeLedgerMigrationMeta).migrationVersion
        : (record as { id: string }).id;
      (this.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).set(key, structuredClone(record));
    }
  }
  async getAll<K extends LifeLedgerStoreName>(store: K): Promise<LifeLedgerRecordMap[K][]> {
    return [...this.stores[store].values()].map((record) => structuredClone(record)) as LifeLedgerRecordMap[K][];
  }
  async getById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined> {
    const record = (this.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).get(id);
    return record ? structuredClone(record) : undefined;
  }
  async deleteById<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<void> {
    (this.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).delete(id);
  }
  async withTransaction<T>(_storeNames: LifeLedgerStoreName[], _mode: 'readonly' | 'readwrite', fn: (tx: LifeLedgerTransactionContext) => Promise<T>): Promise<T> {
    const self = this;
    const ctx: LifeLedgerTransactionContext = {
      put<K extends LifeLedgerStoreName>(store: K, records: LifeLedgerRecordMap[K][]) {
        for (const record of records) {
          const key = store === 'migration_meta'
            ? (record as LifeLedgerMigrationMeta).migrationVersion
            : (record as { id: string }).id;
          (self.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).set(key, structuredClone(record));
        }
      },
      delete<K extends LifeLedgerStoreName>(store: K, ids: (string | number)[]) {
        for (const id of ids) {
          (self.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).delete(id);
        }
      },
      async get<K extends LifeLedgerStoreName>(store: K, id: string | number): Promise<LifeLedgerRecordMap[K] | undefined> {
        const record = (self.stores[store] as Map<string | number, LifeLedgerRecordMap[K]>).get(id);
        return record ? structuredClone(record) : undefined;
      },
    };
    return fn(ctx);
  }
  getAllEntries = createReadApi(this.getAll.bind(this)).getAllEntries;
  getEntryById = createReadApi(this.getAll.bind(this)).getEntryById;
  getEntriesByType = createReadApi(this.getAll.bind(this)).getEntriesByType;
  getEntriesByDateRange = createReadApi(this.getAll.bind(this)).getEntriesByDateRange;
  getEntriesBySourceOwner = createReadApi(this.getAll.bind(this)).getEntriesBySourceOwner;
  getRecipes = createReadApi(this.getAll.bind(this)).getRecipes;
  getCookingLogs = createReadApi(this.getAll.bind(this)).getCookingLogs;
  getItemLifecycleByItem = createReadApi(this.getAll.bind(this)).getItemLifecycleByItem;
  getDietReceipts = createReadApi(this.getAll.bind(this)).getDietReceipts;
  getMigrationHealth = createReadApi(this.getAll.bind(this)).getMigrationHealth;
}
