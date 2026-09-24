import type { ChatIdentity, ChatParticipant, Conversation, GroupParticipant } from '@/types';

export function resolveConversationKind(conversation: Conversation): 'direct' | 'group' {
  return conversation.kind === 'group' || conversation.type === 'group' ? 'group' : 'direct';
}

export function resolveDirectIdentityId(
  conversation: Conversation,
  identities: ChatIdentity[],
): string | undefined {
  const identityIds = conversation.groupParticipants?.map((item) => item.identityId)
    || conversation.participantIds
    || conversation.participants?.map((item) => item.id)
    || [];
  const explicit = identityIds.find((id) => identities.some((identity) => identity.id === id && identity.kind === 'ai'));
  if (explicit) return explicit;
  const title = (conversation.customTitle || conversation.title || '').trim().toLocaleLowerCase();
  const titleMatch = identities.find((identity) => identity.kind === 'ai' && identity.displayName.trim().toLocaleLowerCase() === title);
  if (titleMatch) return titleMatch.id;
  return identities.find((identity) => identity.kind === 'ai' && !identity.archived)?.id;
}

export function resolveAvatarVariant(identity: ChatIdentity, participant?: GroupParticipant) {
  const variantId = participant?.avatarVariantOverrideId || identity.defaultAvatarVariantId;
  return identity.avatarVariants.find((variant) => variant.id === variantId);
}

export function getGroupCollageIdentityIds(
  conversation: Conversation,
  _identities: ChatIdentity[],
): string[] {
  if (conversation.groupParticipants?.length) {
    return [...conversation.groupParticipants]
      .sort((a, b) => a.order - b.order)
      .filter((participant) => participant.identityId !== 'narrator')
      .map((participant) => participant.identityId)
      .slice(0, 4);
  }
  return (conversation.participants || [])
    .filter((participant) => participant.id !== 'narrator')
    .map((participant) => participant.id)
    .slice(0, 4);
}

/** Real member count (excludes narrator); never shrinks because identities are archived or missing — archives/absent identities render fallback tiles. */
export function getGroupCollageMemberCount(conversation: Conversation): number {
  if (conversation.groupParticipants?.length) {
    return conversation.groupParticipants.filter((participant) => participant.identityId !== 'narrator').length;
  }
  return (conversation.participants || []).filter((participant) => participant.id !== 'narrator').length;
}

export function getGroupCollageLayout(count: number): 'single' | 'split' | 'lead-stack' | 'grid' {
  if (count <= 1) return 'single';
  if (count === 2) return 'split';
  if (count === 3) return 'lead-stack';
  return 'grid';
}

export function getLegacyCollageParticipants(conversation: Conversation): ChatParticipant[] {
  return (conversation.participants || [])
    .filter((participant) => participant.id !== 'narrator')
    .slice(0, 4);
}

/** Read-time compatibility for groups saved before IndexedDB avatar assets existed. */
export function resolveGroupAvatarSource(conversation: Conversation): 'asset' | 'legacy-url' | 'collage' {
  if (conversation.avatarAssetId) return 'asset';
  if (conversation.avatarUrl) return 'legacy-url';
  return 'collage';
}

export function isDisposableDraftConversation(conversation: Conversation): boolean {
  return conversation.messages.length === 0
    && !conversation.customTitle?.trim()
    && !conversation.pinned
    && !conversation.draft?.trim()
    && !conversation.avatarAssetId
    && !conversation.avatarUrl
    && !(conversation.participantIds?.length)
    && !(conversation.groupParticipants?.length)
    && !(conversation.participants?.length);
}

export function getDuplicateDraftIds(conversations: Conversation[]): string[] {
  const latestByKind = new Set<string>();
  const disposable = [...conversations]
    .filter(isDisposableDraftConversation)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return disposable.flatMap((conversation) => {
    const kind = resolveConversationKind(conversation);
    if (!latestByKind.has(kind)) {
      latestByKind.add(kind);
      return [];
    }
    return [conversation.id];
  });
}
