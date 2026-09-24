import type { MoonGateDeviceIdentity, MoonGateKeyState } from '@/types';

const CURRENT_VERSION = 1;
const MOON_GATE_IDENTITY_KEY = 'lunartide_mg_identity_v1';

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Compute a 32-bit public fingerprint from the identity id.
 *  Uses a deterministic non-cryptographic 32-bit hash of the identity id.
 *  Same id always produces same fingerprint. Not a secret, not a cryptographic key.
 *  Cannot be used for decryption or verification. */
function deriveFingerprintSync(id: string): string {
  let result = 0;
  for (let i = 0; i < id.length; i++) {
    result = ((result << 5) - result + id.charCodeAt(i)) | 0;
  }
  const hex = ((result >>> 0).toString(16).padStart(8, '0')).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function resolveDeviceType(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform
    || '';
  if (/Mac|iPhone|iPad|iPod/.test(platform) || /Mac/.test(ua)) return 'Mac';
  if (/Win/.test(platform) || /Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(platform) || /Linux/.test(ua)) return 'Linux';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return platform || 'Unknown';
}

function resolveDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const type = resolveDeviceType();
  const ua = navigator.userAgent;
  if (type === 'Mac') {
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    return 'Mac';
  }
  if (type === 'Windows') return 'Windows PC';
  if (type === 'Linux') return 'Linux';
  if (type === 'Android') return 'Android';
  if (type === 'ChromeOS') return 'Chromebook';
  return type;
}

function readPersistedIdentity(): MoonGateDeviceIdentity | null {
  try {
    const raw = localStorage.getItem(MOON_GATE_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.id === 'string' && parsed.id.length >= 32
      && typeof parsed?.publicFingerprint === 'string' && parsed.publicFingerprint.length >= 8
      && typeof parsed?.createdAt === 'number'
      && typeof parsed?.platformLabel === 'string'
      && typeof parsed?.version === 'number'
    ) {
      return parsed as MoonGateDeviceIdentity;
    }
  } catch { /* corrupted */ }
  return null;
}

function persistIdentity(identity: MoonGateDeviceIdentity): void {
  try {
    localStorage.setItem(MOON_GATE_IDENTITY_KEY, JSON.stringify(identity));
  } catch { /* storage unavailable */ }
}

function generateIdentity(): MoonGateDeviceIdentity {
  const id = randomHex(32);
  const publicFingerprint = deriveFingerprintSync(id);
  const platformLabel = resolveDeviceType();
  const identity: MoonGateDeviceIdentity = {
    id,
    publicFingerprint,
    createdAt: Date.now(),
    platformLabel,
    version: CURRENT_VERSION,
  };
  persistIdentity(identity);
  return identity;
}

/** Returns the public device identity. Generated once with crypto.getRandomValues(),
 *  persisted in its own localStorage key. Does NOT depend on passwordHash. */
export function getDeviceIdentity(): MoonGateDeviceIdentity {
  const persisted = readPersistedIdentity();
  if (persisted && persisted.version >= CURRENT_VERSION) return persisted;
  return generateIdentity();
}

/** Synchronous alias for use in React components. */
export function getDeviceIdentitySync(): MoonGateDeviceIdentity {
  return getDeviceIdentity();
}

/** Delete the persisted identity. Called during destructive reset. */
export function deleteDeviceIdentity(): void {
  try {
    localStorage.removeItem(MOON_GATE_IDENTITY_KEY);
  } catch { /* unavailable */ }
}

export function formatFingerprint(identity: MoonGateDeviceIdentity | null): string {
  if (!identity) return '---- ----';
  const platformPrefix =
    identity.platformLabel === 'Mac' ? 'MAC'
    : identity.platformLabel === 'Windows' ? 'WIN'
    : identity.platformLabel === 'Linux' ? 'LNX'
    : identity.platformLabel === 'Android' ? 'AND'
    : identity.platformLabel === 'ChromeOS' ? 'COS'
    : 'DEV';
  return `LT-${platformPrefix} · ${identity.publicFingerprint}`;
}

export function resolveKeyState(passwordHash: string): MoonGateKeyState {
  if (!passwordHash) return 'key_unavailable';
  return 'available';
}

export function resolveDeviceInfo(): { type: string; label: string } {
  return { type: resolveDeviceType(), label: resolveDeviceLabel() };
}
