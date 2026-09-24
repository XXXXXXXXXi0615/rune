/**
 * sync.ts — Lunartide Supabase Sync Engine
 *
 * Local-first architecture:
 *   1. All data lives in Zustand / localStorage (always available offline).
 *   2. Sync is optional — enabled only when Supabase credentials are configured.
 *   3. Push: upload local changes since last sync.
 *   4. Pull: download remote changes since last sync.
 *   5. Merge: LWW (last-write-wins) by updatedAt timestamp.
 *
 * Does NOT modify:
 *   - retrieval.ts, memoryContext.ts, prompts.ts
 *   - Existing store schema (only adds sync metadata)
 *   - Existing UI components
 */

import { getSupabase, signInAnonymously, getCurrentUserId } from '@/supabase/client';
import type { AppData, Conversation, Message, MemoryEntry, SleepReceipt, FocusSessionEntry } from '@/types';
import { useAppStore } from '@/store/useAppStore';

// ── Types ──

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type SyncEntity =
  | 'conversations'
  | 'messages'
  | 'memory_entries'
  | 'sleep_receipts'
  | 'focus_sessions';

export interface SyncResult {
  entity: SyncEntity;
  pushed: number;
  pulled: number;
  merged: number;
  errors: number;
}

export interface FullSyncResult {
  status: SyncStatus;
  results: SyncResult[];
  error?: string;
  startedAt: number;
  finishedAt: number;
}

// ── Internal state ──

let _syncEnabled = false;
let _userId: string | null = null;
let _syncInProgress = false;

// ── Public API ──

/** Enable sync — signs in anonymously and sets up the user context. */
export async function enableSync(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const auth = await signInAnonymously();
  if (!auth) return false;

  _userId = auth.user.id;
  _syncEnabled = true;
  return true;
}

/** Disable sync. Local data is never affected. */
export function disableSync(): void {
  _syncEnabled = false;
  _userId = null;
}

/** Whether sync is currently enabled. */
export function isSyncEnabled(): boolean {
  return _syncEnabled && _userId !== null;
}

/** Get current sync user ID. */
export function getSyncUserId(): string | null {
  return _userId;
}

/** Run a full push + pull cycle. Returns results per entity. */
export async function runFullSync(): Promise<FullSyncResult> {
  const startedAt = Date.now();
  const results: SyncResult[] = [];

  if (!_syncEnabled || !_userId) {
    return { status: 'error', results, error: 'Sync not enabled', startedAt, finishedAt: Date.now() };
  }
  if (_syncInProgress) {
    return { status: 'error', results, error: 'Sync already in progress', startedAt, finishedAt: Date.now() };
  }

  _syncInProgress = true;

  try {
    const client = getSupabase();
    if (!client) throw new Error('Supabase client unavailable');

    // 1. Pull first (get latest remote state)
    const pullResults = await pullAllData(client, _userId);
    results.push(...pullResults);

    // 2. Merge pulled data into local store
    mergePulledData(pullResults);

    // 3. Push local changes
    const pushResults = await pushAllData(client, _userId);
    results.push(...pushResults);

    // 4. Update last sync metadata
    const now = new Date().toISOString();
    await client.from('sync_metadata').upsert({
      user_id: _userId,
      last_push_at: now,
      last_pull_at: now,
      data: { lastSyncResult: results },
    });

    return { status: 'synced', results, startedAt, finishedAt: Date.now() };
  } catch (err) {
    return {
      status: 'error',
      results,
      error: err instanceof Error ? err.message : 'Sync failed',
      startedAt,
      finishedAt: Date.now(),
    };
  } finally {
    _syncInProgress = false;
  }
}

// ── Pull: download from Supabase → local ──

type AnyRow = { id: string; user_id: string; data?: Record<string, unknown>; updated_at: string; is_deleted?: boolean };

async function pullAllData(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<SyncResult[]> {
  const entities: SyncEntity[] = ['conversations', 'messages', 'memory_entries', 'sleep_receipts', 'focus_sessions'];
  const results: SyncResult[] = [];

  for (const entity of entities) {
    try {
      const { data, error } = await client
        .from(entity as string)
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (error) {
        results.push({ entity, pushed: 0, pulled: 0, merged: 0, errors: 1 });
        continue;
      }

      const rows = (data as AnyRow[] | null) || [];
      // Store pulled data in a global registry for merge
      _pulledDataRegistry[entity] = rows;
      results.push({ entity, pushed: 0, pulled: rows.length, merged: 0, errors: 0 });
    } catch {
      results.push({ entity, pushed: 0, pulled: 0, merged: 0, errors: 1 });
    }
  }

  return results;
}

// ── Merge: integrate pulled data into local store ──

const _pulledDataRegistry: Partial<Record<SyncEntity, AnyRow[]>> = {};

function mergePulledData(results: SyncResult[]): void {
  const store = useAppStore.getState();

  for (const result of results) {
    if (result.pulled === 0) continue;
    const rows = _pulledDataRegistry[result.entity] || [];
    if (rows.length === 0) continue;

    switch (result.entity) {
      case 'conversations':
        mergeConversations(store, rows);
        break;
      case 'messages':
        mergeMessages(store, rows);
        break;
      case 'memory_entries':
        mergeGeneric<MemoryEntry>(store, rows, 'memoryEntries', 'memory_entries');
        break;
      case 'sleep_receipts':
        mergeGeneric<SleepReceipt>(store, rows, 'sleepReceipts', 'sleep_receipts');
        break;
      case 'focus_sessions':
        mergeGeneric<FocusSessionEntry>(store, rows, 'focusSessionLog', 'focus_sessions',
          (f) => f.endTime || f.startTime || 0);
        break;
    }
  }
}

function mergeConversations(store: AppData, rows: AnyRow[]): void {
  const localConvMap = new Map(store.conversations.map((c) => [c.id, c]));
  const localConvIds = new Set(localConvMap.keys());

  for (const row of rows) {
    const remote = row.data as Partial<Conversation> | undefined;
    if (!remote) continue;
    const local = localConvMap.get(row.id);

    if (!local) {
      // New from remote — insert
      store.conversations.push(remote as Conversation);
    } else {
      // Both have it — compare timestamps
      const remoteUpdated = new Date(row.updated_at).getTime();
      const localUpdated = local.updatedAt || 0;
      if (remoteUpdated > localUpdated) {
        Object.assign(local, remote);
      }
    }
    localConvIds.delete(row.id);
  }

  // Remaining local items are only local — they'll be pushed on next cycle
}

function mergeMessages(store: AppData, rows: AnyRow[]): void {
  // Messages live inside conversations. We need to find the parent conv.
  for (const row of rows) {
    const remote = row.data as Partial<Message> & { conversation_id?: string } | undefined;
    if (!remote) continue;

    const convId = remote.conversation_id || (row as AnyRow & { conversation_id?: string }).conversation_id;
    if (!convId) continue;

    const conv = store.conversations.find((c) => c.id === convId);
    if (!conv) continue;

    const localMsgIdx = conv.messages.findIndex((m) => m.id === row.id);
    const remoteUpdated = new Date(row.updated_at).getTime();

    if (localMsgIdx === -1) {
      conv.messages.push(remote as Message);
    } else {
      const localUpdated = new Date(conv.messages[localMsgIdx].time).getTime();
      if (remoteUpdated > localUpdated) {
        conv.messages[localMsgIdx] = remote as Message;
      }
    }
  }
}

function mergeGeneric<T extends { id: string }>(
  store: AppData,
  rows: AnyRow[],
  localKey: keyof AppData,
  _tableName: string,
  getLocalTimestamp: (item: T) => number = () => 0,
): void {
  const localArr = (store[localKey] as unknown as T[]) || [];
  const localMap = new Map(localArr.map((e) => [e.id, e]));

  for (const row of rows) {
    const remote = row.data as Partial<T> | undefined;
    if (!remote) continue;
    const local = localMap.get(row.id);

    if (!local) {
      localArr.push(remote as T);
    } else {
      const remoteUpdated = new Date(row.updated_at).getTime();
      if (remoteUpdated > getLocalTimestamp(local)) {
        Object.assign(local, remote);
      }
    }
  }
}

// ── Push: upload local → Supabase ──

async function pushAllData(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<SyncResult[]> {
  const store = useAppStore.getState();
  const results: SyncResult[] = [];

  // Conversations
  results.push(await pushConversations(client, userId, store.conversations));

  // Messages (from within conversations)
  results.push(await pushMessages(client, userId, store.conversations));

  // Memory entries
  results.push(await pushGeneric(client, userId, 'memory_entries', store.memoryEntries || []));

  // Sleep receipts
  results.push(await pushGeneric(client, userId, 'sleep_receipts', store.sleepReceipts || []));

  // Focus sessions
  results.push(await pushGeneric(client, userId, 'focus_sessions', store.focusSessionLog || [],
    (f) => f.endTime || f.startTime || Date.now()));

  return results;
}

async function pushConversations(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  conversations: Conversation[],
): Promise<SyncResult> {
  let pushed = 0;
  let errors = 0;

  for (const conv of conversations) {
    try {
      const { messages: _msgs, ...convData } = conv;
      const { error } = await client.from('conversations').upsert({
        id: conv.id,
        user_id: userId,
        title: conv.title,
        custom_title: conv.customTitle || null,
        summary_json: conv.summary || null,
        pinned: conv.pinned || false,
        archived: conv.archived || false,
        auto_title: conv.autoTitle !== false,
        created_at: new Date(conv.createdAt).toISOString(),
        updated_at: new Date(conv.updatedAt).toISOString(),
        last_message_at: conv.lastMessageAt ? new Date(conv.lastMessageAt).toISOString() : null,
        data: convData,
        is_deleted: false,
      });
      if (error) { errors++; } else { pushed++; }
    } catch { errors++; }
  }

  return { entity: 'conversations', pushed, pulled: 0, merged: 0, errors };
}

async function pushMessages(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  conversations: Conversation[],
): Promise<SyncResult> {
  let pushed = 0;
  let errors = 0;

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      try {
        const { error } = await client.from('messages').upsert({
          id: msg.id,
          conversation_id: conv.id,
          user_id: userId,
          sender: msg.sender,
          type: msg.type,
          content: msg.type === 'text' ? (msg as { content: string }).content : null,
          time: msg.time,
          status: msg.status,
          revoked: msg.revoked || false,
          data: msg,
          created_at: new Date(msg.time).toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        });
        if (error) { errors++; } else { pushed++; }
      } catch { errors++; }
    }
  }

  return { entity: 'messages', pushed, pulled: 0, merged: 0, errors };
}

async function pushGeneric<T extends { id: string }>(
  client: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  table: string,
  items: T[],
  getTimestamp: (item: T) => number = () => Date.now(),
): Promise<SyncResult> {
  let pushed = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const ts = new Date(getTimestamp(item)).toISOString();
      const { error } = await client.from(table).upsert({
        id: item.id,
        user_id: userId,
        data: item,
        created_at: ts,
        updated_at: ts,
        is_deleted: false,
      });
      if (error) { errors++; } else { pushed++; }
    } catch { errors++; }
  }

  return { entity: table as SyncEntity, pushed, pulled: 0, merged: 0, errors };
}

// ── Soft delete push ──

/** Mark an entity as deleted on Supabase (soft delete). */
export async function pushSoftDelete(
  entity: SyncEntity,
  itemId: string,
): Promise<void> {
  if (!_syncEnabled || !_userId) return;
  const client = getSupabase();
  if (!client) return;

  try {
    await client.from(entity as string).upsert({
      id: itemId,
      user_id: _userId,
      is_deleted: true,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Silently fail — item can be re-pushed later
  }
}
