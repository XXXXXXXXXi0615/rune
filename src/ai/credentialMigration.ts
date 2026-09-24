import { STORAGE_KEY } from '@/store/storage';
import {
  getCredentialStore,
  makeCredentialId,
  MIGRATION_LS_KEY,
} from './credentialStore';

export interface MigrationResult {
  phase: 'idle' | 'copy_pending' | 'durability_verified' | 'complete' | 'aborted';
  total: number;
  migrated: number;
  verified: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function readLegacyProviders(): Array<{ id: string; apiKey: string }> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state || parsed;
    const providers = state?.providers;
    if (!Array.isArray(providers)) return null;
    return providers.filter(
      (p: any) => typeof p.id === 'string' && typeof p.apiKey === 'string' && p.apiKey.length > 0,
    );
  } catch {
    return null;
  }
}

function removeLegacyApiKeysFromStore(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state = parsed?.state || parsed;
    if (Array.isArray(state?.providers)) {
      state.providers = state.providers.map((p: any) => ({
        ...p,
        apiKey: '',
        credentialId: p.credentialId || makeCredentialId(p.id),
        hasCredential: Boolean(p.apiKey && p.apiKey.length > 0),
        credentialUpdatedAt: (p.apiKey && p.apiKey.length > 0) ? Date.now() : p.credentialUpdatedAt,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {}
}

/**
 * Phase A — copy_pending:
 * 1. Read legacy apiKey from localStorage
 * 2. Write to CredentialStore
 * 3. Verify in current session
 * 4. Save pending metadata, KEEP legacy key
 */
export async function migrationPhaseA(): Promise<MigrationResult> {
  const result: MigrationResult = {
    phase: 'idle',
    total: 0,
    migrated: 0,
    verified: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const existing = localStorage.getItem(MIGRATION_LS_KEY);
    if (existing === 'v2' || existing === 'pending') {
      return result;
    }
  } catch {}

  const legacyProviders = readLegacyProviders();
  if (!legacyProviders || legacyProviders.length === 0) {
    try { localStorage.setItem(MIGRATION_LS_KEY, 'v2'); } catch {}
    return result;
  }

  result.total = legacyProviders.length;
  const store = await getCredentialStore();
  const caps = store.getCapabilities();

  if (!caps.survivesReload) {
    result.phase = 'aborted';
    result.errors.push('MemoryCredentialStore does not survive reload — migration aborted. Legacy keys preserved.');
    return result;
  }

  for (const p of legacyProviders) {
    try {
      const credentialId = makeCredentialId(p.id);
      const hasExisting = await store.hasCredential(credentialId);
      if (hasExisting) {
        result.skipped++;
        continue;
      }
      if (!p.apiKey || p.apiKey.trim().length === 0) {
        result.skipped++;
        continue;
      }

      await store.setCredential(credentialId, p.apiKey);
      const verify = await store.getCredential(credentialId);
      if (verify === p.apiKey) {
        result.migrated++;
        result.verified++;
      } else {
        throw new Error('migration_verify_failed');
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('api') && !msg.toLowerCase().includes('key')) {
        result.errors.push(`Provider ${p.id}: ${msg}`);
      }
    }
  }

  if (result.migrated > 0 && result.failed === 0) {
    try { localStorage.setItem(MIGRATION_LS_KEY, 'pending'); } catch {}
    result.phase = 'copy_pending';
    removeLegacyApiKeysFromStore();
  } else if (result.migrated === 0) {
    try { localStorage.setItem(MIGRATION_LS_KEY, 'v2'); } catch {}
    result.phase = 'complete';
  }

  return result;
}

/**
 * Phase B — durability_verified:
 * Only runs on a fresh app start (after reload/restart)
 * 1. Recreate CredentialStore
 * 2. Read secret by credentialId
 * 3. If readable → delete legacy key, mark complete
 * 4. If NOT readable → keep legacy key, mark pending
 */
export async function migrationPhaseB(): Promise<MigrationResult> {
  const result: MigrationResult = {
    phase: 'idle',
    total: 0,
    migrated: 0,
    verified: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const existing = localStorage.getItem(MIGRATION_LS_KEY);
    if (existing !== 'pending') {
      if (existing === 'v2') result.phase = 'complete';
      return result;
    }
  } catch { return result; }

  const store = await getCredentialStore();
  const caps = store.getCapabilities();

  if (!caps.survivesReload) {
    result.phase = 'aborted';
    result.errors.push('Current adapter does not survive reload. Migration pending preserved.');
    return result;
  }

  const legacyProviders = readLegacyProviders();
  if (!legacyProviders || legacyProviders.length === 0) {
    try { localStorage.setItem(MIGRATION_LS_KEY, 'v2'); } catch {}
    result.phase = 'complete';
    return result;
  }

  result.total = legacyProviders.length;
  let allVerified = true;

  for (const p of legacyProviders) {
    try {
      const credentialId = makeCredentialId(p.id);
      const stored = await store.getCredential(credentialId);
      if (stored && stored.length > 0) {
        result.verified++;
      } else {
        result.failed++;
        allVerified = false;
        result.errors.push(`Provider ${p.id}: credential not readable after reload`);
      }
    } catch (err) {
      result.failed++;
      allVerified = false;
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Provider ${p.id}: ${msg}`);
    }
  }

  if (allVerified && result.total > 0) {
    removeLegacyApiKeysFromStore();
    try { localStorage.setItem(MIGRATION_LS_KEY, 'v2'); } catch {}
    result.phase = 'durability_verified';
    result.migrated = result.verified;
  } else {
    result.phase = 'aborted';
    result.errors.push('Some credentials failed durability verification. Legacy keys preserved.');
  }

  return result;
}

/**
 * Full migration: runs both phases sequentially.
 * Called from App.tsx useEffect.
 */
export async function migrateCredentials(): Promise<MigrationResult> {
  const phaseA = await migrationPhaseA();
  if (phaseA.phase === 'copy_pending' || phaseA.phase === 'idle') {
    const phaseB = await migrationPhaseB();
    return phaseB;
  }
  return phaseA;
}
