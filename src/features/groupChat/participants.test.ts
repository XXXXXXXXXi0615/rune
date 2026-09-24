import { describe, expect, it } from 'vitest';
import { getEffectiveGroupParticipants, groupAiModeFromLegacy, legacyReplyPolicyFromGroupAiMode, resolveSafeGroupSpeaker } from './participants';
import type { ChatIdentity, Conversation } from '@/types';

const identity = (id: string, kind: ChatIdentity['kind'], patch: Partial<ChatIdentity> = {}): ChatIdentity => ({
  id, kind, displayName: id, avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1, ...patch,
});

describe('canonical group participant resolution', () => {
  it('prefers canonical identity references and works without legacy participants', () => {
    const identities = [identity('self', 'user'), identity('agent', 'ai')];
    const conversation: Conversation = { id: 'g', title: 'g', kind: 'group', messages: [], createdAt: 1, updatedAt: 1, groupParticipants: [
      { identityId: 'agent', displayNameOverride: '群內 Agent', role: 'member', order: 1, joinedAt: 2, replyPolicy: 'mention', aiParticipationMode: 'mention-only' },
      { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
    ] };
    const result = getEffectiveGroupParticipants(conversation, identities);
    expect(result.map((item) => item.identityId)).toEqual(['self', 'agent']);
    expect(result[1].displayName).toBe('群內 Agent');
    expect(result[1].aiParticipationMode).toBe('mention-only');
  });

  it('falls back deterministically when the selected identity is archived or disallows manual speaking', () => {
    const identities = [identity('self', 'user'), identity('archived', 'ai', { archived: true }), identity('locked', 'ai', { allowManualSpeaking: false })];
    const conversation: Conversation = { id: 'g', title: 'g', kind: 'group', messages: [], createdAt: 1, updatedAt: 1, currentSpeakerParticipantId: 'archived', groupParticipants: [
      { identityId: 'archived', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'smart' },
      { identityId: 'locked', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'smart' },
      { identityId: 'self', role: 'admin', order: 2, joinedAt: 1, replyPolicy: 'smart' },
    ] };
    expect(resolveSafeGroupSpeaker(conversation, identities)?.identityId).toBe('self');
  });

  it('adapts legacy policies without losing compatibility', () => {
    expect(groupAiModeFromLegacy('director')).toBe('off');
    expect(groupAiModeFromLegacy('mention')).toBe('mention-only');
    expect(groupAiModeFromLegacy('roundtable')).toBe('automatic');
    expect(legacyReplyPolicyFromGroupAiMode('automatic')).toBe('smart');
  });
});
