import { describe, expect, it } from 'vitest';
import { PET_REGISTRY, resolvePetAnimation, shouldRenderPet } from './petRegistry';

describe('desktop pet registry', () => {
  it('registers CLAWD and Jiyi without component-specific branching', () => {
    expect(Object.keys(PET_REGISTRY).sort()).toEqual(['clawd', 'jiyi']);
    expect(PET_REGISTRY.clawd.assetType).toBe('lunaris-animation');
    expect(PET_REGISTRY.jiyi.assetType).toBe('sprite-atlas');
  });

  it('maps semantic states and falls back to idle', () => {
    expect(resolvePetAnimation(PET_REGISTRY.jiyi, 'work')).toBe('work-calm');
    expect(resolvePetAnimation(PET_REGISTRY.clawd, 'cheer')).toBe('celebrating');
    const incomplete = { ...PET_REGISTRY.jiyi, animationMap: { ...PET_REGISTRY.jiyi.animationMap, work: '' } };
    expect(resolvePetAnimation(incomplete, 'work')).toBe('idle-calm');
  });

  it('enforces follow-scene, both and hidden placement rules', () => {
    expect(shouldRenderPet('desktop', 'follow-scene', false)).toBe(true);
    expect(shouldRenderPet('desktop', 'follow-scene', true)).toBe(false);
    expect(shouldRenderPet('tidebound', 'follow-scene', true)).toBe(true);
    expect(shouldRenderPet('desktop', 'both', true)).toBe(true);
    expect(shouldRenderPet('tidebound', 'both', true)).toBe(true);
    expect(shouldRenderPet('desktop', 'hidden', false)).toBe(false);
  });

  it('keeps desktop and TIDEBOUND scales independent', () => {
    expect(PET_REGISTRY.jiyi.desktopScale).toBe(1);
    expect(PET_REGISTRY.jiyi.tideboundSize).toEqual({ desktop: 60, mobile: 52 });
    expect(PET_REGISTRY.jiyi.settingsPreviewScale).not.toBe(PET_REGISTRY.jiyi.desktopScale);
  });

  it('defines normalized settings previews for every registered pet', () => {
    Object.values(PET_REGISTRY).forEach((pet) => {
      expect(pet.settingsPreviewScale).toBeGreaterThan(0);
      expect(pet.settingsDescription.length).toBeGreaterThan(0);
      expect(pet.tideboundSize.desktop).toBeGreaterThanOrEqual(pet.tideboundSize.mobile);
    });
  });
});
