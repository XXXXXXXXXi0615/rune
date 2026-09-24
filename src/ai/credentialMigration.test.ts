import { describe, it, expect, beforeEach } from 'vitest';
import { migrationPhaseA, migrationPhaseB } from './credentialMigration';
import { resetCredentialStore, MIGRATION_LS_KEY, acknowledgeWebFallback, disableWebFallback } from './credentialStore';
import { STORAGE_KEY } from '@/store/storage';

function writeLegacy(providers: Array<{ id: string; apiKey: string }>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    state: {
      auth: { authEnabled: false },
      providers,
      memoryEntries: [],
      activityLogs: [],
    },
    version: 0,
  }));
}

describe('Credential Migration', () => {
  beforeEach(() => {
    resetCredentialStore();
    (globalThis as any).__lunartide_cred_memory = undefined;
    delete (globalThis as any).Capacitor;
    localStorage.clear();
    acknowledgeWebFallback();
  });

  it('1. Phase A copies keys, marks pending, clears apiKey from store', async () => {
    writeLegacy([
      { id: 'p1', apiKey: 'sk-old-abc' },
      { id: 'p2', apiKey: 'sk-old-def' },
    ]);

    const result = await migrationPhaseA();
    expect(result.phase).toBe('copy_pending');
    expect(result.migrated).toBe(2);

    const legacyRaw = localStorage.getItem(STORAGE_KEY)!;
    const legacy = JSON.parse(legacyRaw);
    for (const p of legacy.state.providers) {
      expect(p.apiKey).toBe('');
      expect(p.hasCredential).toBe(true);
    }

    expect(localStorage.getItem(MIGRATION_LS_KEY)).toBe('pending');
  });

  it('2. Memory adapter aborts migration, preserves legacy key', async () => {
    disableWebFallback();
    writeLegacy([{ id: 'mx', apiKey: 'sk-critical' }]);

    const result = await migrationPhaseA();
    expect(result.phase).toBe('aborted');

    const legacyRaw = localStorage.getItem(STORAGE_KEY)!;
    expect(legacyRaw).toContain('sk-critical');
  });

  it('3. Phase B verifies and marks complete', async () => {
    localStorage.setItem(MIGRATION_LS_KEY, 'pending');
    writeLegacy([{ id: 'pb', apiKey: 'sk-verified' }]);

    const store = await (await import('./credentialStore')).getCredentialStore();
    await store.setCredential('provider:pb', 'sk-verified');

    const result = await migrationPhaseB();
    expect(result.phase).toBe('durability_verified');

    expect(localStorage.getItem(MIGRATION_LS_KEY)).toBe('v2');
  });

  it('4. Phase B missing credential preserves legacy', async () => {
    localStorage.setItem(MIGRATION_LS_KEY, 'pending');
    writeLegacy([{ id: 'pc', apiKey: 'sk-legacy-safe' }]);

    const result = await migrationPhaseB();
    expect(result.phase).toBe('aborted');

    const legacyRaw = localStorage.getItem(STORAGE_KEY)!;
    expect(legacyRaw).toContain('sk-legacy-safe');
  });

  it('5. Migration is idempotent', async () => {
    writeLegacy([{ id: 'pi', apiKey: 'sk-idem' }]);
    const r1 = await migrationPhaseA();
    expect(r1.phase).toBe('copy_pending');

    const r2 = await migrationPhaseA();
    expect(r2.total).toBe(0);
  });

  it('6. Phase B skips when already v2', async () => {
    localStorage.setItem(MIGRATION_LS_KEY, 'v2');
    writeLegacy([{ id: 'pd', apiKey: 'sk-done' }]);
    const result = await migrationPhaseB();
    expect(result.phase).toBe('complete');
  });
});
