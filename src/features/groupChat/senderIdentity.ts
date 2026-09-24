import type { ChatIdentity, Conversation, Message } from '@/types';
import { getEffectiveGroupParticipants, type EffectiveGroupParticipant } from './participants';
import { resolveGroupParticipantPresentation, type ParticipantPresentationKind, type ParticipantSecondaryLabel } from './presentation';

/**
 * Canonical sender identity resolution for group conversations.
 *
 * Contract (Group Chat UX Consolidation Phase 1):
 *   every message resolves its display name / avatar / role label from its own
 *   canonical senderId (`senderSnapshot.identityId` → `senderParticipantId` →
 *   implicit `self` for `sender: 'me'`), never from a conversation-wide
 *   "current identity" name.
 *
 * The resolved participant always comes from the single participant source
 * (`getEffectiveGroupParticipants`), so the speaker selector and the message
 * list cannot drift apart.
 */

export type SenderRoleLabel = ParticipantSecondaryLabel | '旁白' | '未知';

export interface MessageSenderIdentity {
  identityId?: string;
  displayName: string;
  roleLabel: SenderRoleLabel;
  kind: ParticipantPresentationKind | 'narrator' | 'unknown';
  isCanonicalSelf: boolean;
  /** True when another participant shares this display name (needs a @handle). */
  needsDisambiguation: boolean;
  handle?: string;
  participant?: EffectiveGroupParticipant;
}

type SenderResolutionInput = Pick<Message, 'sender' | 'senderParticipantId' | 'senderSnapshot' | 'senderDisplayNameSnapshot'>;

/** The only legal way to derive a group message's sender id. */
export function resolveMessageSenderIdentityId(message: SenderResolutionInput): string | undefined {
  return message.senderSnapshot?.identityId || message.senderParticipantId || (message.sender === 'me' ? 'self' : undefined);
}

export function resolveMessageSenderIdentity(
  message: SenderResolutionInput,
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
): MessageSenderIdentity {
  const identityId = resolveMessageSenderIdentityId(message);
  const snapshotName = message.senderSnapshot?.displayName || message.senderDisplayNameSnapshot;

  if (identityId === 'narrator') {
    return { identityId, displayName: snapshotName || '旁白', roleLabel: '旁白', kind: 'narrator', isCanonicalSelf: false, needsDisambiguation: false };
  }

  const participants = conversation?.kind === 'group' ? getEffectiveGroupParticipants(conversation, identities) : [];
  const participant = identityId ? participants.find((item) => item.identityId === identityId) : undefined;

  if (!participant) {
    // Never fall back to a conversation-wide name: an unresolved sender keeps
    // its own recorded snapshot, otherwise it is honestly unknown.
    return { identityId, displayName: snapshotName || '未知成員', roleLabel: '未知', kind: 'unknown', isCanonicalSelf: false, needsDisambiguation: false };
  }

  const presentation = resolveGroupParticipantPresentation(participant);
  return {
    identityId,
    displayName: participant.displayName || snapshotName || '未知成員',
    roleLabel: presentation.secondaryLabel,
    kind: presentation.kind,
    isCanonicalSelf: presentation.kind === 'self',
    needsDisambiguation: participantNeedsHandle(participant.displayName, participants),
    handle: presentation.handle,
    participant,
  };
}

function participantNeedsHandle(displayName: string, participants: readonly EffectiveGroupParticipant[]): boolean {
  return participants.filter((item) => item.displayName === displayName).length > 1;
}

/** Message-list sender label. Message-scoped, never conversation-scoped. */
export function resolveGroupMessageSenderLabel(
  message: SenderResolutionInput,
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
): string {
  return resolveMessageSenderIdentity(message, conversation, identities).displayName;
}
