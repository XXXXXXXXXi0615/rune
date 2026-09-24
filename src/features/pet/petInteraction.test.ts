import { describe, expect, it } from 'vitest';
import { PET_INTERACTION_DURATION_MS, shouldStartPetInteraction, showManualPetControls } from '@/features/pet/petInteraction';

describe('pet interaction presentation', () => {
  it('uses one 2.2 second transient window', () => {
    expect(PET_INTERACTION_DURATION_MS).toBe(2200);
    expect(shouldStartPetInteraction('pet', 'pet', true)).toBe(false);
    expect(shouldStartPetInteraction('pet', 'encourage', true)).toBe(true);
    expect(shouldStartPetInteraction(null, 'rest', false)).toBe(true);
  });

  it('only exposes detailed controls in manual mode', () => {
    expect(showManualPetControls('follow')).toBe(false);
    expect(showManualPetControls('manual')).toBe(true);
  });
});
