import { type ReactNode } from 'react';
import { SupabaseSyncProvider } from '@/supabase';
import { useAppTheme } from '@/hooks/useAppTheme';
import '@/pages/ObjectMemoryPage.css';

export function ObjectsLayout({ children }: { children: ReactNode }) {
  useAppTheme();

  return (
    <>
      <div id="bg-layer" />
      <div id="objects-root" className="objects-layout">
        <main className="objects-layout-main">
          <SupabaseSyncProvider>
            {children}
          </SupabaseSyncProvider>
        </main>
      </div>
    </>
  );
}
