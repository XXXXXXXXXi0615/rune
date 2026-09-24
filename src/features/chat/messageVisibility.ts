import type { Message } from '@/types';

export type MessageDeletionMode = 'self' | 'all';

export function isMessageDeletedForAll(message: Message): boolean {
  return typeof message.deletedForAllAt === 'number';
}

export function isMessageVisibleToSelf(message: Message): boolean {
  return !message.deletedAt && !message.deletedForSelfAt && !message.deletedForAllAt;
}

export function isMessageAvailableForReply(message: Message | undefined): boolean {
  return Boolean(message && isMessageVisibleToSelf(message));
}

export function getVisibleMessages(messages: Message[]): Message[] {
  return messages.filter(isMessageVisibleToSelf);
}
