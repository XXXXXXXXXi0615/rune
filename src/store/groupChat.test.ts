import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStore, normalizeStore } from '@/store/storage';
import { useAppStore } from '@/store/useAppStore';
import { useIdentityStore } from '@/store/useIdentityStore';
import { createIdentityAndJoinGroup } from '@/utils/groupIdentityTransaction';
import type { ChatIdentity, ChatParticipant, Conversation, TextMessage } from '@/types';

const participants: ChatParticipant[] = [
  { id: 'self', name: '理', avatarInitial: '理', controlMode: 'user', isSelf: true },
  { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', controlMode: 'auto' },
  { id: 'clawd', name: 'CLAWD', avatarInitial: 'C', controlMode: 'auto' },
  { id: 'custom', name: '星野', avatarInitial: '星', controlMode: 'auto' },
];

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ ...createDefaultStore(), aiTyping: false });
  useIdentityStore.setState({ identities: [] });
});

function testIdentity(id: string, kind: ChatIdentity['kind'] = 'ai', patch: Partial<ChatIdentity> = {}): ChatIdentity {
  return {
    id,
    kind,
    displayName: id,
    avatarVariants: [],
    defaultAvatarVariantId: '',
    bio: '',
    personaPrompt: '',
    mentionAliases: [],
    allowManualSpeaking: true,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

describe('conversation migration', () => {
  it('keeps legacy direct ids, message order and counts stable', () => {
    const messages: TextMessage[] = [
      { id: 'm-1', sender: 'me', type: 'text', content: '第一則', time: '2026-07-01T00:00:00.000Z', status: 'sent' },
      { id: 'm-2', sender: 'assistant', type: 'text', content: '第二則', time: '2026-07-01T00:01:00.000Z', status: 'read' },
    ];
    const conversations = [
      { id: 'direct-a', title: '舊私聊', messages, createdAt: 1, updatedAt: 2, pinned: true },
      { id: 'direct-b', title: '已封存', messages: [], createdAt: 3, updatedAt: 4, archived: true },
    ] as Conversation[];
    const once = normalizeStore({ ...createDefaultStore(), conversations, activeConversationId: 'direct-a' });
    const twice = normalizeStore(once);

    expect(once.conversations).toHaveLength(2);
    expect(once.conversations.filter((item) => item.type === 'direct')).toHaveLength(2);
    expect(once.conversations.filter((item) => item.archived)).toHaveLength(1);
    expect(once.conversations.filter((item) => item.pinned)).toHaveLength(1);
    expect(once.conversations[0].id).toBe('direct-a');
    expect(once.conversations[0].messages.map((message) => message.id)).toEqual(['m-1', 'm-2']);
    expect(twice.conversations.map((item) => item.id)).toEqual(once.conversations.map((item) => item.id));
    expect(twice.conversations[0].messages.map((message) => message.id)).toEqual(['m-1', 'm-2']);
  });
});

describe('group conversation persistence fields', () => {
  it('creates user and ai identities and joins them once at the end of a legacy group', () => {
    const id = useAppStore.getState().createGroupConversation({ title: '事务测试', participants: participants.slice(0, 2) });
    const conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    useAppStore.setState({ conversations: useAppStore.getState().conversations.map((item) => item.id === id ? { ...conversation, participants: [participants[0]], participantIds: ['self'], groupParticipants: undefined } : item) });

    const ai = testIdentity('new-ai', 'ai', { defaultReplyPolicy: 'smart' });
    const user = testIdentity('new-user', 'user');
    expect(createIdentityAndJoinGroup(id, ai).ok).toBe(true);
    expect(createIdentityAndJoinGroup(id, ai).ok).toBe(true);
    expect(createIdentityAndJoinGroup(id, user).ok).toBe(true);

    const updated = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(updated.participants?.map((item) => item.id)).toEqual(['self', 'new-ai', 'new-user']);
    expect(updated.groupParticipants?.map((item) => item.order)).toEqual([0, 1, 2]);
    expect(updated.groupParticipants?.find((item) => item.identityId === 'new-ai')?.replyPolicy).toBe('smart');
    expect(useIdentityStore.getState().identities.filter((item) => item.id === 'new-ai')).toHaveLength(1);
  });

  it('rejects archived and narrator identities without persisting them', () => {
    const id = useAppStore.getState().createGroupConversation({ title: '过滤测试', participants: participants.slice(0, 2) });
    expect(createIdentityAndJoinGroup(id, testIdentity('archived', 'ai', { archived: true })).ok).toBe(false);
    expect(createIdentityAndJoinGroup(id, testIdentity('legacy-narrator', 'narrator')).ok).toBe(false);
    expect(useIdentityStore.getState().identities).toHaveLength(0);
  });

  it('keeps a created identity when joining fails and retry does not duplicate it', () => {
    const identity = testIdentity('orphan-ai', 'ai', { avatarVariants: [{ id: 'avatar', label: '头像', assetId: 'blob-asset-id', cropX: 50, cropY: 50, zoom: 1 }], defaultAvatarVariantId: 'avatar' });
    const first = createIdentityAndJoinGroup('missing-group', identity);
    const retry = createIdentityAndJoinGroup('missing-group', identity);
    expect(first.ok).toBe(false);
    expect(retry.ok).toBe(false);
    expect(useIdentityStore.getState().identities.filter((item) => item.id === identity.id)).toHaveLength(1);
    expect(useIdentityStore.getState().identities[0].avatarVariants[0].assetId).toBe('blob-asset-id');
  });

  it('keeps group overrides separate from the global identity', () => {
    const identity = testIdentity('override-ai', 'ai', { displayName: '全局名称' });
    const id = useAppStore.getState().createGroupConversation({ title: '覆写测试', participants: participants.slice(0, 2) });
    expect(createIdentityAndJoinGroup(id, identity).ok).toBe(true);
    useAppStore.getState().updateGroupParticipantMeta(id, identity.id, { displayNameOverride: '群内名称', customAvatarAssetId: 'group-only-asset' });
    expect(useIdentityStore.getState().identities.find((item) => item.id === identity.id)?.displayName).toBe('全局名称');
    const participant = useAppStore.getState().conversations.find((item) => item.id === id)?.groupParticipants?.find((item) => item.identityId === identity.id);
    expect(participant?.displayNameOverride).toBe('群内名称');
    expect(participant?.customAvatarAssetId).toBe('group-only-asset');
  });

  it('deletes a deduplicated conversation batch in one safe transition', () => {
    const store = useAppStore.getState();
    const first = store.createConversation();
    const second = useAppStore.getState().createConversation();
    useAppStore.getState().setActiveConversation(first);
    expect(useAppStore.getState().deleteConversations([first, first, 'missing'])).toBe(1);
    expect(useAppStore.getState().conversations.find((conversation) => conversation.id === first)?.deletedAt).toEqual(expect.any(Number));
    expect(useAppStore.getState().activeConversationId).toBe(second);
    expect(useAppStore.getState().deleteConversations([second])).toBe(1);
    expect(useAppStore.getState().conversations.filter((conversation) => !conversation.deletedAt)).toHaveLength(0);
    expect(useAppStore.getState().activeConversationId).toBeNull();
  });

  it('persists canonical participant modes and safe speaker rules without legacy participant ownership', () => {
    useIdentityStore.setState({
      identities: [
        testIdentity('member-user', 'user', { displayName: '知夏' }),
        testIdentity('member-ai', 'ai', { displayName: '霜', mentionAliases: ['小霜'] }),
      ],
    });
    const id = useAppStore.getState().createGroupConversation({
      title: '純 canonical 群聊',
      identityIds: ['member-user', 'member-ai'],
      groupParticipants: [
        { identityId: 'member-user', role: 'admin', order: 0, joinedAt: 1, aiParticipationMode: 'off', replyPolicy: 'director' },
        { identityId: 'member-ai', role: 'member', order: 1, joinedAt: 1, aiParticipationMode: 'mention-only', replyPolicy: 'mention' },
      ],
      defaultSpeakerIdentityId: 'member-user',
      manualSpeakerSwitchingEnabled: false,
    });
    let conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conversation.currentSpeakerParticipantId).toBe('member-user');
    expect(conversation.manualSpeakerSwitchingEnabled).toBe(false);

    useAppStore.getState().setCurrentSpeaker(id, 'member-ai');
    conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conversation.currentSpeakerParticipantId).toBe('member-user');

    const hydrated = normalizeStore(useAppStore.getState()).conversations.find((item) => item.id === id)!;
    expect(hydrated.groupParticipants?.map((item) => item.aiParticipationMode)).toEqual(['off', 'mention-only']);
    expect(hydrated.manualSpeakerSwitchingEnabled).toBe(false);
  });

  it('keeps perspective independent from speaker and performs zero message writes', () => {
    useIdentityStore.setState({ identities: [testIdentity('viewer', 'user'), testIdentity('speaker', 'ai')] });
    const id = useAppStore.getState().createGroupConversation({ title: '視角測試', identityIds: ['viewer', 'speaker'], defaultSpeakerIdentityId: 'speaker' });
    const messageId = useAppStore.getState().sendGroupText('speaker message', 'speaker', 'user');
    const before = structuredClone(useAppStore.getState().conversations.find((item) => item.id === id)!.messages);
    useAppStore.getState().setConversationPerspective(id, 'viewer');
    const after = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(after.currentSpeakerParticipantId).toBe('speaker');
    expect(after.currentPerspectiveParticipantId).toBe('viewer');
    expect(after.messages).toEqual(before);
    expect(after.messages[0].id).toBe(messageId);
  });

  it('falls back and persists a corrected perspective when the active participant is removed', () => {
    useIdentityStore.setState({ identities: [testIdentity('owner', 'user'), testIdentity('guest', 'ai')] });
    const id = useAppStore.getState().createGroupConversation({ title: '移除視角', identityIds: ['owner', 'guest'] });
    useAppStore.getState().setConversationPerspective(id, 'guest');
    useAppStore.getState().removeGroupParticipant(id, 'guest');
    const conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conversation.currentPerspectiveParticipantId).toBe('owner');
    expect(conversation.currentSpeakerParticipantId).toBe('owner');
  });

  it('uses unique GroupParticipant identities as the 2 to 12 member source of truth', () => {
    const store = useAppStore.getState();
    expect(store.createGroupConversation({ title: '太少', identityIds: ['self'] })).toBe('');

    const identities = Array.from({ length: 14 }, (_, index) => `identity-${index}`);
    const id = store.createGroupConversation({ title: '成員上限', identityIds: [...identities, identities[0]] });
    const conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conversation.groupParticipants).toHaveLength(12);
    expect(new Set(conversation.groupParticipants?.map((participant) => participant.identityId)).size).toBe(12);

    store.updateGroupParticipantMeta(id, 'identity-1', { displayNameOverride: '群內名稱', order: 0 });
    const updated = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(updated.groupParticipants?.find((participant) => participant.identityId === 'identity-1')?.displayNameOverride).toBe('群內名稱');
  });

  it('creates a four-member group and preserves identity snapshots', () => {
    const store = useAppStore.getState();
    const id = store.createGroupConversation({ title: '月潮夜話', avatarUrl: 'data:image/png;base64,group', participants });
    store.updateGroupConversation(id, { announcement: '今晚不趕時間', replyPolicy: 'roundtable' });
    store.setCurrentSpeaker(id, 'lunaris');
    const messageId = store.sendGroupText('我以 LUNARIS 發言', 'lunaris', 'user', undefined, 'round-1');
    store.updateGroupParticipant(id, 'lunaris', { name: '新名字', avatarInitial: 'X' });
    store.sendGroupText('旁白句子', 'narrator', 'system', undefined, 'round-2');

    const conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    const original = conversation.messages.find((message) => message.id === messageId)!;
    const narrator = conversation.messages.find((message) => message.senderParticipantId === 'narrator')!;
    expect(conversation.type).toBe('group');
    expect(conversation.participantIds).toEqual(['self', 'lunaris', 'clawd', 'custom']);
    expect(conversation.replyPolicy).toBe('roundtable');
    expect(conversation.currentSpeakerParticipantId).toBe('lunaris');
    expect(conversation.announcement).toBe('今晚不趕時間');
    expect(original.senderDisplayNameSnapshot).toBe('LUNARIS');
    expect(original.senderAvatarSnapshot).toBe('L');
    expect(original.controlSource).toBe('user');
    expect(original.roundId).toBe('round-1');
    expect(narrator.senderDisplayNameSnapshot).toBe('旁白');
    expect(narrator.controlSource).toBe('system');

    const hydrated = normalizeStore(useAppStore.getState());
    const hydratedGroup = hydrated.conversations.find((item) => item.id === id)!;
    expect(hydratedGroup.participantIds).toEqual(conversation.participantIds);
    expect(hydratedGroup.currentSpeakerParticipantId).toBe('lunaris');
    expect(hydratedGroup.replyPolicy).toBe('roundtable');
  });

  it('keeps image, file and sticker messages bound to the active group identity', () => {
    const store = useAppStore.getState();
    const id = store.createGroupConversation({ title: '附件測試', participants });
    store.setCurrentSpeaker(id, 'clawd');
    store.sendImage('asset-image', 'image/png');
    store.sendFile('asset-file', 'notes.md', 128, 'text/markdown');
    store.sendSticker({ stickerId: 'missing-test-sticker', source: 'builtin', name: 'CLAWD' });

    const messages = useAppStore.getState().conversations.find((item) => item.id === id)!.messages;
    expect(messages.map((message) => message.type)).toEqual(['image', 'file', 'sticker']);
    expect(messages.every((message) => message.senderParticipantId === 'clawd')).toBe(true);
    expect(messages.every((message) => message.senderDisplayNameSnapshot === 'CLAWD')).toBe(true);
    expect(messages.every((message) => message.controlSource === 'user')).toBe(true);
  });

  it('retries a failed delivery without duplicating the message', async () => {
    const store = useAppStore.getState();
    const id = store.createGroupConversation({ title: '重試測試', participants });
    const messageId = store.sendGroupText('原始訊息', 'self', 'user');
    store.setMessageDeliveryStatus(messageId, 'failed');
    const countBefore = useAppStore.getState().conversations.find((item) => item.id === id)!.messages.length;
    store.retryMessageDelivery(messageId);
    await Promise.resolve();
    const conversation = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conversation.messages).toHaveLength(countBefore);
    expect(conversation.messages.find((message) => message.id === messageId)?.deliveryStatus).toBe('sent');
  });

  it('creates, edits, and removes directional group relationships', () => {
    useIdentityStore.setState({ identities: [testIdentity('rune', 'ai'), testIdentity('shuri', 'user'), testIdentity('haru', 'ai')] });
    const id = useAppStore.getState().createGroupConversation({ title: '關係測試', identityIds: ['rune', 'shuri', 'haru'] });
    const store = useAppStore.getState();

    store.addGroupRelationship(id, 'rune', 'shuri', 'protective', '保護 / 在意', '會主動提醒');
    store.addGroupRelationship(id, 'shuri', 'rune', 'dependent');
    let conv = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conv.groupRelationships).toHaveLength(2);
    const runeToShuri = conv.groupRelationships!.find((r) => r.fromParticipantId === 'rune')!;
    expect(runeToShuri.kind).toBe('protective');
    expect(runeToShuri.customLabel).toBe('保護 / 在意');
    expect(runeToShuri.note).toBe('會主動提醒');

    store.updateGroupRelationship(id, runeToShuri.id, { kind: 'friend', note: undefined });
    conv = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conv.groupRelationships!.find((r) => r.id === runeToShuri.id)!.kind).toBe('friend');
    expect(conv.groupRelationships!.find((r) => r.id === runeToShuri.id)!.note).toBeUndefined();

    const shuriToRune = conv.groupRelationships!.find((r) => r.fromParticipantId === 'shuri')!;
    store.removeGroupRelationship(id, shuriToRune.id);
    conv = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(conv.groupRelationships).toHaveLength(1);
  });

  it('cleans up relationship edges when removing a participant', () => {
    useIdentityStore.setState({ identities: [testIdentity('rune', 'ai'), testIdentity('shuri', 'user')] });
    const id = useAppStore.getState().createGroupConversation({ title: '移除關係', identityIds: ['rune', 'shuri'] });
    useAppStore.getState().addGroupRelationship(id, 'rune', 'shuri', 'protective');
    useAppStore.getState().addGroupRelationship(id, 'shuri', 'rune', 'dependent');
    useAppStore.getState().removeGroupParticipant(id, 'rune');
    const conv = useAppStore.getState().conversations.find((item) => item.id === id)!;
    // every edge touching the removed participant is gone — no dangling reference
    expect(conv.groupRelationships).toEqual([]);
    // participant itself is gone from the group, survivors untouched
    expect(conv.groupParticipants?.map((item) => item.identityId)).toEqual(['shuri']);
    // global identity is NOT deleted by a group removal
    expect(useIdentityStore.getState().identities.map((item) => item.id)).toContain('rune');
    // conversation still renders — wrapper conversation survived the removal
    expect(conv.id).toBe(id);
    expect(conv.kind).toBe('group');
    expect(conv.messages).toBeDefined();
  });

  it('preserves relationships when switching perspective or speaker', () => {
    useIdentityStore.setState({ identities: [testIdentity('viewer', 'user'), testIdentity('speaker', 'ai')] });
    const id = useAppStore.getState().createGroupConversation({ title: '視角關係', identityIds: ['viewer', 'speaker'] });
    useAppStore.getState().addGroupRelationship(id, 'viewer', 'speaker', 'friend');
    const before = structuredClone(useAppStore.getState().conversations.find((item) => item.id === id)!.groupRelationships);
    useAppStore.getState().setConversationPerspective(id, 'speaker');
    useAppStore.getState().setCurrentSpeaker(id, 'viewer');
    const after = useAppStore.getState().conversations.find((item) => item.id === id)!;
    expect(after.groupRelationships).toEqual(before);
    expect(after.currentPerspectiveParticipantId).toBe('speaker');
    expect(after.currentSpeakerParticipantId).toBe('viewer');
  });

  it('performs zero message writes when adding relationships', () => {
    useIdentityStore.setState({ identities: [testIdentity('a', 'user'), testIdentity('b', 'ai')] });
    const id = useAppStore.getState().createGroupConversation({ title: '零寫入', identityIds: ['a', 'b'] });
    useAppStore.getState().sendGroupText('hello', 'a', 'user');
    const messagesBefore = structuredClone(useAppStore.getState().conversations.find((item) => item.id === id)!.messages);
    useAppStore.getState().addGroupRelationship(id, 'a', 'b', 'close');
    useAppStore.getState().addGroupRelationship(id, 'b', 'a', 'formal');
    const messagesAfter = useAppStore.getState().conversations.find((item) => item.id === id)!.messages;
    expect(messagesAfter).toEqual(messagesBefore);
  });
});

describe('groupRelationships normalization (persist v0 → v1 path)', () => {
  function groupWithRelationships(relationships: unknown[]): Conversation {
    return {
      id: 'g-raw',
      title: 'raw',
      kind: 'group',
      type: 'group',
      messages: [],
      createdAt: 1,
      updatedAt: 1,
      participants: [],
      participantIds: ['self', 'rune', 'shuri'],
      groupParticipants: [
        { identityId: 'self', role: 'admin', order: 0, joinedAt: 1, replyPolicy: 'smart' },
        { identityId: 'rune', role: 'member', order: 1, joinedAt: 1, replyPolicy: 'smart' },
        { identityId: 'shuri', role: 'member', order: 2, joinedAt: 1, replyPolicy: 'mention' },
      ],
      groupRelationships: relationships as Conversation['groupRelationships'],
    } as Conversation;
  }

  it('round-trips a persisted relationship through migrate + merge', () => {
    const rawPersisted = {
      ...createDefaultStore(),
      conversations: [groupWithRelationships([
        { id: 'rel-1', fromParticipantId: 'rune', toParticipantId: 'shuri', kind: 'protective', customLabel: '保護 / 在意', note: '會主動提醒', createdAt: 1, updatedAt: 1 },
      ])],
      activeConversationId: 'g-raw',
    };
    // zustand migrate(persistedState, 0): persistedState runs through normalizeStore
    const migrated = normalizeStore(rawPersisted);
    const migratedConv = migrated.conversations.find((item) => item.id === 'g-raw')!;
    expect(migratedConv.groupRelationships).toHaveLength(1);
    expect(migratedConv.groupRelationships![0]).toMatchObject({
      id: 'rel-1',
      fromParticipantId: 'rune',
      toParticipantId: 'shuri',
      kind: 'protective',
      customLabel: '保護 / 在意',
      note: '會主動提醒',
      createdAt: 1,
      updatedAt: 1,
    });
    // zustand merge: { ...current, ...normalized } — field survives
    const current = useAppStore.getState();
    expect({ ...current, ...migrated }.conversations.find((item) => item.id === 'g-raw')!.groupRelationships).toHaveLength(1);
    // idempotent: a second normalize pass is a no-op on the field content
    const twice = normalizeStore(migrated);
    expect(twice.conversations.find((item) => item.id === 'g-raw')!.groupRelationships).toEqual(migratedConv.groupRelationships);
  });

  it('filters malformed edges while preserving valid ones', () => {
    const rawPersisted = {
      ...createDefaultStore(),
      conversations: [groupWithRelationships([
        { id: 'rel-valid', fromParticipantId: 'rune', toParticipantId: 'shuri', kind: 'protective' },
        { id: 'rel-self', fromParticipantId: 'rune', toParticipantId: 'rune', kind: 'friend' },
        { fromParticipantId: 'shuri', toParticipantId: 'rune', kind: 'custom' },
        { id: 'rel-no-from', fromParticipantId: '', toParticipantId: 'rune', kind: 'close' },
        { id: 'rel-unknown-kind', fromParticipantId: 'shuri', toParticipantId: 'rune', kind: 'weird' },
      ])],
      activeConversationId: 'g-raw',
    };
    const normalized = normalizeStore(rawPersisted);
    const rels = normalized.conversations.find((item) => item.id === 'g-raw')!.groupRelationships!;
    expect(rels).toHaveLength(2);
    expect(rels.find((r) => r.id === 'rel-valid')?.kind).toBe('protective');
    expect(rels.find((r) => r.id === 'rel-unknown-kind')?.kind).toBe('custom');
  });
});
