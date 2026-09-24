import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation, GroupParticipant, ParticipantPresence, SenderSnapshot } from '@/types';
import { resolveEffectiveParticipantProfile, resolveGroupStatus, resolveParticipantPresence } from './messageIdentity';

const identity: ChatIdentity = {
  id: 'luna', kind: 'ai', displayName: 'LUNARIS', avatarVariants: [{ id: 'default', assetId: 'base-asset', label: '預設', cropX: 50, cropY: 50, zoom: 1 }], defaultAvatarVariantId: 'default', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1,
};

describe('message identity resolution', () => {
  it('prefers group custom asset over avatar variant', () => {
    const participant = { identityId: 'luna', customAvatarAssetId: 'group-asset', avatarVariantOverrideId: 'default' } as GroupParticipant;
    expect(resolveEffectiveParticipantProfile(identity, participant)?.avatarAssetId).toBe('group-asset');
  });

  it('falls back to the selected identity variant', () => {
    expect(resolveEffectiveParticipantProfile(identity, { identityId: 'luna' } as GroupParticipant)?.avatarAssetId).toBe('base-asset');
  });

  it('does not mutate a historical sender snapshot', () => {
    const snapshot: SenderSnapshot = { identityId: 'luna', displayName: 'Old Luna', avatarAssetId: 'old-asset', fallbackSeed: 'luna', kind: 'ai' };
    resolveEffectiveParticipantProfile({ ...identity, displayName: 'New Luna' }, { identityId: 'luna', customAvatarAssetId: 'new-asset' } as GroupParticipant);
    expect(snapshot).toEqual({ identityId: 'luna', displayName: 'Old Luna', avatarAssetId: 'old-asset', fallbackSeed: 'luna', kind: 'ai' });
  });
});

describe('group status and presence', () => {
  it('uses custom status before expiry and auto status after expiry', () => {
    const conversation = { statusConfig: { mode: 'custom', customText: '潮聲很近', expiresAt: 200, updatedAt: 1 } } as Conversation;
    expect(resolveGroupStatus(conversation, 100).text).toBe('潮聲很近');
    expect(resolveGroupStatus(conversation, 201).mode).toBe('auto');
  });

  it.each(['online', 'away', 'busy', 'offline', 'invisible'] as const)('supports %s presence', (state) => {
    const automatic = { visiblePresenceStatus: 'online', status: 'online' } as ParticipantPresence;
    const resolved = resolveParticipantPresence({ identityId: 'luna', presenceOverride: { mode: 'manual', state } } as GroupParticipant, automatic);
    expect(resolved.state).toBe(state === 'invisible' ? 'offline' : state);
  });
});
