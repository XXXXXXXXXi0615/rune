export type CredentialPersistence =
  | 'memory'
  | 'session'
  | 'persistent-secure'
  | 'persistent-insecure';

export interface CredentialStoreCapabilities {
  persistence: CredentialPersistence;
  survivesReload: boolean;
  survivesRestart: boolean;
  secureAtRest: boolean;
}

export interface CredentialStore {
  setCredential(credentialId: string, secret: string): Promise<void>;
  getCredential(credentialId: string): Promise<string | null>;
  deleteCredential(credentialId: string): Promise<void>;
  hasCredential(credentialId: string): Promise<boolean>;
  listCredentialIds(): Promise<string[]>;
  getCapabilities(): CredentialStoreCapabilities;
}

export type CredentialStorageState =
  | 'available'
  | 'missing'
  | 'locked'
  | 'unsupported'
  | 'migration_pending'
  | 'error';

export interface CredentialReconciliation {
  credentialId: string | null;
  hasCredential: boolean;
  storageState: CredentialStorageState;
  uiLabel: string;
}

const isCapacitor = typeof (window as any)?.Capacitor !== 'undefined';

const STORE_MODE_KEY = 'lunartide_credential_store_mode';

async function getStoreMode(): Promise<'native' | 'memory' | 'web-fallback'> {
  if (isCapacitor) {
    try {
      const stored = localStorage.getItem(STORE_MODE_KEY);
      if (stored === 'native') return 'native';
    } catch { /* quota */ }
  }
  try {
    if (localStorage.getItem('lunartide_credential_web_fallback_ack') === 'true') {
      return 'web-fallback';
    }
  } catch { /* quota */ }
  return 'memory';
}

export function acknowledgeWebFallback(): void {
  try { localStorage.setItem('lunartide_credential_web_fallback_ack', 'true'); } catch {}
}

export function hasAcknowledgedWebFallback(): boolean {
  try { return localStorage.getItem('lunartide_credential_web_fallback_ack') === 'true'; } catch { return false; }
}

export function disableWebFallback(): void {
  try { localStorage.removeItem('lunartide_credential_web_fallback_ack'); } catch {}
}

function memoryStore(): Map<string, string> {
  if (!(globalThis as any).__lunartide_cred_memory) {
    (globalThis as any).__lunartide_cred_memory = new Map<string, string>();
  }
  return (globalThis as any).__lunartide_cred_memory;
}

const MEMORY_CAPABILITIES: CredentialStoreCapabilities = {
  persistence: 'memory',
  survivesReload: false,
  survivesRestart: false,
  secureAtRest: false,
};

class MemoryCredentialStore implements CredentialStore {
  getCapabilities(): CredentialStoreCapabilities { return MEMORY_CAPABILITIES; }
  async setCredential(credentialId: string, secret: string): Promise<void> {
    memoryStore().set(credentialId, secret);
  }
  async getCredential(credentialId: string): Promise<string | null> {
    return memoryStore().get(credentialId) ?? null;
  }
  async deleteCredential(credentialId: string): Promise<void> {
    memoryStore().delete(credentialId);
  }
  async hasCredential(credentialId: string): Promise<boolean> {
    return memoryStore().has(credentialId);
  }
  async listCredentialIds(): Promise<string[]> {
    return Array.from(memoryStore().keys());
  }
}

const NATIVE_CAPABILITIES: CredentialStoreCapabilities = {
  persistence: 'persistent-secure',
  survivesReload: true,
  survivesRestart: true,
  secureAtRest: true,
};

export function isNativeCredentialAvailable(): boolean {
  if (typeof (window as any).Capacitor === 'undefined') return false;
  try {
    const plugins = (window as any).Capacitor?.Plugins;
    return Boolean(plugins?.SecureStoragePlugin);
  } catch {
    return false;
  }
}

class NativeCredentialStore implements CredentialStore {
  private nativeAvailable = false;
  constructor() {
    this.nativeAvailable = isNativeCredentialAvailable();
  }
  getCapabilities(): CredentialStoreCapabilities {
    if (!this.nativeAvailable) return { ...MEMORY_CAPABILITIES };
    return NATIVE_CAPABILITIES;
  }
  async setCredential(credentialId: string, secret: string): Promise<void> {
    if (!this.nativeAvailable) {
      throw new Error('Secure Storage unavailable: Native Keychain plugin not found');
    }
    const plugin = (window as any).Capacitor?.Plugins?.SecureStoragePlugin;
    await plugin.set({ key: `lunartide_cred_${credentialId}`, value: secret });
  }
  async getCredential(credentialId: string): Promise<string | null> {
    if (!this.nativeAvailable) return null;
    try {
      const plugin = (window as any).Capacitor?.Plugins?.SecureStoragePlugin;
      const result = await plugin.get({ key: `lunartide_cred_${credentialId}` });
      return (result as any).value ?? null;
    } catch {
      return null;
    }
  }
  async deleteCredential(credentialId: string): Promise<void> {
    if (!this.nativeAvailable) return;
    const plugin = (window as any).Capacitor?.Plugins?.SecureStoragePlugin;
    await plugin.remove({ key: `lunartide_cred_${credentialId}` });
  }
  async hasCredential(credentialId: string): Promise<boolean> {
    const val = await this.getCredential(credentialId);
    return val !== null && val.length > 0;
  }
  async listCredentialIds(): Promise<string[]> {
    if (!this.nativeAvailable) return [];
    try {
      const plugin = (window as any).Capacitor?.Plugins?.SecureStoragePlugin;
      const result = await plugin.keys();
      return ((result as any)?.value || []).filter((k: string) => k.startsWith('lunartide_cred_'));
    } catch {
      return [];
    }
  }
}

let _store: CredentialStore | null = null;

const WEB_FALLBACK_KEY = 'lunartide_credential_web_fallback';

const WEB_FALLBACK_CAPABILITIES: CredentialStoreCapabilities = {
  persistence: 'persistent-insecure',
  survivesReload: true,
  survivesRestart: true,
  secureAtRest: false,
};

class WebFallbackCredentialStore implements CredentialStore {
  private readStore(): Record<string, string> {
    try {
      const raw = localStorage.getItem(WEB_FALLBACK_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }
  private writeStore(data: Record<string, string>): void {
    try { localStorage.setItem(WEB_FALLBACK_KEY, JSON.stringify(data)); } catch {}
  }
  getCapabilities(): CredentialStoreCapabilities { return WEB_FALLBACK_CAPABILITIES; }
  async setCredential(credentialId: string, secret: string): Promise<void> {
    const data = this.readStore();
    data[credentialId] = secret;
    this.writeStore(data);
  }
  async getCredential(credentialId: string): Promise<string | null> {
    const data = this.readStore();
    return data[credentialId] ?? null;
  }
  async deleteCredential(credentialId: string): Promise<void> {
    const data = this.readStore();
    delete data[credentialId];
    this.writeStore(data);
  }
  async hasCredential(credentialId: string): Promise<boolean> {
    const data = this.readStore();
    return credentialId in data && data[credentialId].length > 0;
  }
  async listCredentialIds(): Promise<string[]> {
    const data = this.readStore();
    return Object.keys(data).filter((k) => data[k].length > 0);
  }
}

export async function getCredentialStore(): Promise<CredentialStore> {
  if (_store) return _store;
  const mode = await getStoreMode();
  if (mode === 'native' && isNativeCredentialAvailable()) {
    _store = new NativeCredentialStore();
  } else if (mode === 'web-fallback') {
    _store = new WebFallbackCredentialStore();
  } else {
    _store = new MemoryCredentialStore();
  }
  return _store;
}

export function resetCredentialStore(): void {
  _store = null;
}

export function makeCredentialId(providerId: string): string {
  return `provider:${providerId}`;
}

export const MIGRATION_LS_KEY = 'lunartide_credential_migration_v2';

export function storageStateLabel(state: CredentialStorageState): string {
  switch (state) {
    case 'available': return '已保存且可用';
    case 'missing': return '需要重新輸入憑證';
    case 'locked': return '憑證儲存暫時無法存取';
    case 'unsupported': return '憑證儲存不可用';
    case 'migration_pending': return '憑證遷移尚未完成';
    case 'error': return '憑證讀取失敗';
  }
}

export async function reconcileCredential(
  providerId: string,
  persistedHasCredential: boolean,
  persistedCredentialId?: string,
): Promise<CredentialReconciliation> {
  const credentialId = persistedCredentialId || makeCredentialId(providerId);
  if (!persistedHasCredential) {
    return { credentialId, hasCredential: false, storageState: 'missing', uiLabel: '需要重新輸入憑證' };
  }

  const store = await getCredentialStore();
  const caps = store.getCapabilities();

  try {
    const stored = await store.getCredential(credentialId);
    if (stored && stored.length > 0) {
      return { credentialId, hasCredential: true, storageState: 'available', uiLabel: '已保存且可用' };
    }
  } catch {
    return { credentialId, hasCredential: false, storageState: 'error', uiLabel: '憑證讀取失敗' };
  }

  try {
    const hasMigrationPending = localStorage.getItem(MIGRATION_LS_KEY);
    if (hasMigrationPending === 'pending') {
      return { credentialId, hasCredential: false, storageState: 'migration_pending', uiLabel: '憑證遷移尚未完成' };
    }
  } catch {}

  if (!caps.survivesReload) {
    return { credentialId, hasCredential: false, storageState: 'missing', uiLabel: '本次工作階段可用，重新載入後需重新輸入' };
  }

  try {
    if (localStorage.getItem('lunartide_credential_web_fallback_ack') !== 'true' && caps.persistence === 'persistent-insecure') {
      return { credentialId, hasCredential: false, storageState: 'missing', uiLabel: '需要重新輸入憑證' };
    }
  } catch {}

  return { credentialId, hasCredential: false, storageState: 'missing', uiLabel: '需要重新輸入憑證' };
}
