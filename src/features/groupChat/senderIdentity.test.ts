import { describe, expect, it } from 'vitest';
import type { ChatIdentity, Conversation, Message } from '@/types';
import {
  resolveGroupMessageSenderLabel,
  resolveMessageSenderIdentity,
  resolveMessageSenderIdentityId,
} from './senderIdentity';

const identity = (id: string, kind: ChatIdentity['kind'], patch: Partial<ChatIdentity> = {}): ChatIdentity => ({
  id, kind, displayName: id, avatarVariants: [], defaultAvatarVariantId: '', bio: '', personaPrompt: '',
  mentionAliases: [], allowManualSpeaking: true, archived: false, createdAt: 1, updatedAt: 1, ...patch,
});

const group = (): Conversation => ({
  id: 'g', title: '群聊', kind: 'group', type: 'group', messages: [], createdAt: 1, updatedAt: 1,
  groupParticipants: [
    { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
    { identityId: 'lunaris', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' },
    { identityId: 'role-a', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
  ],
  participants: [
    { id: 'self', name: 'shuri', avatarInitial: 's', avatarColor: 'user', controlMode: 'user', isSelf: true },
    { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', avatarColor: 'char', controlMode: 'auto' },
    { id: 'role-a', name: 'shuri', avatarInitial: 's', avatarColor: 'user', controlMode: 'auto', isSelf: true },
  ],
  currentSpeakerParticipantId: 'self',
});

const identities = () => [identity('self', 'user', { displayName: 'shuri' }), identity('lunaris', 'ai', { displayName: 'LUNARIS' }), identity('role-a', 'user', { displayName: '临' })];

const message = (patch: Partial<Message>): Message => ({ id: 'm', sender: 'assistant', type: 'text', content: 'x', time: new Date(1).toISOString(), status: 'sent', ...patch } as Message);

describe('group sender identity contract', () => {
  it('resolves the canonical sender id from snapshot → participant id → implicit self', () => {
    expect(resolveMessageSenderIdentityId(message({ senderParticipantId: 'role-a', senderSnapshot: { identityId: 'lunaris', displayName: 'LUNARIS', kind: 'ai' } }))).toBe('lunaris');
    expect(resolveMessageSenderIdentityId(message({ senderParticipantId: 'role-a' }))).toBe('role-a');
    expect(resolveMessageSenderIdentityId(message({ sender: 'me' }))).toBe('self');
  });

  it('gives different senderIds different names — never a conversation-wide name', () => {
    const conversation = group();
    const ids = identities();
    const first = resolveMessageSenderIdentity(message({ senderParticipantId: 'self' }), conversation, ids);
    const second = resolveMessageSenderIdentity(message({ senderParticipantId: 'lunaris' }), conversation, ids);
    const third = resolveMessageSenderIdentity(message({ senderParticipantId: 'role-a' }), conversation, ids);
    expect(first.displayName).toBe('shuri');
    expect(second.displayName).toBe('LUNARIS');
    expect(third.displayName).toBe('临');
    expect(new Set([first.displayName, second.displayName, third.displayName]).size).toBe(3);
  });

  it('labels only the canonical self identity as 你', () => {
    const conversation = group();
    const ids = identities();
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'self' }), conversation, ids).roleLabel).toBe('你');
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'lunaris' }), conversation, ids).roleLabel).toBe('AI');
    // A user-played manual role must NOT be labelled 你 even though kind === 'user'.
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'role-a' }), conversation, ids).roleLabel).toBe('成員');
  });

  it('falls back to the message snapshot when the participant record is gone', () => {
    const conversation = group();
    const stripped: Conversation = { ...conversation, groupParticipants: [], participants: [] };
    const resolved = resolveMessageSenderIdentity(
      message({ senderParticipantId: 'ghost', senderSnapshot: { identityId: 'ghost', displayName: '舊成員', kind: 'ai' } }),
      stripped,
      [],
    );
    expect(resolved.displayName).toBe('舊成員');
    expect(resolved.roleLabel).toBe('未知');
    expect(resolveGroupMessageSenderLabel(message({ senderParticipantId: 'ghost', senderDisplayNameSnapshot: '快照名' }), stripped, [])).toBe('快照名');
  });

  it('never resolves an unknown sender to a conversation-wide partner/user name', () => {
    const conversation = group();
    const resolved = resolveMessageSenderIdentity(message({ sender: 'assistant' }), conversation, identities());
    expect(resolved.displayName).not.toBe('shuri');
    expect(resolved.displayName).toBe('未知成員');
  });

  it('flags duplicate display names for handle disambiguation', () => {
    const conversation = group();
    const duplicate: ChatIdentity[] = [identity('a', 'user', { displayName: '月光', handle: 'moon-a' }), identity('b', 'user', { displayName: '月光', handle: 'moon-b' })];
    const conversationWithDupes: Conversation = {
      ...conversation,
      groupParticipants: [
        { identityId: 'a', role: 'member', order: 0, joinedAt: 1, replyPolicy: 'mention' },
        { identityId: 'b', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'mention' },
      ],
      participants: [],
    };
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'a' }), conversationWithDupes, duplicate).needsDisambiguation).toBe(true);
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'a' }), conversationWithDupes, duplicate).handle).toBe('moon-a');
    expect(resolveMessageSenderIdentity(message({ senderParticipantId: 'a' }), conversation, identities()).needsDisambiguation).toBe(false);
  });

  it('keeps the narrator out of participant resolution', () => {
    const resolved = resolveMessageSenderIdentity(message({ senderParticipantId: 'narrator' }), group(), identities());
    expect(resolved.displayName).toBe('旁白');
    expect(resolved.roleLabel).toBe('旁白');
  });
});
