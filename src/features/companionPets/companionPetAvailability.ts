import { COMPANION_PET_PACKS, type CompanionPetPackId } from './companionPetPacks';

export type CompanionReleaseChannel = 'local' | 'public';

export interface CompanionPetAvailabilityPolicy {
  channel: CompanionReleaseChannel;
  publicApprovals?: Partial<Record<CompanionPetPackId, boolean>>;
}

export function availableCompanionPetPackIds(policy: CompanionPetAvailabilityPolicy): readonly CompanionPetPackId[] {
  return (Object.keys(COMPANION_PET_PACKS) as CompanionPetPackId[]).filter((id) => {
    const pack = COMPANION_PET_PACKS[id];
    if (pack.availability === 'unavailable') return false;
    if (policy.channel === 'local') return true;
    if (pack.availability === 'bundled' && pack.provenance.publicDistributionEligible) return true;
    return policy.publicApprovals?.[id] === true;
  });
}

export function resolveAvailableCompanionPetPackId(packId: unknown, policy: CompanionPetAvailabilityPolicy): CompanionPetPackId {
  const available = availableCompanionPetPackIds(policy);
  return typeof packId === 'string' && available.includes(packId as CompanionPetPackId) ? packId as CompanionPetPackId : available[0] ?? 'clawd';
}

export const ACTIVE_COMPANION_AVAILABILITY_POLICY: CompanionPetAvailabilityPolicy = {
  channel: import.meta.env.DEV || import.meta.env.VITE_COMPANION_RELEASE_CHANNEL === 'local' ? 'local' : 'public',
  publicApprovals: { logos: import.meta.env.VITE_LOGOS_PUBLIC_APPROVED === 'true' },
};

export const AVAILABLE_COMPANION_PET_PACK_IDS = availableCompanionPetPackIds(ACTIVE_COMPANION_AVAILABILITY_POLICY);

export function isCompanionPetPackAvailable(packId: CompanionPetPackId): boolean {
  return AVAILABLE_COMPANION_PET_PACK_IDS.includes(packId);
}
