import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation, TextMessage } from '@/types';
import { resolveConversationPerspective, resolveMessagePerspectivePresentation, resolvePerspectiveMentionPresentation, resolvePerspectiveReplyLabel } from './perspective';

const identity = (id: string, kind: ChatIdentity['kind'], patch: Partial<ChatIdentity> = {}): ChatIdentity => ({ id, kind, displayName: id, avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '', mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1, ...patch });
const group = (patch: Partial<Conversation> = {}): Conversation => ({ id: 'g', title: '群聊', kind: 'group', type: 'group', messages: [], createdAt: 1, updatedAt: 1, groupParticipants: [{ identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' }, { identityId: 'rune', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' }], currentSpeakerParticipantId: 'rune', ...patch });
const identities = [identity('self', 'user'), identity('rune', 'ai', { mentionAliases: ['符文'] })];
const message = (senderParticipantId: string): TextMessage => ({ id: `m-${senderParticipantId}`, type: 'text', sender: senderParticipantId === 'self' ? 'me' : 'assistant', senderParticipantId, content: 'hi', time: new Date(0).toISOString(), status: 'sent' });

describe('conversation perspective', () => {
  it('prefers persisted perspective, then current user, then speaker', () => {
    expect(resolveConversationPerspective(group({ currentPerspectiveParticipantId: 'rune' }), identities)?.identityId).toBe('rune');
    expect(resolveConversationPerspective(group(), identities)?.identityId).toBe('self');
    expect(resolveConversationPerspective(group({ groupParticipants: [{ identityId: 'rune', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'mention' }] }), identities)?.identityId).toBe('rune');
  });
  it('falls back for invalid and archived identities, including legacy groups', () => {
    expect(resolveConversationPerspective(group({ currentPerspectiveParticipantId: 'missing' }), identities)?.identityId).toBe('self');
    expect(resolveConversationPerspective(group({ currentPerspectiveParticipantId: 'rune' }), identities.map((item) => item.id === 'rune' ? { ...item, archived: true } : item))?.identityId).toBe('self');
    expect(resolveConversationPerspective(group({ groupParticipants: undefined, participants: [{ id: 'legacy', name: '舊成員', isSelf: true, controlMode: 'user', avatarColor: 'user' }] }), [])?.identityId).toBe('legacy');
  });
  it('derives alignment, mention and reply labels without writes', () => {
    const original = group({ currentPerspectiveParticipantId: 'self', messages: [message('self'), message('rune')] });
    const before = structuredClone(original);
    expect(resolveMessagePerspectivePresentation(original.messages[1], 'rune').isPerspectiveSelf).toBe(true);
    expect(resolvePerspectiveMentionPresentation('@符文 看這裡', resolveConversationPerspective({ ...original, currentPerspectiveParticipantId: 'rune' }, identities)).label).toBe('提到了你');
    expect(resolvePerspectiveReplyLabel(original.messages[1], 'rune', 'Rune')).toBe('你');
    expect(original).toEqual(before);
  });
});
