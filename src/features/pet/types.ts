import type { FocusRoomType } from '@/components/focus/types';

export type PetEmotion = 'happy' | 'calm' | 'sad' | 'tired';
export type PetAction = 'idle' | 'work' | 'walk' | 'cheer' | 'cry' | 'rest' | 'sleep';
export type PetControlMode = 'follow' | 'manual';
export type PetInteraction = 'pet' | 'encourage' | 'rest';
export type PetStateSource = 'interaction' | 'tidebound' | 'manual' | 'mood' | 'idle';
export type PetUserMood = 'good' | 'neutral' | 'bad';

export interface PetResolvedState {
  emotion: PetEmotion;
  action: PetAction;
  animationId: string;
  source: PetStateSource;
  expiresAt?: number;
}

export interface PetRoomPosition {
  x: number;
  y: number;
}

export type PetRoomPositions = Record<FocusRoomType, PetRoomPosition>;

export interface PetAnimationDefinition {
  frames: number[];
  fps: number;
  loop: boolean;
}

export interface PetAtlas {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frames: Array<{ index: number; row: number; column: number; empty: boolean }>;
  animations: Record<string, PetAnimationDefinition>;
}
