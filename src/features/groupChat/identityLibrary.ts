import type { ChatIdentity, Conversation } from '@/types';

/** Canonical legacy/system preset ids — never auto-seeded for new installs. */
export const LEGACY_PRESET_IDS = ['lunaris', 'clawd', 'mira'] as const;

interface SeedSignature {
  bio: string;
  aliases: string[];
  displayName?: string;
}

/** Pure-seed signature per preset id. lunaris displayName tracks the partner name, so it is not part of the signature. */
const SEED_SIGNATURES: Record<string, SeedSignature> = {
  lunaris: { bio: '你的潮汐伴侶', aliases: ['lunaris', 'luna'] },
  clawd: { bio: '潮汐守護者', aliases: ['clawd'], displayName: 'CLAWD' },
  mira: { bio: '月亮觀測者', aliases: ['mira'], displayName: 'MIRA' },
};

function isUnmodifiedPreset(identity: ChatIdentity): boolean {
  const signature = SEED_SIGNATURES[identity.id];
  if (!signature) return false;
  if (identity.avatarVariants.length > 0) return false;
  if (identity.defaultAvatarVariantId) return false;
  if (identity.personaPrompt?.trim()) return false;
  if (identity.tone?.trim()) return false;
  if (identity.providerConfigId?.trim()) return false;
  if (identity.modelId?.trim()) return false;
  if (identity.bio?.trim() !== signature.bio) return false;
  const aliases = new Set(identity.mentionAliases || []);
  if (signature.aliases.length !== aliases.size || !signature.aliases.every((a) => aliases.has(a))) return false;
  if (signature.displayName && identity.displayName !== signature.displayName) return false;
  return true;
}

function isReferencedByIdentityId(conversation: Conversation, identityId: string): boolean {
  if (conversation.groupParticipants?.some((gp) => gp.identityId === identityId)) return true;
  if (conversation.participants?.some((p) => p.id === identityId)) return true;
  if (conversation.participantIds?.includes(identityId)) return true;
  return false;
}

function isReferencedByAnyConversation(identityId: string, conversations: readonly Conversation[]): boolean {
  return conversations.some((conversation) => isReferencedByIdentityId(conversation, identityId));
}

/** A legacy preset may be hidden from the default new-group library only when it remains untouched by the user and is unused by existing conversations. */
export function shouldHideFromGroupLibrary(identity: ChatIdentity, conversations: readonly Conversation[]): boolean {
  return (LEGACY_PRESET_IDS as readonly string[]).includes(identity.id)
    && isUnmodifiedPreset(identity)
    && !isReferencedByAnyConversation(identity.id, conversations);
}

/**
 * Deterministic library identity list for group creation surfaces.
 * Keeps: current Self (returned separately / synthesized), all user-created identities,
 * and legacy presets that were modified by the user or referenced by an existing conversation.
 * Pure untouched system seeds are hidden, never deleted.
 */
export function buildGroupLibraryIdentities(
  identities: readonly ChatIdentity[],
  conversations: readonly Conversation[],
): ChatIdentity[] {
  return identities.filter((identity) =>
    identity.id !== 'self'
      && !identity.archived
      && identity.kind !== 'narrator'
      && !shouldHideFromGroupLibrary(identity, conversations),
  );
}

/** ids of legacy presets referenced by existing conversations (preserve-on-rehydrate helper). */
export function referencedLegacyPresetIds(conversations: readonly Conversation[]): string[] {
  return (LEGACY_PRESET_IDS as readonly string[]).filter((id) => isReferencedByAnyConversation(id, conversations));
}
