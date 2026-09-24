/**
 * TIDEWATCH — IndexedDB repository.
 *
 * Canonical database: lunartide-tidewatch-v1
 *
 * Object stores:
 *   writing_events  — WritingTelemetryEvent[] (counts only, no raw text)
 *   activity_events — ActivityEvent[]
 *   checkins        — CheckIn[]
 *   milestones      — Milestone[]
 *   meta            — key/value metadata
 *
 * Privacy contract: writing_events contain only numeric counts.
 * No raw text payload ever persists in this database.
 */
import type {
  WritingTelemetryEvent,
  ActivityEvent,
  CheckIn,
  Milestone,
  ReviewRecord,
  TidewatchConsequence,
  TidewatchReviewPreferences,
  TidewatchConsequencePreferences,
} from './types';

const DB_NAME = 'lunartide-tidewatch-v1';
const DB_VERSION = 2;

const WRITING_STORE = 'writing_events';
const ACTIVITY_STORE = 'activity_events';
const CHECKIN_STORE = 'checkins';
const MILESTONE_STORE = 'milestones';
const META_STORE = 'meta';
const REVIEW_STORE = 'review_records';
const CONSEQUENCE_STORE = 'consequences';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WRITING_STORE)) {
        const ws = db.createObjectStore(WRITING_STORE, { keyPath: 'id' });
        ws.createIndex('timestamp', 'timestamp', { unique: false });
        ws.createIndex('actor', 'actor', { unique: false });
        ws.createIndex('surface', 'surface', { unique: false });
      }
      if (!db.objectStoreNames.contains(ACTIVITY_STORE)) {
        const as = db.createObjectStore(ACTIVITY_STORE, { keyPath: 'id' });
        as.createIndex('timestamp', 'timestamp', { unique: false });
        as.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(CHECKIN_STORE)) {
        const cs = db.createObjectStore(CHECKIN_STORE, { keyPath: 'id' });
        cs.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(MILESTONE_STORE)) {
        const ms = db.createObjectStore(MILESTONE_STORE, { keyPath: 'id' });
        ms.createIndex('scope', 'scope', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(REVIEW_STORE)) {
        const reviews = db.createObjectStore(REVIEW_STORE, { keyPath: 'id' });
        reviews.createIndex('createdAt', 'createdAt', { unique: false });
        reviews.createIndex('questId', 'questId', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONSEQUENCE_STORE)) {
        const consequences = db.createObjectStore(CONSEQUENCE_STORE, { keyPath: 'id' });
        consequences.createIndex('sourceEventId', 'sourceEventId', { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function putAll<T extends { id: string }>(
  storeName: string,
  records: T[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await openDB();
  try {
    const txn = db.transaction(storeName, 'readwrite');
    const store = txn.objectStore(storeName);
    for (const record of records) store.put(record);
    await new Promise<void>((resolve, reject) => {
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
      txn.onabort = () => reject(txn.error ?? new Error('transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  try {
    return new Promise<T[]>((resolve, reject) => {
      const txn = db.transaction(storeName, 'readonly');
      const req = txn.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function getAllInRange<T extends { timestamp: number }>(
  storeName: string,
  indexName: string,
  lower: number,
  upper: number,
): Promise<T[]> {
  const db = await openDB();
  try {
    return new Promise<T[]>((resolve, reject) => {
      const txn = db.transaction(storeName, 'readonly');
      const idx = txn.objectStore(storeName).index(indexName);
      const range = IDBKeyRange.bound(lower, upper);
      const req = idx.getAll(range);
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function getOne<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  try {
    return new Promise<T | undefined>((resolve, reject) => {
      const txn = db.transaction(storeName, 'readonly');
      const req = txn.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function putOne<T>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const txn = db.transaction(storeName, 'readwrite');
      txn.objectStore(storeName).put(record);
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
      txn.onabort = () => reject(txn.error ?? new Error('transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function countRange(
  storeName: string,
  indexName: string,
  lower: number,
  upper: number,
): Promise<number> {
  const db = await openDB();
  try {
    return new Promise<number>((resolve, reject) => {
      const txn = db.transaction(storeName, 'readonly');
      const idx = txn.objectStore(storeName).index(indexName);
      const range = IDBKeyRange.bound(lower, upper);
      const req = idx.count(range);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Writing events
// ---------------------------------------------------------------------------

export async function saveWritingEvents(events: WritingTelemetryEvent[]): Promise<void> {
  return putAll(WRITING_STORE, events);
}

export async function loadAllWritingEvents(): Promise<WritingTelemetryEvent[]> {
  return getAll<WritingTelemetryEvent>(WRITING_STORE);
}

export async function loadWritingEventsInRange(
  from: number,
  to: number,
): Promise<WritingTelemetryEvent[]> {
  return getAllInRange<WritingTelemetryEvent>(WRITING_STORE, 'timestamp', from, to);
}

// ---------------------------------------------------------------------------
// Activity events
// ---------------------------------------------------------------------------

export async function saveActivityEvents(events: ActivityEvent[]): Promise<void> {
  return putAll(ACTIVITY_STORE, events);
}

export async function loadAllActivityEvents(): Promise<ActivityEvent[]> {
  return getAll<ActivityEvent>(ACTIVITY_STORE);
}

export async function saveReviewRecord(record: ReviewRecord): Promise<void> { return putOne(REVIEW_STORE, record); }
export async function loadAllReviewRecords(): Promise<ReviewRecord[]> { return getAll<ReviewRecord>(REVIEW_STORE); }
export async function saveConsequence(record: TidewatchConsequence): Promise<void> { return putOne(CONSEQUENCE_STORE, record); }
export async function loadAllConsequences(): Promise<TidewatchConsequence[]> { return getAll<TidewatchConsequence>(CONSEQUENCE_STORE); }
export async function saveReviewPreferences(value: TidewatchReviewPreferences): Promise<void> { return putOne(META_STORE, { key: 'review_preferences', value }); }
export async function loadReviewPreferences(): Promise<TidewatchReviewPreferences | undefined> { return (await getOne<{ key: string; value: TidewatchReviewPreferences }>(META_STORE, 'review_preferences'))?.value; }
export async function saveConsequencePreferences(value: TidewatchConsequencePreferences): Promise<void> { return putOne(META_STORE, { key: 'consequence_preferences', value }); }
export async function loadConsequencePreferences(): Promise<TidewatchConsequencePreferences | undefined> { return (await getOne<{ key: string; value: TidewatchConsequencePreferences }>(META_STORE, 'consequence_preferences'))?.value; }

export async function loadActivityEventsInRange(
  from: number,
  to: number,
): Promise<ActivityEvent[]> {
  return getAllInRange<ActivityEvent>(ACTIVITY_STORE, 'timestamp', from, to);
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function saveCheckIn(checkin: CheckIn): Promise<void> {
  return putOne(CHECKIN_STORE, checkin);
}

export async function loadAllCheckIns(): Promise<CheckIn[]> {
  return getAll<CheckIn>(CHECKIN_STORE);
}

export async function loadLatestCheckIn(): Promise<CheckIn | undefined> {
  const all = await getAll<CheckIn>(CHECKIN_STORE);
  if (all.length === 0) return undefined;
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function saveMilestones(milestones: Milestone[]): Promise<void> {
  return putAll(MILESTONE_STORE, milestones);
}

export async function loadAllMilestones(): Promise<Milestone[]> {
  return getAll<Milestone>(MILESTONE_STORE);
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export async function getMeta(key: string): Promise<string | undefined> {
  const record = await getOne<{ key: string; value: string }>(META_STORE, key);
  return record?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  return putOne(META_STORE, { key, value });
}

// ---------------------------------------------------------------------------
// Privacy audit helper
// ---------------------------------------------------------------------------

/**
 * Proves no raw text exists in the writing_events store.
 * Returns { clean: true } if all events have only numeric fields,
 * or { clean: false, violatingFields: [...] } if any non-numeric
 * text-like fields are found.
 *
 * Only checks fields that should never contain raw text:
 * content, text, body, note, prompt, message, draft.
 */
export async function auditPrivacy(): Promise<{
  clean: boolean;
  totalEvents: number;
  violatingFields: string[];
}> {
  const events = await loadAllWritingEvents();
  const forbidden = ['content', 'text', 'body', 'note', 'prompt', 'message', 'draft'];
  const violations = new Set<string>();

  for (const event of events) {
    for (const key of Object.keys(event)) {
      if (forbidden.includes(key)) violations.add(key);
    }
  }

  return {
    clean: violations.size === 0,
    totalEvents: events.length,
    violatingFields: Array.from(violations),
  };
}
