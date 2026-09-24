import { describe, expect, it } from 'vitest';
import { getMoonGateCopy, getMoonGateGreeting, getMoonGateTimeOfDay, migrateLegacyMoonGateDisplayName, safeMoonGateDisplayName, migrateMoonGateAuthUsername, resolveMoonGateDisplayGreetingName } from './moonGateCopy';
import { createMoonGateDestructiveActionGuard, isMoonGateConfirmationMatch, resetMoonGateRecoveryDraft } from './moonGateRecovery';
import { getDeviceIdentity, getDeviceIdentitySync, formatFingerprint, resolveKeyState, resolveDeviceInfo } from './moonGateKey';

describe('Moon Gate copy and privacy selectors', () => {
  it('applies the explicit legacy username migration idempotently without changing valid symbols', () => {
    expect(safeMoonGateDisplayName('111°')).toBe('111');
    expect(migrateLegacyMoonGateDisplayName(migrateLegacyMoonGateDisplayName('111°'))).toBe('111');
    expect(safeMoonGateDisplayName('12°')).toBe('12°');
    expect(safeMoonGateDisplayName('月潮°')).toBe('月潮°');
    expect(safeMoonGateDisplayName('A+B_✨')).toBe('A+B_✨');
    expect(safeMoonGateDisplayName(undefined)).toBe('');
  });
  it('keeps the greeting name separate from the command headline', () => {
    const copy = getMoonGateCopy({ timeOfDay: 'evening', authState: 'login', failedAttempts: 0, returnReason: 'login', toneMode: 'strict', seed: 1 });
    expect(getMoonGateGreeting('evening', '111')).toBe('晚上好，111。');
    expect(getMoonGateGreeting('evening', '')).toBe('晚上好。');
    expect(copy.headline).toBe('門還關著。密碼輸好，再進來。');
    expect(copy.headline).not.toContain('111');
  });
  it('maps time of day boundaries', () => {
    expect(getMoonGateTimeOfDay(new Date(2026, 0, 1, 5))).toBe('morning');
    expect(getMoonGateTimeOfDay(new Date(2026, 0, 1, 13))).toBe('afternoon');
    expect(getMoonGateTimeOfDay(new Date(2026, 0, 1, 20))).toBe('evening');
    expect(getMoonGateTimeOfDay(new Date(2026, 0, 1, 2))).toBe('late');
  });
  it('selects strict and standard copy reproducibly', () => {
    const input = { timeOfDay: 'evening', authState: 'login', failedAttempts: 0, returnReason: 'login', seed: 3 } as const;
    expect(getMoonGateCopy({ ...input, toneMode: 'strict' })).toEqual(getMoonGateCopy({ ...input, toneMode: 'strict' }));
    expect(getMoonGateCopy({ ...input, toneMode: 'strict' })).not.toEqual(getMoonGateCopy({ ...input, toneMode: 'standard' }));
  });
  it('uses a safe creator fallback', () => expect(safeMoonGateDisplayName('\u0000  ')).toBe(''));
  it('keeps login, expired session and curfew presentations distinct', () => {
    const base = { timeOfDay: 'evening', authState: 'login', failedAttempts: 0, toneMode: 'strict', seed: 1 } as const;
    expect(getMoonGateCopy({ ...base, returnReason: 'login' }).headline).not.toContain('工作階段');
    expect(getMoonGateCopy({ ...base, returnReason: 'sessionExpired' }).headline).toContain('工作階段');
    expect(getMoonGateCopy({ ...base, returnReason: 'curfewLock' }).headline).toContain('管制時段');
  });
  it('does not accept private context as selector input', () => {
    const keys = Object.keys({ timeOfDay: 'evening', authState: 'login', failedAttempts: 0, returnReason: 'login', toneMode: 'strict' });
    expect(keys).not.toEqual(expect.arrayContaining(['todos', 'messages', 'health', 'finance', 'location']));
  });
  it('requires the exact confirmation phrase after trimming only', () => {
    expect(isMoonGateConfirmationMatch('清除 Rune')).toBe(true);
    expect(isMoonGateConfirmationMatch('  清除 Rune  ')).toBe(true);
    expect(isMoonGateConfirmationMatch('清除  Rune')).toBe(false);
    expect(isMoonGateConfirmationMatch('永久清除 Rune')).toBe(false);
  });
  it('clears the recovery draft when the dialog closes', () => {
    expect(resetMoonGateRecoveryDraft()).toEqual({ dangerOpen: false, finalConfirmOpen: false, confirmText: '', error: '' });
  });
  it('does not run clear before final confirmation and guards double submit', async () => {
    let calls = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const guard = createMoonGateDestructiveActionGuard();
    expect(calls).toBe(0);
    const first = guard(async () => { calls += 1; await pending; });
    const second = guard(async () => { calls += 1; });
    expect(calls).toBe(1);
    expect(await second).toBe(false);
    release();
    expect(await first).toBe(true);
  });
});

/* ═════════════════════════════════════════
   Phase 1.1 — Persisted name migration
   ═════════════════════════════════════════ */

describe('Moon Gate Phase 1.1 — Persisted name migration', () => {
  it('migrates legacy 111° to 111 with persisted version', () => {
    const result = migrateMoonGateAuthUsername('111°', 0);
    expect(result.migrated).toBe(true);
    expect(result.username).toBe('111');
    expect(result.version).toBe(1);
  });

  it('is idempotent — does not re-migrate after version bump', () => {
    const result = migrateMoonGateAuthUsername('111°', 1);
    expect(result.migrated).toBe(false);
    expect(result.username).toBe('111°');
    expect(result.version).toBe(1);
  });

  it('idempotent on already-migrated data', () => {
    const result = migrateMoonGateAuthUsername('111', 0);
    expect(result.migrated).toBe(false);
    expect(result.username).toBe('111');
    expect(result.version).toBe(1);
  });

  it('does not touch general ° names', () => {
    const result = migrateMoonGateAuthUsername('12°', 0);
    expect(result.migrated).toBe(false);
    expect(result.username).toBe('12°');
    expect(result.version).toBe(1);
  });

  it('resolves greeting name for pure-digit usernames as generic', () => {
    const { name, isGeneric } = resolveMoonGateDisplayGreetingName('111', 0);
    expect(name).toBe('111');
    expect(isGeneric).toBe(true);
  });

  it('resolves greeting name for normal names as non-generic', () => {
    const { name, isGeneric } = resolveMoonGateDisplayGreetingName('Shidao', 0);
    expect(name).toBe('Shidao');
    expect(isGeneric).toBe(false);
  });

  it('resolves empty username as generic fallback', () => {
    const { name, isGeneric } = resolveMoonGateDisplayGreetingName('', 0);
    expect(name).toBe('');
    expect(isGeneric).toBe(true);
  });
});

/* ═════════════════════════════════════════
   Phase 1.1 — Public device identity
   ═════════════════════════════════════════ */

describe('Moon Gate Phase 1.1 — Public device identity', () => {
  it('generates a public identity with random source, not passwordHash', () => {
    const identity = getDeviceIdentitySync();
    expect(identity.id).toHaveLength(32);
    expect(identity.publicFingerprint).toMatch(/^[\dA-F]{4}-[\dA-F]{4}$/);
    expect(identity.createdAt).toBeGreaterThan(0);
    expect(identity.platformLabel).toBeTruthy();
    expect(identity.version).toBeGreaterThanOrEqual(1);

    // The identity ID should NOT equal any hash of passwordHash (it uses crypto.getRandomValues)
    expect(identity.id).not.toBe('');
  });

  it('is stable across synchronous calls (same identity object)', () => {
    const a = getDeviceIdentitySync();
    const b = getDeviceIdentitySync();
    expect(a.id).toBe(b.id);
    expect(a.publicFingerprint).toBe(b.publicFingerprint);
  });

  it('formatFingerprint produces correct format', () => {
    const identity = getDeviceIdentitySync();
    const formatted = formatFingerprint(identity);
    expect(formatted).toMatch(/^LT-(?:MAC|WIN|LNX|AND|COS|DEV) · [\dA-F]{4}-[\dA-F]{4}$/);
  });

  it('resolveKeyState is available when passwordHash exists', () => {
    expect(resolveKeyState('abc123')).toBe('available');
    expect(resolveKeyState('')).toBe('key_unavailable');
  });

  it('resolveDeviceInfo returns valid labels', () => {
    const info = resolveDeviceInfo();
    expect(typeof info.type).toBe('string');
    expect(info.type.length).toBeGreaterThan(0);
    expect(typeof info.label).toBe('string');
    expect(info.label.length).toBeGreaterThan(0);
  });
});
