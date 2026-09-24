import type { ChatIdentity, Conversation, Message } from '@/types';
import { getEffectiveGroupParticipants, isCanonicalSelfParticipant, type EffectiveGroupParticipant } from './participants';

export function resolveConversationPerspective(
  conversation: Conversation | undefined,
  identities: ChatIdentity[],
): EffectiveGroupParticipant | undefined {
  if (!conversation || conversation.kind !== 'group') return undefined;
  const participants = getEffectiveGroupParticipants(conversation, identities)
    .filter((participant) => participant.identityId !== 'narrator' && !participant.identity?.archived);
  const byId = (id?: string) => id ? participants.find((participant) => participant.identityId === id) : undefined;
  return byId(conversation.currentPerspectiveParticipantId)
    || participants.find(isCanonicalSelfParticipant)
    || participants.find((participant) => participant.isSelf)
    || byId(conversation.currentSpeakerParticipantId)
    || participants.find((participant) => participant.allowManualSpeaking)
    || participants[0];
}

export interface MessagePerspectivePresentation {
  senderIdentityId?: string;
  isPerspectiveSelf: boolean;
  alignment: 'perspective-self' | 'other';
}

export function resolveMessagePerspectivePresentation(
  message: Message,
  perspectiveParticipantId?: string,
): MessagePerspectivePresentation {
  const senderIdentityId = message.senderSnapshot?.identityId || message.senderParticipantId;
  const isPerspectiveSelf = Boolean(perspectiveParticipantId && senderIdentityId === perspectiveParticipantId);
  return { senderIdentityId, isPerspectiveSelf, alignment: isPerspectiveSelf ? 'perspective-self' : 'other' };
}

export function resolvePerspectiveMentionPresentation(
  text: string,
  perspective: EffectiveGroupParticipant | undefined,
): { mentionedPerspective: boolean; label?: string } {
  if (!perspective) return { mentionedPerspective: false };
  const tokens = new Set(Array.from(text.matchAll(/@([^\s，。！？、]+)/gu), (match) => match[1].toLocaleLowerCase()));
  const names = [perspective.identityId, perspective.displayName, perspective.identity?.handle, ...(perspective.identity?.mentionAliases || [])]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLocaleLowerCase());
  const mentionedPerspective = names.some((name) => tokens.has(name));
  return { mentionedPerspective, label: mentionedPerspective ? '提到了你' : undefined };
}

export function resolvePerspectiveReplyLabel(
  replyTarget: Message | undefined,
  perspectiveParticipantId: string | undefined,
  storedSenderName: string,
): string {
  if (!replyTarget || !perspectiveParticipantId) return storedSenderName;
  return resolveMessagePerspectivePresentation(replyTarget, perspectiveParticipantId).isPerspectiveSelf ? '你' : storedSenderName;
}
