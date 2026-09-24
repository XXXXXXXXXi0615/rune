import type {
  ChatIdentity,
  ChatParticipant,
  Conversation,
  GroupAiParticipationMode,
  GroupParticipant,
  GroupReplyPolicy,
} from '@/types';

/**
 * Canonical group participant cap.
 *
 * Audit: mirrors the write guard already owned by `useAppStore`
 * (`createGroupConversation` uses `slice(0, 12)`, `addGroupParticipant` bails at
 * `length >= 12`). Presentation-only mirror so the settings surface can label
 * the capacity metric without touching the store.
 */
export const GROUP_PARTICIPANT_LIMIT = 12;

export interface EffectiveGroupParticipant {
  identityId: string;
  identity?: ChatIdentity;
  participant?: GroupParticipant;
  legacyParticipant?: ChatParticipant;
  displayName: string;
  kind: ChatIdentity['kind'];
  role: GroupParticipant['role'];
  joinedAt: number;
  aiParticipationMode: GroupAiParticipationMode;
  allowManualSpeaking: boolean;
  isSelf: boolean;
}

export function groupAiModeFromLegacy(policy?: GroupReplyPolicy, controlMode?: ChatParticipant['controlMode']): GroupAiParticipationMode {
  if (policy === 'director' || controlMode === 'paused') return 'off';
  if (policy === 'mention' || controlMode === 'user') return 'mention-only';
  return 'automatic';
}

export function legacyReplyPolicyFromGroupAiMode(mode: GroupAiParticipationMode): GroupReplyPolicy {
  return mode === 'off' ? 'director' : mode === 'mention-only' ? 'mention' : 'smart';
}

export function getEffectiveGroupParticipants(
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
): EffectiveGroupParticipant[] {
  if (!conversation || conversation.kind !== 'group') return [];
  const legacyById = new Map((conversation.participants || []).map((participant) => [participant.id, participant]));
  const identityById = new Map(identities.map((identity) => [identity.id, identity]));

  if (conversation.groupParticipants?.length) {
    return [...conversation.groupParticipants]
      .sort((a, b) => a.order - b.order)
      .map((participant) => {
        const identity = identityById.get(participant.identityId);
        const legacyParticipant = legacyById.get(participant.identityId);
        const kind = identity?.kind || (participant.identityId === 'self' || legacyParticipant?.isSelf ? 'user' : 'ai');
        return {
          identityId: participant.identityId,
          identity,
          participant,
          legacyParticipant,
          displayName: participant.displayNameOverride?.trim() || identity?.displayName || legacyParticipant?.groupNickname || legacyParticipant?.name || participant.identityId,
          kind,
          role: participant.role,
          joinedAt: participant.joinedAt,
          aiParticipationMode: participant.aiParticipationMode || groupAiModeFromLegacy(participant.replyPolicy, legacyParticipant?.controlMode),
          allowManualSpeaking: kind !== 'ai' || identity?.allowManualSpeaking !== false,
          isSelf: kind === 'user' || legacyParticipant?.isSelf === true,
        };
      });
  }

  return (conversation.participants || []).map((legacyParticipant, order) => {
    const identity = identityById.get(legacyParticipant.id);
    const kind = identity?.kind || (legacyParticipant.id === 'self' || legacyParticipant.isSelf ? 'user' : 'ai');
    return {
      identityId: legacyParticipant.id,
      identity,
      legacyParticipant,
      displayName: legacyParticipant.groupNickname || identity?.displayName || legacyParticipant.name || legacyParticipant.id,
      kind,
      role: legacyParticipant.isSelf ? 'admin' : 'member',
      joinedAt: conversation.createdAt,
      aiParticipationMode: groupAiModeFromLegacy(undefined, legacyParticipant.controlMode),
      allowManualSpeaking: kind !== 'ai' || identity?.allowManualSpeaking !== false,
      isSelf: legacyParticipant.isSelf === true || kind === 'user',
    };
  });
}

export function getEffectiveGroupParticipant(
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
  identityId: string | undefined,
): EffectiveGroupParticipant | undefined {
  if (!identityId) return undefined;
  return getEffectiveGroupParticipants(conversation, identities).find((participant) => participant.identityId === identityId);
}

export function resolveSafeGroupSpeaker(
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
  preferredIdentityId = conversation?.currentSpeakerParticipantId,
): EffectiveGroupParticipant | undefined {
  const participants = getEffectiveGroupParticipants(conversation, identities);
  const allowed = participants.filter((participant) => !participant.identity?.archived && participant.allowManualSpeaking);
  return allowed.find((participant) => participant.identityId === preferredIdentityId)
    // Canonical self wins over user-played manual roles, which also report isSelf.
    || allowed.find((participant) => participant.identityId === 'self')
    || allowed.find((participant) => participant.isSelf)
    || allowed[0];
}

/** `identityId === 'self'` is the only canonical self marker in a group. */
export function isCanonicalSelfParticipant(participant: EffectiveGroupParticipant | undefined): boolean {
  if (!participant) return false;
  return participant.identityId === 'self' || (!participant.identity && participant.legacyParticipant?.isSelf === true);
}

export function toLegacyParticipantView(participant: EffectiveGroupParticipant): ChatParticipant {
  return participant.legacyParticipant || {
    id: participant.identityId,
    name: participant.displayName,
    groupNickname: participant.participant?.displayNameOverride,
    avatarInitial: participant.displayName.charAt(0),
    avatarColor: participant.kind === 'user' ? 'user' : participant.kind === 'silent' ? 'lavender' : 'char',
    controlMode: participant.kind === 'user' ? 'user' : participant.aiParticipationMode === 'off' ? 'paused' : 'auto',
    isSelf: participant.isSelf,
  };
}
