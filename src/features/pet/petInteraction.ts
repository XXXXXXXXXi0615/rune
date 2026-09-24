import type { PetControlMode, PetInteraction } from '@/features/pet/types';

export const PET_INTERACTION_DURATION_MS = 2200;

export function shouldStartPetInteraction(current: PetInteraction | null, next: PetInteraction, timerActive: boolean) {
  return !(timerActive && current === next);
}

export function showManualPetControls(controlMode: PetControlMode) {
  return controlMode === 'manual';
}
