import { describe, expect, it } from 'vitest';
import { resolveCheckInReactionMood } from './RuneCheckInReaction';
import { resolveRuneBrandAsset } from '@/components/branding/runeBrandAssets';

describe('Rune Check-in reaction presentation', () => {
  it('uses restrained neutral art for missing and low/ordinary mood', () => {
    expect([null, 1, 2, 3].map(resolveCheckInReactionMood)).toEqual(['neutral', 'neutral', 'neutral', 'neutral']);
  });

  it('uses one positive smug reaction without changing numeric meaning', () => {
    expect([4, 5].map(resolveCheckInReactionMood)).toEqual(['smug', 'smug']);
    expect(resolveRuneBrandAsset('smug')).toMatch(/branding\/rune\/rune-logo-smug\.png$/);
  });
});
