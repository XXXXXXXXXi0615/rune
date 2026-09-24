import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FocusRoomType } from '@/components/focus/types';
import type { PetAction, PetControlMode, PetEmotion, PetRoomPosition, PetRoomPositions } from '@/features/pet/types';
import { PET_ROOM_LAYOUTS } from '@/features/pet/petRoomLayout';
import type { PetId, PetPlacementMode } from '@/pets/types';
import { getPetDefinition } from '@/pets/petRegistry';
import type { PerPetPreference } from '@/features/desktopPet/types';
import { getPetCapabilityManifest } from '@/features/desktopPet/petCapabilityRegistry';
import { defaultPetPreference, normalizePetPreference } from '@/features/desktopPet/resolvePetPresentation';
import type { PetNormalizedPosition } from '@/features/desktopPet/PetWalkableAreaResolver';
import { DEFAULT_PET_CONTEXT_SETTINGS, type PetContextSettings } from '@/features/desktopPet/PetAmbientContext';

const DEFAULT_POSITIONS: PetRoomPositions = {
  computer: PET_ROOM_LAYOUTS.computer.desktop.initialPosition,
  coffee: PET_ROOM_LAYOUTS.coffee.desktop.initialPosition,
  toilet: PET_ROOM_LAYOUTS.toilet.desktop.initialPosition,
  bed: PET_ROOM_LAYOUTS.bed.desktop.initialPosition,
};

/** Preview override with ownership metadata for safe cleanup. */
export interface PetPreviewOverride {
  presentationId: string;
  source: string;
  requestId: string;
  createdAt: number;
  expiresAt: number;
}

interface PetStoreState {
  manualPreviewOverrides: Partial<Record<PetId, PetPreviewOverride>>;
  interactionPreferences: PetInteractionPreferences;
  selectedPetId: PetId;
  placementMode: PetPlacementMode;
  animationEnabled: boolean;
  dialogAvoidance: boolean;
  controlMode: PetControlMode;
  manualEmotion: PetEmotion;
  manualAction: PetAction;
  roomPositions: PetRoomPositions;
  roomPositionsByPet: Partial<Record<PetId, PetRoomPositions>>;
  desktopPositions: Partial<Record<PetId, PetRoomPosition>>;
  normalizedPositionsByPet: Partial<Record<PetId, Partial<Record<'desktop' | 'tidebound', PetNormalizedPosition>>>>;
  positionMigrationCount: number;
  autoMovementPaused: boolean;
  contextSettings: PetContextSettings;
  petPreferences: Record<PetId, PerPetPreference>;
  favoritePresentationIdsByPet: Record<PetId, string[]>;
  recentPresentationIdsByPet: Record<PetId, string[]>;
  setSelectedPetId: (petId: PetId) => void;
  setPlacementMode: (mode: PetPlacementMode) => void;
  setAnimationEnabled: (enabled: boolean) => void;
  setDialogAvoidance: (enabled: boolean) => void;
  setControlMode: (mode: PetControlMode) => void;
  setManualEmotion: (emotion: PetEmotion) => void;
  setManualAction: (action: PetAction) => void;
  setRoomPosition: (roomId: FocusRoomType, position: PetRoomPosition, petId?: PetId) => void;
  resetRoomPosition: (roomId: FocusRoomType, petId?: PetId) => void;
  setDesktopPosition: (petId: PetId, position: PetRoomPosition) => void;
  resetDesktopPosition: (petId?: PetId) => void;
  setNormalizedPosition: (petId: PetId, context: 'desktop' | 'tidebound', position: PetNormalizedPosition) => void;
  migrateLegacyDesktopPosition: (petId: PetId, position: PetNormalizedPosition) => void;
  setAutoMovementPaused: (paused: boolean) => void;
  setContextSettings: (settings: PetContextSettings) => void;
  setInteractionPreferences: (preferences: PetInteractionPreferences) => void;
  setPetPreference: (petId: PetId, preference: PerPetPreference) => void;
  applyDesktopPetSettings: (draft: {
    selectedPetId: PetId;
    placementMode: PetPlacementMode;
    animationEnabled: boolean;
    dialogAvoidance: boolean;
    preference: PerPetPreference;
  }) => void;
  togglePresentationFavorite: (petId: PetId, presentationId: string) => void;
  markPresentationUsed: (petId: PetId, presentationId: string) => void;
  previewPresentation: (petId: PetId, presentationId: string, durationMs?: number, source?: string, requestId?: string) => void;
  clearPreviewPresentation: (petId: PetId, source: string, requestId: string) => void;
  pinPresentation: (petId: PetId, presentationId: string) => void;
  lockPresentation: (petId: PetId, presentationId: string) => void;
  unlockPresentation: (petId: PetId) => void;
  clearExpiredPresentationPreviews: (now?: number) => void;
  resetCurrentPet: () => void;
}

export interface PetInteractionPreferences {
  emotionMode: 'ai' | 'auto-interaction' | 'manual'; aiControlEnabled: boolean; clickReactions: boolean; allowGrab: boolean;
  struggleIntensity: 'off' | 'light' | 'visible'; repeatTapReaction: boolean; haptics: boolean; reduceMotion: boolean; allowInteractionAwareness: boolean;
  allowSidebarOverlap: boolean;
  /** Phase 1.1: When 'locked', the manual presentation is absolute — no behavior/context/agent auto-switch. */
  manualPresentationMode: 'default' | 'locked';
}
export const DEFAULT_PET_INTERACTION_PREFERENCES: PetInteractionPreferences = { emotionMode: 'auto-interaction', aiControlEnabled: true, clickReactions: true, allowGrab: true, struggleIntensity: 'light', repeatTapReaction: true, haptics: true, reduceMotion: false, allowInteractionAwareness: false, allowSidebarOverlap: true, manualPresentationMode: 'default' };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const usePetStore = create<PetStoreState>()(persist((set) => ({
  selectedPetId: 'clawd',
  placementMode: 'follow-scene',
  animationEnabled: true,
  dialogAvoidance: true,
  controlMode: 'follow',
  manualEmotion: 'calm',
  manualAction: 'idle',
  roomPositions: DEFAULT_POSITIONS,
  roomPositionsByPet: { jiyi: DEFAULT_POSITIONS },
  desktopPositions: {},
  normalizedPositionsByPet: {},
  positionMigrationCount: 0,
  autoMovementPaused: false,
  contextSettings: DEFAULT_PET_CONTEXT_SETTINGS,
  interactionPreferences: DEFAULT_PET_INTERACTION_PREFERENCES,
  petPreferences: { clawd: defaultPetPreference(getPetCapabilityManifest('clawd')), jiyi: defaultPetPreference(getPetCapabilityManifest('jiyi')) },
  favoritePresentationIdsByPet: { clawd: [], jiyi: [] },
  recentPresentationIdsByPet: { clawd: [], jiyi: [] },
  manualPreviewOverrides: {},
  setSelectedPetId: (selectedPetId) => set({ selectedPetId }),
  setPlacementMode: (placementMode) => set({ placementMode }),
  setAnimationEnabled: (animationEnabled) => set({ animationEnabled }),
  setDialogAvoidance: (dialogAvoidance) => set({ dialogAvoidance }),
  setControlMode: (controlMode) => set({ controlMode }),
  setManualEmotion: (manualEmotion) => set({ manualEmotion }),
  setManualAction: (manualAction) => set({ manualAction }),
  setRoomPosition: (roomId, position, petId) => set((state) => {
    const id = petId ?? state.selectedPetId;
    const current = state.roomPositionsByPet[id] ?? DEFAULT_POSITIONS;
    const next = { ...current, [roomId]: { x: clamp01(position.x), y: clamp01(position.y) } };
    return { roomPositions: id === state.selectedPetId ? next : state.roomPositions, roomPositionsByPet: { ...state.roomPositionsByPet, [id]: next } };
  }),
  resetRoomPosition: (roomId, petId) => set((state) => {
    const id = petId ?? state.selectedPetId;
    const definition = getPetDefinition(id);
    const fallback = { x: definition.anchorX, y: definition.anchorY };
    const current = state.roomPositionsByPet[id] ?? DEFAULT_POSITIONS;
    const next = { ...current, [roomId]: fallback };
    return { roomPositions: id === state.selectedPetId ? next : state.roomPositions, roomPositionsByPet: { ...state.roomPositionsByPet, [id]: next } };
  }),
  setDesktopPosition: (petId, position) => set((state) => ({ desktopPositions: { ...state.desktopPositions, [petId]: position } })),
  resetDesktopPosition: (petId) => set((state) => {
    const id = petId ?? state.selectedPetId;
    const next = { ...state.desktopPositions };
    delete next[id];
    const normalized = { ...state.normalizedPositionsByPet };
    delete normalized[id];
    return { desktopPositions: next, normalizedPositionsByPet: normalized };
  }),
  setNormalizedPosition: (petId, context, position) => set((state) => ({ normalizedPositionsByPet: { ...state.normalizedPositionsByPet, [petId]: { ...state.normalizedPositionsByPet[petId], [context]: { x: clamp01(position.x), y: clamp01(position.y), anchor: position.anchor } } } })),
  migrateLegacyDesktopPosition: (petId, position) => set((state) => { const legacy = { ...state.desktopPositions }; delete legacy[petId]; return { desktopPositions: legacy, normalizedPositionsByPet: { ...state.normalizedPositionsByPet, [petId]: { ...state.normalizedPositionsByPet[petId], desktop: position } }, positionMigrationCount: state.positionMigrationCount + 1 }; }),
  setAutoMovementPaused: (autoMovementPaused) => set({ autoMovementPaused }),
  setContextSettings: (contextSettings) => set({ contextSettings }),
  setInteractionPreferences: (interactionPreferences) => set({ interactionPreferences }),
  setPetPreference: (petId, preference) => set((state) => ({ petPreferences: { ...state.petPreferences, [petId]: normalizePetPreference(getPetCapabilityManifest(petId), preference) } })),
  applyDesktopPetSettings: (draft) => set((state) => ({
    selectedPetId: draft.selectedPetId,
    placementMode: draft.placementMode,
    animationEnabled: draft.animationEnabled,
    dialogAvoidance: draft.dialogAvoidance,
    petPreferences: {
      ...state.petPreferences,
      [draft.selectedPetId]: normalizePetPreference(getPetCapabilityManifest(draft.selectedPetId), draft.preference),
    },
    recentPresentationIdsByPet: {
      ...state.recentPresentationIdsByPet,
      [draft.selectedPetId]: [
        draft.preference.presentationId,
        ...(state.recentPresentationIdsByPet[draft.selectedPetId] || []).filter((id) => id !== draft.preference.presentationId),
      ].slice(0, 12),
    },
  })),
  togglePresentationFavorite: (petId, presentationId) => set((state) => {
    const current = state.favoritePresentationIdsByPet[petId] || [];
    const next = current.includes(presentationId) ? current.filter((id) => id !== presentationId) : [presentationId, ...current];
    return { favoritePresentationIdsByPet: { ...state.favoritePresentationIdsByPet, [petId]: next } };
  }),
  markPresentationUsed: (petId, presentationId) => set((state) => ({
    recentPresentationIdsByPet: {
      ...state.recentPresentationIdsByPet,
      [petId]: [presentationId, ...(state.recentPresentationIdsByPet[petId] || []).filter((id) => id !== presentationId)].slice(0, 12),
    },
  })),
  previewPresentation: (petId, presentationId, durationMs = 15_000, source = 'unknown', requestId = crypto.randomUUID()) => set((state) => ({ manualPreviewOverrides: { ...state.manualPreviewOverrides, [petId]: { presentationId: normalizePetPreference(getPetCapabilityManifest(petId), { presentationId }).presentationId, source, requestId, createdAt: Date.now(), expiresAt: Date.now() + durationMs } } })),
  clearPreviewPresentation: (petId, source, requestId) => set((state) => {
    const existing = state.manualPreviewOverrides[petId];
    if (!existing) return state;
    // Only clear if source and requestId match (ownership check)
    if (existing.source === source && existing.requestId === requestId) {
      return { manualPreviewOverrides: { ...state.manualPreviewOverrides, [petId]: undefined } };
    }
    return state;
  }),
  pinPresentation: (petId, presentationId) => set((state) => ({ petPreferences: { ...state.petPreferences, [petId]: normalizePetPreference(getPetCapabilityManifest(petId), { ...state.petPreferences[petId], behaviorMode: 'manual', presentationId }) }, interactionPreferences: { ...state.interactionPreferences, emotionMode: 'manual' }, manualPreviewOverrides: { ...state.manualPreviewOverrides, [petId]: undefined } })),
  lockPresentation: (petId, presentationId) => set((state) => ({ petPreferences: { ...state.petPreferences, [petId]: normalizePetPreference(getPetCapabilityManifest(petId), { ...state.petPreferences[petId], behaviorMode: 'manual', presentationId }) }, interactionPreferences: { ...state.interactionPreferences, emotionMode: 'manual', manualPresentationMode: 'locked' }, manualPreviewOverrides: { ...state.manualPreviewOverrides, [petId]: undefined } })),
  unlockPresentation: (petId) => set((state) => ({ interactionPreferences: { ...state.interactionPreferences, manualPresentationMode: 'default' } })),
  clearExpiredPresentationPreviews: (now = Date.now()) => set((state) => ({ manualPreviewOverrides: Object.fromEntries(Object.entries(state.manualPreviewOverrides).filter(([, value]) => value && value.expiresAt > now)) as PetStoreState['manualPreviewOverrides'] })),
  resetCurrentPet: () => set((state) => {
    const definition = getPetDefinition(state.selectedPetId);
    const roomPositions = Object.fromEntries((Object.keys(DEFAULT_POSITIONS) as FocusRoomType[]).map((roomId) => [roomId, { x: definition.anchorX, y: definition.anchorY }])) as PetRoomPositions;
    return {
      controlMode: 'follow', manualEmotion: 'calm', manualAction: 'idle',
      roomPositions,
      roomPositionsByPet: { ...state.roomPositionsByPet, [state.selectedPetId]: roomPositions },
      desktopPositions: { ...state.desktopPositions, [state.selectedPetId]: undefined },
      normalizedPositionsByPet: { ...state.normalizedPositionsByPet, [state.selectedPetId]: undefined },
      petPreferences: { ...state.petPreferences, [state.selectedPetId]: defaultPetPreference(getPetCapabilityManifest(state.selectedPetId)) },
    };
  }),
}), {
  name: 'lunartide-tidebound-pet',
  version: 8,
  partialize: (state) => ({
    selectedPetId: state.selectedPetId,
    placementMode: state.placementMode,
    animationEnabled: state.animationEnabled,
    dialogAvoidance: state.dialogAvoidance,
    controlMode: state.controlMode,
    manualEmotion: state.manualEmotion,
    manualAction: state.manualAction,
    roomPositions: state.roomPositions,
    roomPositionsByPet: state.roomPositionsByPet,
    desktopPositions: state.desktopPositions,
    normalizedPositionsByPet: state.normalizedPositionsByPet,
    positionMigrationCount: state.positionMigrationCount,
    autoMovementPaused: state.autoMovementPaused,
    contextSettings: state.contextSettings,
    interactionPreferences: state.interactionPreferences,
    petPreferences: state.petPreferences,
    favoritePresentationIdsByPet: state.favoritePresentationIdsByPet,
    recentPresentationIdsByPet: state.recentPresentationIdsByPet,
  }),
  migrate: (persisted, version) => {
    const saved = (persisted || {}) as Record<string, unknown>;
    // v6 → v7: remove desktopScale / scale / enabled; all old values → fixed 2.5
    if (version < 7) {
      delete saved.desktopScale;
      delete saved.scale;
      delete saved.enabled;
    }
    return saved;
  },
  merge: (persisted, current) => {
    const saved = (persisted || {}) as Partial<PetStoreState>;
    return {
      ...current,
      ...saved,
      selectedPetId: saved.selectedPetId && ['clawd', 'jiyi'].includes(saved.selectedPetId) ? saved.selectedPetId : 'clawd',
      placementMode: saved.placementMode || 'follow-scene',
      roomPositions: { ...DEFAULT_POSITIONS, ...(saved.roomPositions || {}) },
      roomPositionsByPet: saved.roomPositionsByPet || { jiyi: { ...DEFAULT_POSITIONS, ...(saved.roomPositions || {}) } },
      desktopPositions: saved.desktopPositions || {},
      normalizedPositionsByPet: saved.normalizedPositionsByPet || {},
      positionMigrationCount: saved.positionMigrationCount || 0,
      autoMovementPaused: saved.autoMovementPaused || false,
      contextSettings: { ...DEFAULT_PET_CONTEXT_SETTINGS, ...(saved.contextSettings || {}) },
      interactionPreferences: { ...DEFAULT_PET_INTERACTION_PREFERENCES, ...(saved.interactionPreferences || {}) },
      favoritePresentationIdsByPet: saved.favoritePresentationIdsByPet || { clawd: [], jiyi: [] },
      recentPresentationIdsByPet: saved.recentPresentationIdsByPet || { clawd: [], jiyi: [] },
      manualPreviewOverrides: {},
      petPreferences: {
        clawd: normalizePetPreference(getPetCapabilityManifest('clawd'), saved.petPreferences?.clawd ?? {
          behaviorMode: saved.controlMode === 'manual' ? 'manual' : 'automatic',
          expressionId: saved.manualEmotion === 'happy' ? 'happy' : saved.manualEmotion === 'tired' ? 'sleepy' : saved.manualEmotion === 'sad' ? 'error' : 'default',
          actionId: saved.manualAction === 'work' ? 'working' : saved.manualAction === 'sleep' ? 'sleeping' : 'idle',
        } as Partial<PerPetPreference>),
        jiyi: normalizePetPreference(getPetCapabilityManifest('jiyi'), saved.petPreferences?.jiyi ?? {
          behaviorMode: saved.controlMode === 'manual' ? 'manual' : 'automatic',
          expressionId: saved.manualEmotion === 'happy' ? 'happy' : saved.manualEmotion === 'tired' ? 'tired' : saved.manualEmotion === 'sad' ? 'sad' : 'default',
          actionId: saved.manualAction ?? 'idle',
        } as Partial<PerPetPreference>),
      },
    };
  },
}));
