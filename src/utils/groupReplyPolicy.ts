import { getEffectiveGroupParticipants, toLegacyParticipantView } from '@/features/groupChat/participants';
import type { ChatIdentity, ChatParticipant, Conversation, GroupReplyPolicy, PresenceStatus } from '@/types';

interface SelectGroupRespondersInput {
  conversation?: Conversation;
  identities?: readonly ChatIdentity[];
  participants?: ChatParticipant[];
  speakerParticipantId: string;
  text: string;
  policy?: GroupReplyPolicy;
  messageCount: number;
  presenceByParticipantId: Record<string, PresenceStatus | undefined>;
}

function normalizedMentionTokens(value: string): string[] {
  return value.toLocaleLowerCase().match(/@[\p{L}\p{N}_-]+/gu)?.map((item) => item.slice(1)) || [];
}

/** Single deterministic arbitration seam for both canonical and legacy groups. */
export function selectGroupResponders({
  conversation,
  identities = [],
  participants,
  speakerParticipantId,
  text,
  policy = conversation?.replyPolicy || 'mention',
  messageCount,
  presenceByParticipantId,
}: SelectGroupRespondersInput): ChatParticipant[] {
  if (conversation?.kind === 'group') {
    const mentions = new Set(normalizedMentionTokens(text));
    const effective = getEffectiveGroupParticipants(conversation, identities)
      .filter((participant) => participant.kind === 'ai'
        && participant.identityId !== speakerParticipantId
        && !participant.identity?.archived
        && presenceByParticipantId[participant.identityId] !== 'offline');
    const explicitlyMentioned = effective.filter((participant) => {
      const tokens = [participant.identityId, participant.displayName, participant.identity?.handle, ...(participant.identity?.mentionAliases || [])]
        .filter(Boolean).map((value) => String(value).toLocaleLowerCase());
      return tokens.some((token) => mentions.has(token));
    });
    const mentionedAllowed = explicitlyMentioned.filter((participant) => participant.aiParticipationMode !== 'off');
    if (mentionedAllowed.length) return [toLegacyParticipantView(mentionedAllowed[0])];
    if (policy === 'mention' || policy === 'director') return [];
    const automatic = effective.filter((participant) => participant.aiParticipationMode === 'automatic');
    if (!automatic.length) return [];
    return [toLegacyParticipantView(automatic[messageCount % automatic.length])];
  }

  const legacy = (participants || []).filter((participant) =>
    !participant.isSelf
    && participant.id !== speakerParticipantId
    && participant.controlMode === 'auto'
    && presenceByParticipantId[participant.id] !== 'offline');
  const normalizedText = text.toLocaleLowerCase();
  const mentioned = legacy.filter((participant) => normalizedText.includes(`@${participant.name.toLocaleLowerCase()}`));
  if (mentioned.length) return [mentioned[0]];
  if (policy === 'mention' || policy === 'director') return [];
  return legacy.length ? [legacy[messageCount % legacy.length]] : [];
}
