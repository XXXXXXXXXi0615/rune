import { describe, expect, it } from 'vitest';
import { selectGroupResponders } from '@/utils/groupReplyPolicy';
import type { ChatIdentity, ChatParticipant, Conversation, PresenceStatus } from '@/types';

const participants: ChatParticipant[] = [
  { id: 'self', name: '理', controlMode: 'user', isSelf: true },
  { id: 'lunaris', name: 'LUNARIS', controlMode: 'auto' },
  { id: 'clawd', name: 'CLAWD', controlMode: 'auto' },
  { id: 'custom', name: '星野', controlMode: 'paused' },
];
const online: Record<string, PresenceStatus> = { self: 'online', lunaris: 'online', clawd: 'online', custom: 'online' };

describe('group reply policy', () => {
  it('mention and director only select the named available member', () => {
    for (const policy of ['mention', 'director'] as const) {
      expect(selectGroupResponders({ participants, speakerParticipantId: 'self', text: '@LUNARIS 你怎麼看', policy, messageCount: 0, presenceByParticipantId: online }).map((item) => item.id)).toEqual(['lunaris']);
      expect(selectGroupResponders({ participants, speakerParticipantId: 'self', text: '沒有點名', policy, messageCount: 0, presenceByParticipantId: online })).toEqual([]);
    }
  });

  it('smart deterministically selects one and excludes controlled, paused and offline members', () => {
    const controlled = participants.map((participant) => participant.id === 'lunaris' ? { ...participant, controlMode: 'user' as const } : participant);
    expect(selectGroupResponders({ participants: controlled, speakerParticipantId: 'self', text: '請回應', policy: 'smart', messageCount: 0, presenceByParticipantId: { ...online, custom: 'offline' } }).map((item) => item.id)).toEqual(['clawd']);
  });

  it('roundtable selects one available member by stable order', () => {
    expect(selectGroupResponders({ participants, speakerParticipantId: 'self', text: '繼續', policy: 'roundtable', messageCount: 0, presenceByParticipantId: online }).map((item) => item.id)).toEqual(['lunaris']);
    expect(selectGroupResponders({ participants, speakerParticipantId: 'self', text: '繼續', policy: 'roundtable', messageCount: 1, presenceByParticipantId: online }).map((item) => item.id)).toEqual(['clawd']);
  });

  it('uses canonical aliases, group names and participation modes', () => {
    const identities: ChatIdentity[] = [
      { id: 'self', kind: 'user', displayName: '我', avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1 },
      { id: 'agent-a', kind: 'ai', displayName: '全局名', handle: 'alpha', avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: ['小星'], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1 },
      { id: 'agent-b', kind: 'ai', displayName: '靜默者', avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1 },
    ];
    const conversation: Conversation = { id: 'g', title: 'g', kind: 'group', messages: [], createdAt: 1, updatedAt: 1, replyPolicy: 'smart', groupParticipants: [
      { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
      { identityId: 'agent-a', displayNameOverride: '群內星星', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention', aiParticipationMode: 'mention-only' },
      { identityId: 'agent-b', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'director', aiParticipationMode: 'off' },
    ] };
    const base = { conversation, identities, speakerParticipantId: 'self', policy: 'smart' as const, messageCount: 0, presenceByParticipantId: { self: 'online', 'agent-a': 'online', 'agent-b': 'online' } as Record<string, PresenceStatus> };
    expect(selectGroupResponders({ ...base, text: '@小星 回覆' }).map((item) => item.id)).toEqual(['agent-a']);
    expect(selectGroupResponders({ ...base, text: '@群內星星 回覆' }).map((item) => item.id)).toEqual(['agent-a']);
    expect(selectGroupResponders({ ...base, text: '沒有點名' })).toEqual([]);
  });
});
