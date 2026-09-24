import { describe, expect, it } from 'vitest';
import {
  ACCESS_STRING_CHARS,
  ACCESS_STRING_LENGTH,
  RUNE_INVITATION_CODE,
  generateAccessString,
  isValidInvitationCode,
} from './runeLogin';

describe('generateAccessString', () => {
  it('produces the configured length', () => {
    expect(generateAccessString()).toHaveLength(ACCESS_STRING_LENGTH);
  });

  it('only uses ambiguity-safe characters', () => {
    const allowed = new Set(ACCESS_STRING_CHARS);
    for (let index = 0; index < 20; index += 1) {
      const value = generateAccessString();
      for (const char of value) {
        expect(allowed.has(char)).toBe(true);
      }
    }
  });

  it('excludes ambiguous characters (0 O 1 l I)', () => {
    for (let index = 0; index < 50; index += 1) {
      const value = generateAccessString();
      expect(value).not.toMatch(/[0O1lI]/);
    }
  });

  it('generates distinct values across a small batch', () => {
    const generated = new Set(Array.from({ length: 32 }, () => generateAccessString()));
    expect(generated.size).toBe(32);
  });
});

describe('isValidInvitationCode', () => {
  it('accepts the canonical code case-insensitively and trimmed', () => {
    expect(isValidInvitationCode(RUNE_INVITATION_CODE)).toBe(true);
    expect(isValidInvitationCode(RUNE_INVITATION_CODE.toLowerCase())).toBe(true);
    expect(isValidInvitationCode(`  ${RUNE_INVITATION_CODE}  `)).toBe(true);
  });

  it('rejects wrong or empty values', () => {
    expect(isValidInvitationCode('WRONG')).toBe(false);
    expect(isValidInvitationCode('')).toBe(false);
    expect(isValidInvitationCode(' ')).toBe(false);
  });
});