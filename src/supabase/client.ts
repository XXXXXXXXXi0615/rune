/**
 * client.ts — Supabase client singleton
 *
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.
 * Returns null when not configured — sync is disabled until credentials are provided.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let configError: string | null = null;

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * Initialize (or re-initialize) the Supabase client with given credentials.
 * Pass empty strings to disable sync.
 */
export function initSupabase(credentials: Partial<SupabaseCredentials>): SupabaseClient | null {
  const url = (credentials.url || '').trim();
  const anonKey = (credentials.anonKey || '').trim();

  if (!url || !anonKey) {
    supabase = null;
    configError = 'Supabase URL or anon key not configured';
    return null;
  }

  try {
    supabase = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    configError = null;
    return supabase;
  } catch (err) {
    supabase = null;
    configError = err instanceof Error ? err.message : 'Failed to initialize Supabase';
    return null;
  }
}

/** Get the current client instance. Returns null if not configured. */
export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  // Lazy-init from env vars on first call
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (url && anonKey) {
    return initSupabase({ url, anonKey });
  }

  configError = 'Supabase not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)';
  return null;
}

/** Check if Supabase is configured and available. */
export function isSupabaseAvailable(): boolean {
  return getSupabase() !== null;
}

/** Get the last configuration error message (for diagnostics). */
export function getSupabaseError(): string | null {
  return configError;
}

/** Sign in anonymously for local-first sync. Returns user or null. */
export async function signInAnonymously(): Promise<{ user: { id: string } } | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) {
      configError = `Anonymous sign-in failed: ${error.message}`;
      return null;
    }
    return data.user ? { user: { id: data.user.id } } : null;
  } catch (err) {
    configError = err instanceof Error ? err.message : 'Anonymous sign-in failed';
    return null;
  }
}

/** Sign out current user. Local data is preserved. */
export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  try {
    await client.auth.signOut();
  } catch {
    // Ignore errors — local data is always safe
  }
}

/** Get current user ID. Returns null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data } = await client.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Auto-init from env vars on module load
const _autoInit = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) initSupabase({ url, anonKey });
})();
void _autoInit;
