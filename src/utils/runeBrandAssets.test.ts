import { describe, expect, it } from 'vitest';
import {
  RUNE_BRAND_ASSET_MAP,
  RUNE_LOGIN_ASSETS,
  resolveRuneBrandAsset,
  resolveRuneLoginPortraitAsset,
  resolveRuneWordmarkAsset,
  type RuneBrandMood,
} from '@/components/branding/runeBrandAssets';

const MOODS: RuneBrandMood[] = [
  'neutral', 'focused', 'sleepy', 'pleased', 'annoyed',
  'smug', 'fury', 'arrogant', 'scorn', 'despise',
];

describe('Rune brand assets', () => {
  it('owns one static asset for every supported mood', () => {
    expect(Object.keys(RUNE_BRAND_ASSET_MAP)).toEqual(MOODS);
    for (const mood of MOODS) {
      expect(resolveRuneBrandAsset(mood)).toMatch(new RegExp(`branding/rune/rune-logo-${mood}\\.png$`));
    }
  });

  it('resolves neutral by default', () => {
    expect(resolveRuneBrandAsset()).toBe(RUNE_BRAND_ASSET_MAP.neutral);
  });

  it('keeps the Login wordmark behind the canonical Rune asset resolver', () => {
    expect(resolveRuneWordmarkAsset()).toMatch(/branding\/rune\/rune-wordmark\.svg$/);
  });

  it('owns every production and reference Login asset in one manifest', () => {
    expect(resolveRuneLoginPortraitAsset()).toBe(RUNE_LOGIN_ASSETS.portrait.neutral);
    expect(resolveRuneLoginPortraitAsset('soft')).toMatch(/branding\/rune\/rune-login-soft\.png$/);
    expect(RUNE_LOGIN_ASSETS.referenceBoard).toMatch(/rune-login-reference-board\.png$/);
    expect(RUNE_LOGIN_ASSETS.characterMaster).toMatch(/rune-character-master\.png$/);
    expect(RUNE_LOGIN_ASSETS.sourceWordmark).toMatch(/rune-wordmark\.png$/);
  });
});
