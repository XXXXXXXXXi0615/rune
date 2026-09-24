/**
 * supabase/index.ts — Barrel export
 */

export { initSupabase, getSupabase, isSupabaseAvailable, getSupabaseError, signInAnonymously, signOut, getCurrentUserId } from './client';
export type { SupabaseCredentials } from './client';

export { enableSync, disableSync, isSyncEnabled, getSyncUserId, runFullSync, pushSoftDelete } from './sync';
export type { SyncStatus, SyncResult, FullSyncResult } from './sync';

export { SupabaseSyncProvider } from './SupabaseSyncProvider';
