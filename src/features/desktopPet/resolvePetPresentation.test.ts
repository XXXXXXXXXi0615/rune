import { describe, expect, it } from 'vitest';
import { CLAWD_CAPABILITY_MANIFEST, CLAWD_EXCLUDED_PRESENTATION_IDS } from './manifests/clawdManifest';
import { JIYI_CAPABILITY_MANIFEST } from './manifests/jiyiManifest';
import { defaultPetPreference, migrateLegacyPresentationId, normalizePetPreference, resolvePetPresentation } from './resolvePetPresentation';
import { CLAWD_OVERRIDE_IDS, CLAWD_RESOLVED_ASSETS, getResolvedClawdAsset } from './manifests/clawdOverrides';

describe('desktop pet presentation manifests', () => {
  it('keeps the CLAWD manual library separate from the six automatic rules', () => {
    expect(CLAWD_CAPABILITY_MANIFEST.presentations).toHaveLength(56);
    expect(CLAWD_CAPABILITY_MANIFEST.presentations.filter((item) => item.availableForManual)).toHaveLength(55);
    expect(CLAWD_CAPABILITY_MANIFEST.presentations.length).toBeGreaterThan(Object.keys(CLAWD_CAPABILITY_MANIFEST.automaticStateMap).length);
    expect(CLAWD_EXCLUDED_PRESENTATION_IDS).toEqual(['clawd-crafting-1']);
  });

  it('derives the manual library from the canonical chat sticker manifest', () => {
    expect(CLAWD_OVERRIDE_IDS.length).toBeGreaterThan(0);
    expect(getResolvedClawdAsset('clawd-happy')?.source).toBe('lunartide');
    expect(CLAWD_OVERRIDE_IDS).toEqual(CLAWD_RESOLVED_ASSETS.map((asset) => asset.id));
    expect(CLAWD_RESOLVED_ASSETS).toHaveLength(54);
  });

  it('keeps the established automatic state mapping unchanged', () => {
    expect(CLAWD_CAPABILITY_MANIFEST.automaticStateMap).toEqual({
      idle: 'clawd-idle', happy: 'clawd-happy-runtime', working: 'clawd-working-typing', sleeping: 'clawd-sleeping', warning: 'clawd-notification', error: 'clawd-error-runtime',
    });
  });

  it('keeps every audited manifest asset loadable and represented once', () => {
    const ids = CLAWD_CAPABILITY_MANIFEST.presentations.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CLAWD_CAPABILITY_MANIFEST.presentations.every((item) => item.assetId.length > 0)).toBe(true);
  });

  it('calibrates every CLAWD settings preview without changing runtime geometry', () => {
    for (const presentation of CLAWD_CAPABILITY_MANIFEST.presentations) {
      expect(presentation.preview?.scale).toBeGreaterThanOrEqual(.8);
      expect(presentation.preview?.scale).toBeLessThanOrEqual(1.8);
      expect(presentation.preview?.anchor).toBe('bottom');
    }
  });

  it.each(['clawd-working-typing', 'clawd-working-tool-calling', 'clawd-singing', 'clawd-skateboard', 'clawd-scared'])(
    'exposes the real CLAWD presentation %s for manual selection', (id) => {
      expect(CLAWD_CAPABILITY_MANIFEST.presentations.find((item) => item.id === id)).toMatchObject({ availableForManual: true });
    },
  );

  it('maps automatic states only to declared automatic presentations', () => {
    for (const id of Object.values(CLAWD_CAPABILITY_MANIFEST.automaticStateMap)) {
      expect(CLAWD_CAPABILITY_MANIFEST.presentations.find((item) => item.id === id)).toMatchObject({ availableForAutomatic: true });
    }
  });

  it('declares exactly ten real Jiyi atlas presentations', () => {
    expect(JIYI_CAPABILITY_MANIFEST.presentations.map((item) => item.assetId)).toEqual([
      'idle-calm', 'idle-happy', 'idle-sad', 'idle-tired', 'walk-calm', 'work-calm', 'cheer-happy', 'cry-sad', 'rest-calm', 'sleep-tired',
    ]);
  });

  it('migrates legacy expression/action selection to a baked presentation', () => {
    expect(migrateLegacyPresentationId(CLAWD_CAPABILITY_MANIFEST, { actionId: 'working' })).toBe('clawd-working-typing');
    expect(migrateLegacyPresentationId(JIYI_CAPABILITY_MANIFEST, { expressionId: 'tired', actionId: 'sleep' })).toBe('sleep');
    expect(normalizePetPreference(JIYI_CAPABILITY_MANIFEST, { actionId: 'missing' }).presentationId).toBe('idle');
  });

  it('automatic mode follows scene state while manual mode stays locked', () => {
    const automatic = defaultPetPreference(CLAWD_CAPABILITY_MANIFEST);
    expect(resolvePetPresentation({ manifest: CLAWD_CAPABILITY_MANIFEST, preference: automatic, sceneState: 'working' }).presentation.id).toBe('clawd-working-typing');
    const manual = normalizePetPreference(JIYI_CAPABILITY_MANIFEST, { behaviorMode: 'manual', presentationId: 'sleep' });
    expect(resolvePetPresentation({ manifest: JIYI_CAPABILITY_MANIFEST, preference: manual, sceneState: 'working' }).presentation.id).toBe('sleep');
  });

  it('restores the latest manual presentation after a temporary reaction', () => {
    const base = normalizePetPreference(JIYI_CAPABILITY_MANIFEST, { behaviorMode: 'manual', presentationId: 'sleep', allowTransientReactions: true });
    const transient = { reactionId: 'happy', startedAt: 100, expiresAt: 200, returnTarget: 'manual' as const };
    expect(resolvePetPresentation({ manifest: JIYI_CAPABILITY_MANIFEST, preference: base, sceneState: 'working', transient, now: 150 }).presentation.id).toBe('happy');
    expect(resolvePetPresentation({ manifest: JIYI_CAPABILITY_MANIFEST, preference: base, sceneState: 'working', transient, now: 250 }).presentation.id).toBe('sleep');
    expect(resolvePetPresentation({ manifest: JIYI_CAPABILITY_MANIFEST, preference: { ...base, allowTransientReactions: false }, sceneState: 'working', transient, now: 150 }).presentation.id).toBe('sleep');
  });

  it('uses the static default under reduced motion', () => {
    const preference = normalizePetPreference(JIYI_CAPABILITY_MANIFEST, { behaviorMode: 'manual', presentationId: 'cheer' });
    expect(resolvePetPresentation({ manifest: JIYI_CAPABILITY_MANIFEST, preference, sceneState: 'idle', reducedMotion: true }).presentation.id).toBe('idle');
  });
});
