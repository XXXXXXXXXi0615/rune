import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCredentialStore,
  resetCredentialStore,
  makeCredentialId,
  reconcileCredential,
  disableWebFallback,
  acknowledgeWebFallback,
} from './credentialStore';

describe('CredentialStore capabilities', () => {
  beforeEach(() => {
    resetCredentialStore();
    (globalThis as any).__lunartide_cred_memory = undefined;
    localStorage.clear();
    delete (globalThis as any).Capacitor;
    disableWebFallback();
  });

  it('1. Memory adapter survivesReload = false', async () => {
    const store = await getCredentialStore();
    const caps = store.getCapabilities();
    expect(caps.persistence).toBe('memory');
    expect(caps.survivesReload).toBe(false);
    expect(caps.survivesRestart).toBe(false);
    expect(caps.secureAtRest).toBe(false);
  });

  it('2. WebFallback adapter has correct persistence tag', async () => {
    acknowledgeWebFallback();
    try {
      resetCredentialStore();
      const store = await getCredentialStore();
      const caps = store.getCapabilities();
      expect(caps.persistence).toBe('persistent-insecure');
      expect(caps.survivesReload).toBe(true);
    } finally {
      disableWebFallback();
      resetCredentialStore();
    }
  });

  it('3. Web fallback stores nothing until the explicit acknowledgement', async () => {
    const sessionOne = await getCredentialStore();
    await sessionOne.setCredential('provider:opt-in', 'sk-opt-in');
    expect(await sessionOne.getCredential('provider:opt-in')).toBe('sk-opt-in');

    resetCredentialStore();
    (globalThis as { __lunartide_cred_memory?: Map<string, string> }).__lunartide_cred_memory = undefined;
    const afterReload = await getCredentialStore();
    expect(afterReload.getCapabilities().persistence).toBe('memory');
    expect(await afterReload.getCredential('provider:opt-in')).toBeNull();
    expect(localStorage.getItem('lunartide_credential_web_fallback')).toBeNull();

    acknowledgeWebFallback();
    resetCredentialStore();
    const optedIn = await getCredentialStore();
    expect(optedIn.getCapabilities().persistence).toBe('persistent-insecure');
    await optedIn.setCredential('provider:opt-in', 'sk-opt-in');
    resetCredentialStore();
    (globalThis as { __lunartide_cred_memory?: Map<string, string> }).__lunartide_cred_memory = undefined;
    const optedInAfterReload = await getCredentialStore();
    expect(await optedInAfterReload.getCredential('provider:opt-in')).toBe('sk-opt-in');
    disableWebFallback();
  });

  it('4. Native without plugin falls back to memory', async () => {
    localStorage.setItem('lunartide_credential_store_mode', 'native');
    try {
      resetCredentialStore();
      const store = await getCredentialStore();
      const caps = store.getCapabilities();
      expect(caps.survivesReload).toBe(false);
    } finally {
      localStorage.removeItem('lunartide_credential_store_mode');
      resetCredentialStore();
    }
  });
});

describe('Memory adapter data isolation', () => {
  beforeEach(() => {
    resetCredentialStore();
    (globalThis as any).__lunartide_cred_memory = undefined;
  });

  it('4. set and get credential works', async () => {
    const store = await getCredentialStore();
    const cid = makeCredentialId('p1');
    await store.setCredential(cid, 'sk-test-abc');
    expect(await store.getCredential(cid)).toBe('sk-test-abc');
    expect(await store.hasCredential(cid)).toBe(true);
  });

  it('5. data lost after store reset', async () => {
    const s1 = await getCredentialStore();
    await s1.setCredential(makeCredentialId('p2'), 'secret');
    resetCredentialStore();
    (globalThis as any).__lunartide_cred_memory = undefined;
    const s2 = await getCredentialStore();
    expect(await s2.getCredential(makeCredentialId('p2'))).toBeNull();
  });

  it('6. delete removes credential', async () => {
    const store = await getCredentialStore();
    await store.setCredential('p:3', 'val');
    await store.deleteCredential('p:3');
    expect(await store.hasCredential('p:3')).toBe(false);
  });
});

describe('Reconciliation', () => {
  beforeEach(() => {
    resetCredentialStore();
    (globalThis as any).__lunartide_cred_memory = undefined;
  });

  it('7. hasCredential=false → missing', async () => {
    const r = await reconcileCredential('px', false);
    expect(r.hasCredential).toBe(false);
    expect(r.storageState).toBe('missing');
  });

  it('8. persisted true but store empty → missing', async () => {
    const r = await reconcileCredential('py', true, makeCredentialId('py'));
    expect(r.hasCredential).toBe(false);
    expect(r.storageState).toBe('missing');
  });

  it('9. stored credential → available', async () => {
    const store = await getCredentialStore();
    const cid = makeCredentialId('pz');
    await store.setCredential(cid, 'real');
    const r = await reconcileCredential('pz', true, cid);
    expect(r.hasCredential).toBe(true);
    expect(r.storageState).toBe('available');
  });

  it('10. persisted bool does not override store', async () => {
    const store = await getCredentialStore();
    const cid = makeCredentialId('pw');
    await store.setCredential(cid, 'actual');
    const r = await reconcileCredential('pw', false, cid);
    expect(r.hasCredential).toBe(false);
  });
});
