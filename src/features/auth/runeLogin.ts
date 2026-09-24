/**
 * Rune Login Gate — core credential primitives.
 *
 * First-run flow:
 *   1. User submits the Invitation Code once.
 *   2. Rune generates a random Access String (cryptographically secure).
 *   3. The Access String becomes the device credential (hash = passwordHash).
 *
 * Returning flow: the Access String is the only credential shown.
 */

export const RUNE_INVITATION_CODE = 'LUNARIDE';

export const ACCESS_STRING_LENGTH = 20;

/** Ambiguity-safe charset: no 0/O, 1/l/I pairs. */
export const ACCESS_STRING_CHARS = (() => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  return `${upper}${lower}${digits}`;
})();

export function generateAccessString(): string {
  const bytes = new Uint8Array(ACCESS_STRING_LENGTH);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    throw new Error('crypto.getRandomValues is unavailable');
  }
  let result = '';
  for (let index = 0; index < bytes.length; index += 1) {
    result += ACCESS_STRING_CHARS[bytes[index]! % ACCESS_STRING_CHARS.length];
  }
  return result;
}

export function isValidInvitationCode(value: string): boolean {
  return value.trim().toUpperCase() === RUNE_INVITATION_CODE;
}