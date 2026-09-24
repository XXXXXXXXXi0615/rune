export type PetId = 'clawd' | 'jiyi';
export type PetContext = 'desktop' | 'tidebound';
export type PetSemanticState = 'idle' | 'happy' | 'sad' | 'tired' | 'work' | 'rest' | 'sleep' | 'cheer';
export type PetPlacementMode = 'follow-scene' | 'desktop-only' | 'tidebound-only' | 'both' | 'hidden';
export type PetAssetType = 'lunaris-animation' | 'sprite-atlas';

export type PetAnimationMap = Record<PetSemanticState, string>;

export interface PetDefinition {
  id: PetId;
  displayName: string;
  assetType: PetAssetType;
  atlasId?: string;
  supportedContexts: PetContext[];
  animationMap: PetAnimationMap;
  fallbackAnimation: string;
  desktopScale: number;
  settingsDescription: string;
  settingsPreviewScale: number;
  settingsPreviewOffsetX?: number;
  settingsPreviewOffsetY?: number;
  opticalAspectRatio: number;
  previewPadding: number;
  tideboundSize: { desktop: number; mobile: number };
  tideboundAnchor: { x: number; y: number };
  tideboundVisualOffset: { x: number; y: number };
  tideboundScale: number;
  anchorX: number;
  anchorY: number;
}
