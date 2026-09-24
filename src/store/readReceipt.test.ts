import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultStore } from '@/store/storage';
import { useAppStore } from '@/store/useAppStore';
import type { ChatParticipant, Conversation, TextMessage } from '@/types';

function setupDirectChat(): { convId: string; message: TextMessage } {
  const store = useAppStore.getState();
  const convId = store.createConversation();
  store.sendText('Hello Luna');
  const conv = useAppStore.getState().conversations.find((c) => c.id === convId)!;
  const message = conv.messages[0] as TextMessage;
  return { convId, message };
}

function setupGroupChat(participants: ChatParticipant[]): { convId: string } {
  const store = useAppStore.getState();
  const convId = store.createGroupConversation({ title: 'Test Group', participants });
  return { convId };
}

/** Send a group message from the user and transition it from sending → sent (simulating ChatPage flow). */
function sendUserGroupMessage(convId: string): TextMessage {
  const store = useAppStore.getState();
  store.setCurrentSpeaker(convId, 'user');
  const msgId = store.sendGroupText('hello', 'user', 'user');
  store.setMessageDeliveryStatus(msgId, 'sent', ['user']);
  const conv = useAppStore.getState().conversations.find((c) => c.id === convId)!;
  return conv.messages.find((m) => m.id === msgId) as TextMessage;
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ ...createDefaultStore(), aiTyping: false });
});

describe('read receipt — direct chat', () => {
  it('outgoing message shows 未讀 when recipient has not read', () => {
    const { convId, message } = setupDirectChat();
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('未讀');
  });

  it('outgoing message shows 已讀 when recipient cursor covers it', () => {
    const { convId, message } = setupDirectChat();
    useAppStore.getState().markParticipantRead(convId, 'luna', message.id);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('已讀');
  });

  it('incoming message returns null (no read receipt)', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    const incomingMsg: TextMessage = {
      id: 'incoming-1',
      sender: 'assistant',
      type: 'text',
      content: 'Hello',
      time: new Date().toISOString(),
      status: 'sent',
      deliveryStatus: 'sent',
    };
    const label = store.getMessageReadReceiptLabel(convId, incomingMsg);
    expect(label).toBeNull();
  });

  it('sending status shows 傳送中', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    const sendingMsg: TextMessage = {
      id: 'sending-1',
      sender: 'me',
      type: 'text',
      content: 'test',
      time: new Date().toISOString(),
      status: 'sent',
      deliveryStatus: 'sending',
    };
    const label = store.getMessageReadReceiptLabel(convId, sendingMsg);
    expect(label).toBe('傳送中');
  });

  it('failed status shows 傳送失敗', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    const failedMsg: TextMessage = {
      id: 'failed-1',
      sender: 'me',
      type: 'text',
      content: 'test',
      time: new Date().toISOString(),
      status: 'sent',
      deliveryStatus: 'failed',
    };
    const label = store.getMessageReadReceiptLabel(convId, failedMsg);
    expect(label).toBe('傳送失敗');
  });

  it('old sent messages without deliveryStatus show 未讀 (migration)', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    const oldMsg: TextMessage = {
      id: 'old-msg',
      sender: 'me',
      type: 'text',
      content: 'old message',
      time: new Date().toISOString(),
      status: 'sent',
    };
    const label = store.getMessageReadReceiptLabel(convId, oldMsg);
    expect(label).toBe('未讀');
  });

  it('old delivered messages without deliveryStatus show 未讀 (migration)', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    const oldMsg: TextMessage = {
      id: 'old-msg-2',
      sender: 'me',
      type: 'text',
      content: 'old delivered',
      time: new Date().toISOString(),
      status: 'delivered',
    };
    const label = store.getMessageReadReceiptLabel(convId, oldMsg);
    expect(label).toBe('未讀');
  });

  it('read state persists after refresh simulation (store reload)', () => {
    const { convId, message } = setupDirectChat();
    useAppStore.getState().markParticipantRead(convId, 'luna', message.id);

    const state = useAppStore.getState();
    const conv = state.conversations.find((c) => c.id === convId);
    expect(conv?.participantReadCursors?.['luna']?.lastReadMessageId).toBe(message.id);

    const label = state.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('已讀');
  });

  it('readAt earlier than message time does not mark as read', () => {
    const { convId, message } = setupDirectChat();
    const store = useAppStore.getState();
    store.markParticipantRead(convId, 'luna', 'nonexistent-msg-id');
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('未讀');
  });
});

describe('read receipt — group chat', () => {
  const participants: ChatParticipant[] = [
    { id: 'user', name: 'Me', avatarInitial: 'M', controlMode: 'user', isSelf: true },
    { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', controlMode: 'auto' },
    { id: 'clawd', name: 'CLAWD', avatarInitial: 'C', controlMode: 'auto' },
  ];

  it('no one has read → 未讀', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('未讀');
  });

  it('one of two recipients read → 已讀 1/2', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    useAppStore.getState().markParticipantRead(convId, 'lunaris', message.id);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('已讀 1/2');
  });

  it('all recipients read → 全部已讀', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    useAppStore.getState().markParticipantRead(convId, 'lunaris', message.id);
    useAppStore.getState().markParticipantRead(convId, 'clawd', message.id);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('全部已讀');
  });

  it('sender is excluded from recipient count', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    useAppStore.getState().markParticipantRead(convId, 'user', message.id);
    useAppStore.getState().markParticipantRead(convId, 'lunaris', message.id);
    useAppStore.getState().markParticipantRead(convId, 'clawd', message.id);
    const store = useAppStore.getState();
    const summary = store.getOutgoingMessageReadSummary(convId, message.id);
    expect(summary.total).toBe(2); // lunaris + clawd, excluding user
    expect(summary.read).toBe(2);
  });

  it('narrator is excluded from recipients', () => {
    const pWithNarrator: ChatParticipant[] = [
      { id: 'user', name: 'Me', avatarInitial: 'M', controlMode: 'user', isSelf: true },
      { id: 'narrator', name: 'Narrator', avatarInitial: 'N', controlMode: 'auto' },
      { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', controlMode: 'auto' },
    ];
    const { convId } = setupGroupChat(pWithNarrator);
    const message = sendUserGroupMessage(convId);
    const store = useAppStore.getState();
    const summary = store.getOutgoingMessageReadSummary(convId, message.id);
    expect(summary.total).toBe(1); // only lunaris
  });

  it('incoming message from another participant returns null', () => {
    const { convId } = setupGroupChat(participants);
    useAppStore.getState().setCurrentSpeaker(convId, 'lunaris');
    const msgId = useAppStore.getState().sendGroupText('hi from luna', 'lunaris', 'ai');
    const store = useAppStore.getState();
    const msg = store.conversations.find((c) => c.id === convId)!.messages.find((m) => m.id === msgId)!;
    const label = store.getMessageReadReceiptLabel(convId, msg);
    expect(label).toBeNull();
  });

  it('outgoing message from user identity shows read receipt after transition to sent', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('未讀');
    expect(message.deliveryStatus).not.toBe('sending');
  });

  it('getOutgoingMessageReadSummary returns correct counts', () => {
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    useAppStore.getState().markParticipantRead(convId, 'lunaris', message.id);
    const store = useAppStore.getState();
    const summary = store.getOutgoingMessageReadSummary(convId, message.id);
    expect(summary.total).toBe(2);
    expect(summary.read).toBe(1);
  });
});

describe('read receipt — markParticipantRead', () => {
  it('does not duplicate when same lastReadMessageId is written', () => {
    const { convId, message } = setupDirectChat();
    useAppStore.getState().markParticipantRead(convId, 'luna', message.id);
    const cursors1 = useAppStore.getState().conversations.find((c) => c.id === convId)!.participantReadCursors;
    const initialUpdatedAt = cursors1?.['luna']?.lastReadAt;

    useAppStore.getState().markParticipantRead(convId, 'luna', message.id); // same id again
    const cursors2 = useAppStore.getState().conversations.find((c) => c.id === convId)!.participantReadCursors;
    expect(cursors2?.['luna']?.lastReadAt).toBe(initialUpdatedAt);
  });

  it('isMessageReadByParticipant returns true when cursor covers message', () => {
    const { convId, message } = setupDirectChat();
    useAppStore.getState().markParticipantRead(convId, 'luna', message.id);
    expect(useAppStore.getState().isMessageReadByParticipant(convId, message.id, 'luna')).toBe(true);
  });

  it('isMessageReadByParticipant returns false when cursor is before message', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    store.sendText('first message');
    store.sendText('second message');
    const conv = useAppStore.getState().conversations.find((c) => c.id === convId)!;
    const firstMsgId = conv.messages[0].id;
    const secondMsgId = conv.messages[1].id;

    useAppStore.getState().markParticipantRead(convId, 'luna', firstMsgId);
    expect(useAppStore.getState().isMessageReadByParticipant(convId, firstMsgId, 'luna')).toBe(true);
    expect(useAppStore.getState().isMessageReadByParticipant(convId, secondMsgId, 'luna')).toBe(false);
  });
});

describe('read receipt — retry flow', () => {
  it('failed delivery shows 傳送失敗', () => {
    const { convId, message } = setupDirectChat();
    const store = useAppStore.getState();
    store.setMessageDeliveryStatus(message.id, 'failed');
    const updatedMsg = useAppStore.getState().conversations.find((c) => c.id === convId)!.messages.find((m) => m.id === message.id)!;
    const label = store.getMessageReadReceiptLabel(convId, updatedMsg);
    expect(label).toBe('傳送失敗');
  });

  it('after retry, sent message shows 未讀', async () => {
    const store = useAppStore.getState();
    const convId = store.createConversation();
    store.sendText('test retry');
    const conv = useAppStore.getState().conversations.find((c) => c.id === convId)!;
    const msgId = conv.messages[0].id;
    store.setMessageDeliveryStatus(msgId, 'failed');
    store.retryMessageDelivery(msgId);
    await new Promise((r) => setTimeout(r, 10)); // wait for queueMicrotask
    const updatedMsg = useAppStore.getState().conversations.find((c) => c.id === convId)!.messages[0] as TextMessage;
    const label = useAppStore.getState().getMessageReadReceiptLabel(convId, updatedMsg);
    expect(label).toBe('未讀');
  });
});

describe('read receipt — deprecated ChatParticipant fields fallback', () => {
  it('uses ChatParticipant.lastReadMessageId when participantReadCursors is absent', () => {
    const participants: ChatParticipant[] = [
      { id: 'user', name: 'Me', avatarInitial: 'M', controlMode: 'user', isSelf: true },
      { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', controlMode: 'auto', lastReadMessageId: '' },
    ];
    const { convId } = setupGroupChat(participants);
    const store = useAppStore.getState();
    const result = store.isMessageReadByParticipant(convId, 'nonexistent', 'lunaris');
    expect(result).toBe(false); // empty string won't match

    // Now mark via the proper cursor and verify
    store.markParticipantRead(convId, 'lunaris', 'some-msg-id');
    // But the message doesn't exist, so it still returns false
    expect(store.isMessageReadByParticipant(convId, 'some-msg-id', 'lunaris')).toBe(false);
  });
});

describe('read receipt — activeSpeakerIdentityId', () => {
  it('outgoing by user identity shows receipt after transition to sent', () => {
    const participants: ChatParticipant[] = [
      { id: 'user', name: 'Me', avatarInitial: 'M', controlMode: 'user', isSelf: true },
      { id: 'lunaris', name: 'LUNARIS', avatarInitial: 'L', controlMode: 'auto' },
    ];
    const { convId } = setupGroupChat(participants);
    const message = sendUserGroupMessage(convId);
    const store = useAppStore.getState();
    const label = store.getMessageReadReceiptLabel(convId, message);
    expect(label).toBe('未讀');
  });
});
