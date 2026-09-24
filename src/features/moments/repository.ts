import { MOMENTS_SCHEMA_VERSION, normalizeMomentPost, type MomentComment, type MomentPost } from './domain';

const DB_NAME = 'lunartide-moments-v1';
const DB_VERSION = 1;
const POSTS_STORE = 'posts';
const COMMENTS_STORE = 'comments';
const META_STORE = 'meta';

interface MetaRecord { key: string; value: unknown }

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Moments transaction aborted'));
  });
}

function openMomentsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POSTS_STORE)) db.createObjectStore(POSTS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(COMMENTS_STORE)) db.createObjectStore(COMMENTS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadMoments(): Promise<{ posts: MomentPost[]; comments: MomentComment[] }> {
  const db = await openMomentsDB();
  let result: { posts: MomentPost[]; comments: MomentComment[] };
  let legacyPosts: MomentPost[] = [];
  try {
    const transaction = db.transaction([POSTS_STORE, COMMENTS_STORE, META_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const postsRequest = transaction.objectStore(POSTS_STORE).getAll() as IDBRequest<MomentPost[]>;
    const commentsRequest = transaction.objectStore(COMMENTS_STORE).getAll() as IDBRequest<MomentComment[]>;
    transaction.objectStore(META_STORE).put({ key: 'schemaVersion', value: MOMENTS_SCHEMA_VERSION } satisfies MetaRecord);
    const [posts, comments] = await Promise.all([requestResult(postsRequest), requestResult(commentsRequest)]);
    await done;
    const normalized = posts.map(normalizeMomentPost);
    legacyPosts = normalized.filter((post, index) => !('media' in posts[index]) || 'mediaIds' in posts[index]);
    result = { posts: normalized, comments };
  } finally {
    db.close();
  }
  if (legacyPosts.length) await Promise.all(legacyPosts.map(saveMomentPost));
  return result;
}

export async function saveMomentPost(post: MomentPost): Promise<void> {
  const db = await openMomentsDB();
  try {
    const transaction = db.transaction(POSTS_STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(POSTS_STORE).put(normalizeMomentPost(post));
    await done;
  } finally { db.close(); }
}

export async function saveMomentComment(post: MomentPost, comment: MomentComment): Promise<void> {
  const db = await openMomentsDB();
  try {
    const transaction = db.transaction([POSTS_STORE, COMMENTS_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(POSTS_STORE).put(normalizeMomentPost(post));
    transaction.objectStore(COMMENTS_STORE).put(comment);
    await done;
  } finally { db.close(); }
}

export async function removeMomentComment(post: MomentPost, commentId: string): Promise<void> {
  const db = await openMomentsDB();
  try {
    const transaction = db.transaction([POSTS_STORE, COMMENTS_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(POSTS_STORE).put(normalizeMomentPost(post));
    transaction.objectStore(COMMENTS_STORE).delete(commentId);
    await done;
  } finally { db.close(); }
}

export async function removeMomentPost(postId: string, commentIds: string[]): Promise<void> {
  const db = await openMomentsDB();
  try {
    const transaction = db.transaction([POSTS_STORE, COMMENTS_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(POSTS_STORE).delete(postId);
    const comments = transaction.objectStore(COMMENTS_STORE);
    commentIds.forEach((id) => comments.delete(id));
    await done;
  } finally { db.close(); }
}

export const momentsRepositoryInfo = {
  dbName: DB_NAME,
  version: DB_VERSION,
  stores: [POSTS_STORE, COMMENTS_STORE, META_STORE] as const,
};
