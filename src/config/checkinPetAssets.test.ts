import { describe, expect, it } from 'vitest';
import { COMPANION_PET_EXPRESSION_MANIFEST, COMPANION_PET_REDUCED_MOTION_ASSET, getExpressionAssetSrc } from './checkinPetAssets';

describe('checkinPetAssets — production CLAWD migration', () => {
  it('palette manifest contains only manual-safe expressions', () => {
    const ids = COMPANION_PET_EXPRESSION_MANIFEST.map((item) => item.id);
    expect(ids).toEqual(['idle', 'jumping', 'waving', 'failed', 'review']);
  });

  it('every palette item maps to a production CLAWD asset', () => {
    for (const item of COMPANION_PET_EXPRESSION_MANIFEST) {
      expect(item.productionAssetId).toBeTruthy();
      expect(item.src).toContain('/vendor/clawd-pet/pets/');
    }
  });

  it('no palette item references legacy checkin-pet assets', () => {
    for (const item of COMPANION_PET_EXPRESSION_MANIFEST) {
      expect(item.src).not.toContain('/assets/checkin-pet/');
      expect(item.src).not.toContain('.gif');
    }
  });

  it('reduced motion asset uses production CLAWD static', () => {
    expect(COMPANION_PET_REDUCED_MOTION_ASSET).toContain('/vendor/clawd-pet/pets/');
    expect(COMPANION_PET_REDUCED_MOTION_ASSET).not.toContain('/assets/checkin-pet/');
  });

  it('getExpressionAssetSrc returns production asset for all manifest items', () => {
    for (const item of COMPANION_PET_EXPRESSION_MANIFEST) {
      const src = getExpressionAssetSrc(item.id);
      expect(src).toContain('/vendor/clawd-pet/pets/');
      expect(src).not.toContain('/assets/checkin-pet/');
    }
  });

  it('every palette item has a non-empty label', () => {
    for (const item of COMPANION_PET_EXPRESSION_MANIFEST) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
