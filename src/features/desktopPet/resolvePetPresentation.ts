import type { PerPetPreference, PetCapabilityManifest, PetPresentationDefinition, PetSceneState, PetTransientReaction, ResolvedPetPresentation } from './types';

const LEGACY_PRESENTATION_MAP: Record<string, Record<string, string>> = {
  clawd: { idle: 'clawd-idle', happy: 'clawd-happy', working: 'clawd-working-typing', sleeping: 'clawd-sleeping', warning: 'clawd-notification', error: 'clawd-error-runtime' },
  jiyi: { idle: 'idle', happy: 'happy', sad: 'sad', tired: 'tired', walk: 'walk', work: 'work', cheer: 'cheer', cry: 'cry', rest: 'rest', sleep: 'sleep' },
};

export function migrateLegacyPresentationId(manifest: PetCapabilityManifest, value?: Partial<PerPetPreference>): string {
  const direct = value?.presentationId;
  if (direct && manifest.presentations.some((item) => item.id === direct)) return direct;
  const legacyId = value?.actionId || value?.expressionId;
  const migrated = legacyId ? LEGACY_PRESENTATION_MAP[manifest.petId]?.[legacyId] : undefined;
  return migrated && manifest.presentations.some((item) => item.id === migrated) ? migrated : manifest.defaultPresentationId;
}

export function defaultPetPreference(manifest: PetCapabilityManifest): PerPetPreference {
  return { skinId: manifest.defaultSkinId, behaviorMode: 'automatic', presentationId: manifest.defaultPresentationId, allowTransientReactions: true, animationSpeed: 1, randomIdleEnabled: false };
}

export function normalizePetPreference(manifest: PetCapabilityManifest, value?: Partial<PerPetPreference>): PerPetPreference {
  const fallback = defaultPetPreference(manifest);
  return {
    ...fallback,
    ...value,
    skinId: manifest.skins.some((item) => item.id === value?.skinId) ? value!.skinId! : fallback.skinId,
    presentationId: migrateLegacyPresentationId(manifest, value),
    animationSpeed: Math.min(1.5, Math.max(.5, value?.animationSpeed ?? 1)),
  };
}

function findPresentation(manifest: PetCapabilityManifest, id?: string): PetPresentationDefinition {
  return manifest.presentations.find((item) => item.id === id)
    ?? manifest.presentations.find((item) => item.id === manifest.defaultPresentationId)
    ?? manifest.presentations[0];
}

export function resolvePetPresentation(input: { manifest: PetCapabilityManifest; preference: PerPetPreference; sceneState: PetSceneState; transient?: PetTransientReaction | null; now?: number; reducedMotion?: boolean }): ResolvedPetPresentation {
  const { manifest, sceneState, transient, reducedMotion } = input;
  const preference = normalizePetPreference(manifest, input.preference);
  const activeTransient = transient && transient.expiresAt > (input.now ?? Date.now()) && (preference.behaviorMode === 'automatic' || preference.allowTransientReactions);
  const requestedId = activeTransient ? transient.reactionId : preference.behaviorMode === 'manual' ? preference.presentationId : manifest.automaticStateMap[sceneState];
  let presentation = findPresentation(manifest, requestedId);
  if (reducedMotion) presentation = findPresentation(manifest, presentation.reducedMotionFallbackId);
  return { presentation, source: activeTransient ? 'transient' : preference.behaviorMode === 'manual' ? 'manual' : requestedId ? 'scene' : 'fallback' };
}
