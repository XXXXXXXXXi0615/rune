import type { PetContext, PetDefinition, PetId, PetPlacementMode, PetSemanticState } from './types';

const CLAWD_ANIMATIONS: PetDefinition['animationMap'] = {
  idle: 'idle', happy: 'happy', sad: 'error', tired: 'sleepy',
  work: 'thinking', rest: 'reading', sleep: 'sleepy', cheer: 'celebrating',
};

const JIYI_ANIMATIONS: PetDefinition['animationMap'] = {
  idle: 'idle-calm', happy: 'idle-happy', sad: 'idle-sad', tired: 'idle-tired',
  work: 'work-calm', rest: 'rest-calm', sleep: 'sleep-tired', cheer: 'cheer-happy',
};

export const PET_REGISTRY: Record<PetId, PetDefinition> = {
  clawd: {
    id: 'clawd', displayName: 'CLAWD', assetType: 'lunaris-animation',
    supportedContexts: ['desktop', 'tidebound'], animationMap: CLAWD_ANIMATIONS,
    fallbackAnimation: 'idle', desktopScale: 1,
    settingsDescription: '像素感月潮夥伴，適合安靜陪伴與工作狀態。',
    settingsPreviewScale: 1.72, settingsPreviewOffsetY: -8, opticalAspectRatio: 1, previewPadding: 18,
    tideboundSize: { desktop: 220, mobile: 190 },
    tideboundAnchor: { x: .5, y: .9 }, tideboundVisualOffset: { x: 0, y: 0 }, tideboundScale: 1,
    anchorX: .5, anchorY: .88,
  },
  jiyi: {
    id: 'jiyi', displayName: '吉伊', assetType: 'sprite-atlas', atlasId: 'jiyi',
    supportedContexts: ['desktop', 'tidebound'], animationMap: JIYI_ANIMATIONS,
    fallbackAnimation: 'idle-calm', desktopScale: 1,
    settingsDescription: '柔和貼紙風桌寵，會跟隨心情與專注場景。',
    settingsPreviewScale: .82, settingsPreviewOffsetY: 2, opticalAspectRatio: .92, previewPadding: 14,
    tideboundSize: { desktop: 60, mobile: 52 },
    tideboundAnchor: { x: .5, y: .94 }, tideboundVisualOffset: { x: 0, y: -1 }, tideboundScale: 1,
    anchorX: .5, anchorY: .92,
  },
};

export const PET_DEFINITIONS = Object.values(PET_REGISTRY);

export function getPetDefinition(id?: string): PetDefinition {
  return PET_REGISTRY[id as PetId] ?? PET_REGISTRY.clawd;
}

export function resolvePetAnimation(definition: PetDefinition, semantic: PetSemanticState): string {
  return definition.animationMap[semantic] || definition.animationMap.idle || definition.fallbackAnimation;
}

export function shouldRenderPet(context: PetContext, placement: PetPlacementMode, tideboundOpen: boolean): boolean {
  if (placement === 'hidden') return false;
  if (placement === 'both') return true;
  if (placement === 'desktop-only') return context === 'desktop';
  if (placement === 'tidebound-only') return context === 'tidebound';
  return context === 'desktop' ? !tideboundOpen : tideboundOpen;
}

export function semanticFromResolved(action: string, emotion: string): PetSemanticState {
  if (action === 'work') return 'work';
  if (action === 'rest') return 'rest';
  if (action === 'sleep') return 'sleep';
  if (action === 'cheer') return 'cheer';
  if (emotion === 'happy') return 'happy';
  if (emotion === 'sad') return 'sad';
  if (emotion === 'tired') return 'tired';
  return 'idle';
}
