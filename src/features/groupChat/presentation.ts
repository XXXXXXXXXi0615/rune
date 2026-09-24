import type { ChatIdentity, Conversation } from '@/types';
import { getEffectiveGroupParticipants, type EffectiveGroupParticipant } from './participants';

export type ParticipantPresentationKind = 'self' | 'manual' | 'ai';

export const SECONDARY_LABELS = { self: '你', manual: '成員', ai: 'AI' } as const;
export type ParticipantSecondaryLabel = (typeof SECONDARY_LABELS)[ParticipantPresentationKind];

export interface GroupParticipantPresentation {
  identityId: string;
  /** Canonical display name (never rewritten for duplicates). */
  displayName: string;
  /** Visual disambiguator: 你 (canonical Self) / 成員 (manual role) / AI. */
  secondaryLabel: ParticipantSecondaryLabel;
  handle?: string;
  kind: ParticipantPresentationKind;
  /** Avatar source descriptor; components still resolve rendering via IdentityAvatar */
  avatar: {
    origin: 'custom-asset' | 'variant-asset' | 'legacy-url' | 'identity-default' | 'fallback';
    assetId?: string;
    variantId?: string;
    label: string;
  };
}

/**
 * Canonical self is `identityId === 'self'`.
 *
 * Custom manual roles are stored with `kind: 'user'` (they are user-played),
 * which historically made `legacyParticipant.isSelf` true for every one of
 * them, so every role was labelled 你. The legacy flag is only honoured when
 * the participant has no identity record at all (pure legacy data).
 */
export function resolveParticipantPresentationKind(participant: EffectiveGroupParticipant): ParticipantPresentationKind {
  const canonicalSelf = participant.identityId === 'self'
    || (!participant.identity && participant.legacyParticipant?.isSelf === true);
  if (canonicalSelf) return 'self';
  if (participant.kind === 'ai') return 'ai';
  return 'manual';
}

export function resolveAvatarSourceDescriptor(participant: EffectiveGroupParticipant): GroupParticipantPresentation['avatar'] {
  const label = participant.displayName || participant.identityId;
  if (participant.participant?.customAvatarAssetId) {
    return { origin: 'custom-asset', assetId: participant.participant.customAvatarAssetId, label };
  }
  const overrideId = participant.participant?.avatarVariantOverrideId;
  const identityVariant = overrideId
    ? participant.identity?.avatarVariants.find((variant) => variant.id === overrideId)
    : participant.identity?.avatarVariants.find((variant) => variant.id === participant.identity?.defaultAvatarVariantId);
  if (identityVariant?.assetId) {
    return { origin: 'variant-asset', assetId: identityVariant.assetId, variantId: identityVariant.id, label };
  }
  if (participant.legacyParticipant?.avatarUrl) {
    return { origin: 'legacy-url', assetId: participant.legacyParticipant.avatarUrl, label };
  }
  if (participant.identity?.avatarVariants[0]?.assetId) {
    return { origin: 'variant-asset', assetId: participant.identity.avatarVariants[0].assetId, variantId: participant.identity.avatarVariants[0].id, label };
  }
  return { origin: 'fallback', label };
}

export function resolveGroupParticipantPresentation(participant: EffectiveGroupParticipant): GroupParticipantPresentation {
  const kind = resolveParticipantPresentationKind(participant);
  return {
    identityId: participant.identityId,
    displayName: participant.displayName,
    secondaryLabel: SECONDARY_LABELS[kind],
    handle: participant.identity?.handle || participant.identity?.mentionAliases?.[0],
    kind,
    avatar: resolveAvatarSourceDescriptor(participant),
  };
}

export function resolveGroupParticipantPresentations(
  conversation: Conversation | undefined,
  identities: readonly ChatIdentity[],
): GroupParticipantPresentation[] {
  if (!conversation || conversation.kind !== 'group') return [];
  return getEffectiveGroupParticipants(conversation, identities).map(resolveGroupParticipantPresentation);
}

/** Duplicate display names are never rewritten; presentation uses secondaryLabel + handle to disambiguate. */
export function participantNeedsDisambiguation(
  presentation: GroupParticipantPresentation,
  presentations: readonly GroupParticipantPresentation[],
): boolean {
  return presentations.filter((item) => item.displayName === presentation.displayName).length > 1;
}
