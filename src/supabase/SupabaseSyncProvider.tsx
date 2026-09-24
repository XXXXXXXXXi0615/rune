/**
 * SupabaseSyncProvider.tsx — Silent sync lifecycle manager
 *
 * Runs in the background:
 *   - Auto-signs in anonymously on mount (if Supabase is configured).
 *   - Sets up periodic sync every 5 minutes.
 *   - Listens for online/offline events to trigger sync on reconnect.
 *
 * Does NOT render any UI. Pure infrastructure component.
 */

import { useEffect, useRef } from 'react';
import { isSupabaseAvailable, signInAnonymously } from '@/supabase/client';
import { enableSync, runFullSync, isSyncEnabled } from '@/supabase/sync';
import { useAppStore } from '@/store/useAppStore';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function SupabaseSyncProvider({ children }: { children: React.ReactNode }) {
  const initAttempted = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      if (!isSupabaseAvailable()) return;

      const signedIn = await signInAnonymously();
      if (!signedIn) return;

      await enableSync();

      // Initial sync
      try {
        const store = useAppStore.getState();
        store.setSyncStatus('syncing');
        const result = await runFullSync();
        store.setSyncStatus(result.status === 'synced' ? 'synced' : 'error');
      } catch {
        useAppStore.getState().setSyncStatus('error');
      }
    };

    init();

    // Periodic sync
    intervalRef.current = setInterval(async () => {
      if (!isSyncEnabled()) return;
      try {
        useAppStore.getState().setSyncStatus('syncing');
        const result = await runFullSync();
        useAppStore.getState().setSyncStatus(result.status === 'synced' ? 'synced' : 'error');
      } catch {
        useAppStore.getState().setSyncStatus('error');
      }
    }, SYNC_INTERVAL_MS);

    // Online/offline listeners
    const handleOnline = () => {
      if (!isSyncEnabled()) return;
      useAppStore.getState().setSyncStatus('syncing');
      runFullSync().then((result) => {
        useAppStore.getState().setSyncStatus(result.status === 'synced' ? 'synced' : 'error');
      }).catch(() => {
        useAppStore.getState().setSyncStatus('error');
      });
    };
    const handleOffline = () => {
      useAppStore.getState().setSyncStatus('local');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return <>{children}</>;
}
