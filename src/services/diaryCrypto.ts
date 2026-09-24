export type DiaryAutoLock = 'leave' | '5m' | '15m' | 'browser' | 'never';

export interface DiaryLockConfig {
  version: 1;
  enabled: boolean;
  salt: string;
  verifier: string;
  recoverySalt: string;
  recoveryVerifier: string;
  hint?: string;
  autoLock: DiaryAutoLock;
  createdAt: string;
}

const CONFIG_KEY = 'lunartide_diary_lock_v1';
const SESSION_KEY = 'lunartide_diary_unlocked_v1';
const ITERATIONS = 180_000;

function toBase64(bytes: Uint8Array): string {
  let value = '';
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveVerifier(secret: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS },
    material,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

function createRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').match(/.{1,6}/g)?.join('-') || '';
}

export function getDiaryLockConfig(): DiaryLockConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DiaryLockConfig>;
    if (parsed.version !== 1 || !parsed.salt || !parsed.verifier) return null;
    return {
      version: 1,
      enabled: parsed.enabled === true,
      salt: parsed.salt,
      verifier: parsed.verifier,
      recoverySalt: parsed.recoverySalt || '',
      recoveryVerifier: parsed.recoveryVerifier || '',
      hint: typeof parsed.hint === 'string' ? parsed.hint : undefined,
      autoLock: ['leave', '5m', '15m', 'browser', 'never'].includes(parsed.autoLock || '')
        ? parsed.autoLock as DiaryAutoLock
        : 'browser',
      createdAt: parsed.createdAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function createDiaryLock(password: string, hint: string, autoLock: DiaryAutoLock) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryKey = createRecoveryKey();
  const config: DiaryLockConfig = {
    version: 1,
    enabled: true,
    salt: toBase64(salt),
    verifier: await deriveVerifier(password, salt),
    recoverySalt: toBase64(recoverySalt),
    recoveryVerifier: await deriveVerifier(recoveryKey, recoverySalt),
    hint: hint.trim() || undefined,
    autoLock,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  markDiaryUnlocked();
  return { config, recoveryKey };
}

export async function verifyDiaryPassword(password: string): Promise<boolean> {
  const config = getDiaryLockConfig();
  if (!config?.enabled) return true;
  const verifier = await deriveVerifier(password, fromBase64(config.salt));
  return verifier === config.verifier;
}

export async function verifyDiaryRecoveryKey(recoveryKey: string): Promise<boolean> {
  const config = getDiaryLockConfig();
  if (!config?.recoverySalt || !config.recoveryVerifier) return false;
  const verifier = await deriveVerifier(recoveryKey.trim(), fromBase64(config.recoverySalt));
  return verifier === config.recoveryVerifier;
}

export function updateDiaryLockPreferences(patch: Pick<DiaryLockConfig, 'autoLock' | 'hint'>) {
  const current = getDiaryLockConfig();
  if (!current) return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...patch }));
}

export function disableDiaryLock() {
  localStorage.removeItem(CONFIG_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function markDiaryUnlocked() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ unlockedAt: Date.now(), lastActiveAt: Date.now() }));
}

export function touchDiaryUnlockSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as { unlockedAt?: number; lastActiveAt?: number };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActiveAt: Date.now() }));
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function lockDiary() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isDiaryUnlocked(): boolean {
  const config = getDiaryLockConfig();
  if (!config?.enabled) return true;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as { lastActiveAt?: number };
    const elapsed = Date.now() - Number(session.lastActiveAt || 0);
    if (config.autoLock === '5m' && elapsed > 5 * 60_000) return false;
    if (config.autoLock === '15m' && elapsed > 15 * 60_000) return false;
    return true;
  } catch {
    return false;
  }
}
