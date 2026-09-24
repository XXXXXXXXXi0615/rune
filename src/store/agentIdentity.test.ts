import { describe, expect, it } from 'vitest';
import {
  AGENT_DEFAULT_AVATAR_INITIAL,
  AGENT_DEFAULT_DISPLAY_NAME,
  DEFAULT_AGENT_ID,
  SYSTEM_AGENT_NAME,
  isUntouchedLegacyLunarisIdentity,
  migratePartnerToAgent,
} from './agentIdentity';
import type { PartnerData } from '@/types';

function legacyDefault(): PartnerData {
  return {
    name: 'LUNARIS',
    displayName: 'LUNARIS',
    status: '月潮連線中',
    bio: '藍白漸變貓，負責陪伴、吐槽與整理記憶。',
    personalityNote: '',
    avatarInitial: 'L',
    avatarColor: 'char',
  };
}

describe('Agent identity — legacy migration', () => {
  it('F: untouched LUNARIS default migrates to a generic Agent identity', () => {
    const migrated = migratePartnerToAgent(legacyDefault());
    expect(migrated.id).toBe(DEFAULT_AGENT_ID);
    expect(migrated.name).toBe(SYSTEM_AGENT_NAME);
    expect(migrated.displayName).toBe(AGENT_DEFAULT_DISPLAY_NAME);
    expect(migrated.avatarInitial).toBe(AGENT_DEFAULT_AVATAR_INITIAL);
    expect(migrated.avatarImage).toBeUndefined();
  });

  it('G: a user-customized identity is preserved untouched', () => {
    const custom: PartnerData = {
      ...legacyDefault(),
      displayName: '小月',
      personalityNote: '毒舌、溫柔、克制',
      avatarImage: { storage: 'indexeddb', key: 'avatar-x', name: 'a.webp', type: 'image/webp', size: 100, updatedAt: 1 },
    };
    const migrated = migratePartnerToAgent(custom);
    expect(migrated.id).toBe(DEFAULT_AGENT_ID);
    expect(migrated.displayName).toBe('小月');
    expect(migrated.personalityNote).toBe('毒舌、溫柔、克制');
    expect(migrated.avatarImage?.key).toBe('avatar-x');
  });

  it('G: a user-named agent called "LUNARIS" survives migration (user data, not hardcode)', () => {
    const custom: PartnerData = {
      ...legacyDefault(),
      displayName: 'LUNARIS',
      personalityNote: '使用者自己取的名字',
    };
    const migrated = migratePartnerToAgent(custom);
    expect(migrated.id).toBe(DEFAULT_AGENT_ID);
    expect(migrated.displayName).toBe('LUNARIS');
    expect(migrated.personalityNote).toBe('使用者自己取的名字');
  });

  it('is idempotent — already-migrated records are never re-migrated', () => {
    const once = migratePartnerToAgent(legacyDefault());
    const twice = migratePartnerToAgent(once as PartnerData);
    expect(twice).toEqual(once);
  });

  it('is idempotent across reloads — a renamed custom agent keeps its name', () => {
    const custom = migratePartnerToAgent({ ...legacyDefault(), displayName: '月潮貓' } as PartnerData);
    // Simulate re-hydration: storage merge spreads persisted values over defaults.
    const rehydrated = migratePartnerToAgent({ ...legacyDefault(), ...custom } as PartnerData);
    expect(rehydrated.displayName).toBe('月潮貓');
    expect(rehydrated.name).toBe('LUNARIS'); // internal name stays; display name never reset
  });

  it('detects untouched defaults but not customized records', () => {
    expect(isUntouchedLegacyLunarisIdentity(legacyDefault())).toBe(true);
    expect(isUntouchedLegacyLunarisIdentity({ ...legacyDefault(), displayName: '月潮貓' })).toBe(false);
    expect(isUntouchedLegacyLunarisIdentity({ ...legacyDefault(), personalityNote: '備註' })).toBe(false);
    expect(isUntouchedLegacyLunarisIdentity({ ...legacyDefault(), avatarImage: { storage: 'indexeddb', key: 'k', name: 'a', type: 'image/png', size: 1, updatedAt: 1 } })).toBe(false);
    expect(isUntouchedLegacyLunarisIdentity({ name: 'agent', displayName: AGENT_DEFAULT_DISPLAY_NAME })).toBe(false);
  });
});

describe('Agent identity — canonical constants', () => {
  it('exposes canonical Agent naming', () => {
    expect(SYSTEM_AGENT_NAME).toBe('agent');
    expect(AGENT_DEFAULT_DISPLAY_NAME).toBe('智能體');
    expect(DEFAULT_AGENT_ID).toBe('agent-default');
  });
});
