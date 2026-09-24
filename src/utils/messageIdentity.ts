import type { ChatIdentity, Conversation, GroupParticipant, ParticipantPresence, PresenceState, SenderSnapshot } from '@/types';

export interface EffectiveParticipantProfile {
  identityId: string;
  displayName: string;
  avatarAssetId?: string;
  avatarVariantId?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  legacyAvatarUrl?: string;
  fallbackSeed: string;
  kind: ChatIdentity['kind'];
}

export function resolveEffectiveParticipantProfile(
  identity: ChatIdentity | undefined,
  participant: GroupParticipant | undefined,
  legacyAvatarUrl?: string,
): EffectiveParticipantProfile | undefined {
  if (!identity) return undefined;
  const variantId = participant?.avatarVariantOverrideId || identity.defaultAvatarVariantId;
  const variant = identity.avatarVariants.find((item) => item.id === variantId);
  const customAssetId = participant?.customAvatarAssetId;
  return {
    identityId: identity.id,
    displayName: participant?.displayNameOverride?.trim() || identity.displayName || '聊天成員',
    avatarAssetId: customAssetId || variant?.assetId || undefined,
    avatarVariantId: customAssetId ? undefined : variant?.id,
    avatarCrop: customAssetId
      ? participant?.customAvatarCrop
      : variant ? { x: variant.cropX, y: variant.cropY, zoom: variant.zoom } : undefined,
    legacyAvatarUrl,
    fallbackSeed: identity.id,
    kind: identity.kind,
  };
}

export function resolveSenderSnapshot(
  conversation: Conversation | undefined,
  identity: ChatIdentity | undefined,
  identityId: string,
): SenderSnapshot | undefined {
  if (identityId === 'narrator') {
    return { identityId, displayName: '旁白', fallbackSeed: 'narrator', kind: 'narrator' };
  }
  const participant = conversation?.groupParticipants?.find((item) => item.identityId === identityId);
  const legacy = conversation?.participants?.find((item) => item.id === identityId);
  const profile = resolveEffectiveParticipantProfile(identity, participant, legacy?.avatarUrl);
  if (!profile) return undefined;
  return profile;
}

export function isStatusExpired(expiresAt: number | undefined, now = Date.now()): boolean {
  return typeof expiresAt === 'number' && expiresAt <= now;
}

export function resolveGroupStatus(conversation: Conversation, now = Date.now()) {
  const config = conversation.statusConfig;
  if (config?.mode === 'custom' && config.customText?.trim() && !isStatusExpired(config.expiresAt, now)) {
    return { mode: 'custom' as const, text: config.customText.trim() };
  }
  return { mode: 'auto' as const };
}

export function resolveParticipantPresence(
  participant: GroupParticipant | undefined,
  automatic: ParticipantPresence | undefined,
  now = Date.now(),
): { state: PresenceState; statusText?: string } {
  const override = participant?.presenceOverride;
  if (override?.mode === 'manual' && !isStatusExpired(override.expiresAt, now)) {
    const actual = override.state || 'offline';
    return { state: actual === 'invisible' ? 'offline' : actual, statusText: override.statusText?.trim() || undefined };
  }
  const actual = automatic?.visiblePresenceStatus || automatic?.status || 'offline';
  return { state: actual === 'invisible' ? 'offline' : actual, statusText: automatic?.customText };
}
