import { describe, expect, it } from 'vitest';
import { availableCompanionPetPackIds, resolveAvailableCompanionPetPackId } from '../companionPets/companionPetAvailability';

describe('companion pet release availability', () => {
  it('keeps logos local-only until public approval is explicit', () => {
    expect(availableCompanionPetPackIds({ channel: 'local' })).toEqual(['clawd', 'logos']);
    expect(availableCompanionPetPackIds({ channel: 'public' })).toEqual(['clawd']);
    expect(availableCompanionPetPackIds({ channel: 'public', publicApprovals: { logos: true } })).toEqual(['clawd', 'logos']);
  });

  it('deterministically resolves unavailable or invalid selections to CLAWD', () => {
    const publicPolicy = { channel: 'public' as const };
    expect(resolveAvailableCompanionPetPackId('logos', publicPolicy)).toBe('clawd');
    expect(resolveAvailableCompanionPetPackId('unknown', publicPolicy)).toBe('clawd');
    expect(resolveAvailableCompanionPetPackId('logos', { channel: 'local' })).toBe('logos');
  });
});
