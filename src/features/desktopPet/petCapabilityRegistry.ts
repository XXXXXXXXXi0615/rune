import type { PetId } from '@/pets/types';
import type { PetCapabilityManifest } from './types';
import { CLAWD_CAPABILITY_MANIFEST } from './manifests/clawdManifest';
import { JIYI_CAPABILITY_MANIFEST } from './manifests/jiyiManifest';

export const PET_CAPABILITY_REGISTRY: Record<PetId, PetCapabilityManifest> = {
  clawd: CLAWD_CAPABILITY_MANIFEST,
  jiyi: JIYI_CAPABILITY_MANIFEST,
};

export const getPetCapabilityManifest = (petId: PetId) => PET_CAPABILITY_REGISTRY[petId];
