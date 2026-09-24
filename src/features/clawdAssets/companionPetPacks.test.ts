import { describe, expect, it } from 'vitest';
import { COMPANION_PET_PACKS, LOGOS_ANIMATION_CATALOG, getCompanionVisual } from '../companionPets/companionPetPacks';
import { resolveCompanionPetPresentation } from '../companionPets/companionPetRuntime';

describe('logos companion pet pack', () => {
  it('is one pack with explicit audited sprite metadata', () => {
    expect(Object.keys(COMPANION_PET_PACKS)).toEqual(['clawd', 'logos']);
    expect(COMPANION_PET_PACKS.logos.displayName).toBe('logos');
    expect(LOGOS_ANIMATION_CATALOG).toHaveLength(9);
    expect(LOGOS_ANIMATION_CATALOG.every((entry) => entry.sprite?.frameWidth === 192 && entry.sprite.frameHeight === 208)).toBe(true);
  });

  it('maps direction, failure and missing runtime semantics without CLAWD leakage', () => {
    const resolve = (semanticVisualId: string, movementDirection: 'left' | 'right' | 'neutral' = 'neutral') => resolveCompanionPetPresentation({ pack: COMPANION_PET_PACKS.logos, semanticVisualId, movementDirection }).visual.id;
    expect(resolve('reaction-drag', 'left')).toBe('logos-running-left');
    expect(resolve('reaction-drag', 'right')).toBe('logos-running-right');
    expect(resolve('error')).toBe('logos-failed');
    expect(resolve('working-building')).toBe('logos-running');
    expect(resolve('sleeping')).toBe('logos-waiting');
    expect(getCompanionVisual('logos', 'not-real').id).toBe('logos-idle');
    expect(COMPANION_PET_PACKS.logos.visuals.every((entry) => entry.src.includes('/assets/companion-pets/logos/'))).toBe(true);
  });

  it('declares readable logos playback and explicit preview restoration', () => {
    const byId = Object.fromEntries(LOGOS_ANIMATION_CATALOG.map((entry) => [entry.id, entry.sprite!]));
    expect(byId['logos-idle']).toMatchObject({ fps: 4, loop: true, startFrame: 0 });
    expect(byId['logos-waiting']).toMatchObject({ fps: 3, loop: true, previewDurationMs: 3200 });
    expect(byId['logos-waving']).toMatchObject({ fps: 4, loop: false, holdLastFrame: true, previewDurationMs: 2600, restoreAfterPreview: true });
    expect(byId['logos-jumping']).toMatchObject({ fps: 5, loop: false, holdLastFrame: true, previewDurationMs: 2800, restoreAfterPreview: true });
    expect(byId['logos-failed']).toMatchObject({ fps: 4, loop: false, holdLastFrame: true, previewDurationMs: 3600, restoreAfterPreview: true });
    expect(LOGOS_ANIMATION_CATALOG.every((entry) => entry.sprite?.frameWidth === 192 && entry.sprite.frameHeight === 208)).toBe(true);
  });

  it('uses logos-only normalization that keeps the full source silhouette inside the host viewport', () => {
    expect(COMPANION_PET_PACKS.logos.visuals.every((entry) => entry.normalization.scaleY === 1.02)).toBe(true);
    expect(COMPANION_PET_PACKS.clawd.visuals.every((entry) => entry.normalization.scaleY === 1)).toBe(true);
  });

  it('ships the CLAWD GIF library as manual lazy-loadable public assets', () => {
    const clawd = COMPANION_PET_PACKS.clawd;
    expect(clawd.visuals).toHaveLength(44);
    expect(clawd.visuals.every((entry) => entry.manualPreview && entry.src.includes('/assets/companion-pets/clawd/'))).toBe(true);
    expect(clawd.runtime.semanticMappings).toEqual({});
    expect(clawd.runtime.movementMappings).toEqual({});
  });
});
