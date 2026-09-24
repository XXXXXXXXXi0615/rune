import type { PetId } from '@/pets/types';
import type { CompanionEmotion } from './emotionDomain';

export type PetCompositionMode = 'layered' | 'baked';
export type PetBehaviorMode = 'automatic' | 'manual';
export type PetSceneState = 'idle' | 'happy' | 'working' | 'sleeping' | 'warning' | 'error';
export type PetPresentationCategory = 'daily' | 'work' | 'emotion' | 'movement' | 'special' | 'status' | 'http' | 'uncategorized';
export type PetLibraryCategory = 'daily' | 'work' | 'emotion' | 'activity' | 'movement' | 'http' | 'special';
export type PetPresentationRenderer = 'lunaris-animation' | 'clawd-asset' | 'sprite-atlas';
export type PetPreviewAnchor = 'center' | 'bottom';

export interface PetPresentationPreview {
  scale: number;
  offsetX?: number;
  offsetY?: number;
  anchor?: PetPreviewAnchor;
}

export interface PetBodyHitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetPresentationDefinition {
  id: string;
  label: string;
  displayName?: string;
  localizedNames?: Record<string, string>;
  categoryLabel?: string;
  libraryCategory?: PetLibraryCategory;
  searchKeywords?: string[];
  category: PetPresentationCategory;
  assetId: string;
  renderer: PetPresentationRenderer;
  format: 'static' | 'animated';
  loop: boolean;
  durationMs?: number;
  availableForManual: boolean;
  availableForAutomatic: boolean;
  reducedMotionFallbackId: string;
  preview?: PetPresentationPreview;
  aliasOf?: string;
  emotionTags?: CompanionEmotion[];
  interactionTags?: Array<'tap' | 'double-tap' | 'grabbed' | 'struggle' | 'scared' | 'released'>;
  minIntensity?: number;
  maxIntensity?: number;
  minDisplayMs?: number;
  cooldownGroup?: string;
  loopPolicy?: 'loop' | 'once' | 'hold';
  bodyHitRect?: PetBodyHitRect;
  triggerPolicy?: 'automatic' | 'manual-only' | 'agent-error-or-manual';
}

export interface PetExpressionDefinition {
  id: string;
  label: string;
  previewActionId: string;
}

export interface PetActionDefinition {
  id: string;
  label: string;
  previewAssetId: string;
  runtimeAssetId: string;
  loop: boolean;
  durationMs?: number;
  compatibleExpressionIds: string[];
  reducedMotionFallbackActionId: string;
}

export interface PetCapabilityManifest {
  petId: PetId;
  displayName: string;
  compositionMode: PetCompositionMode;
  skins: Array<{ id: string; label: string }>;
  presentations: PetPresentationDefinition[];
  expressions?: PetExpressionDefinition[];
  actions?: PetActionDefinition[];
  defaultSkinId: string;
  defaultPresentationId: string;
  defaultExpressionId?: string;
  defaultActionId?: string;
  automaticStateMap: Record<PetSceneState, string>;
  idleVariants?: string[];
}

export interface PerPetPreference {
  skinId: string;
  behaviorMode: PetBehaviorMode;
  presentationId: string;
  expressionId?: string;
  actionId?: string;
  allowTransientReactions: boolean;
  animationSpeed: number;
  randomIdleEnabled: boolean;
}

export interface PetTransientReaction {
  reactionId: string;
  startedAt: number;
  expiresAt: number;
  returnTarget: 'automatic' | 'manual';
}

export interface ResolvedPetPresentation {
  presentation: PetPresentationDefinition;
  source: 'transient' | 'scene' | 'manual' | 'fallback';
}
