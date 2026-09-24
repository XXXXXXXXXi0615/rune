import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PetExpressionId } from '@/config/checkinPetAssets';
import { MINI_OFFSET_RATIO, restoreMiniMode, type ClawdPresentationMode } from '@/features/clawdMiniMode/clawdMiniMode';
import type { CompanionPetPackId } from '@/features/companionPets/companionPetPacks';
import { ACTIVE_COMPANION_AVAILABILITY_POLICY, resolveAvailableCompanionPetPackId } from '@/features/companionPets/companionPetAvailability';

export type CompanionBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type PetExpressionMode = 'auto' | 'manual';
export type PetSuppressionReason = 'call' | 'immersive-reader' | 'keyboard' | 'modal-critical' | 'dragging' | 'resizing';

export interface NormalizedPosition { x: number; y: number }

export type ClawdPlacementState =
  | { mode: 'free' }
  | { mode: 'clock-perch'; perchId: 'home-flow-clock'; normalizedX: number };

/** Per-route display overrides (Phase: companion display simplification). */
export interface CompanionRoutePresentation { x?: number; y?: number; scale?: number; hidden?: boolean }

export interface CompanionPetPreferences {
  version: 6;
  routePresentation: Record<string, CompanionRoutePresentation>;
  selectedPetPackId: CompanionPetPackId;
  selectedVisualByPack: Partial<Record<CompanionPetPackId, string>>;
  enabled: boolean;
  manuallyHidden: boolean;
  expressionMode: PetExpressionMode;
  manualExpression?: PetExpressionId;
  bubbleEnabled: boolean;
  pinned: boolean;
  scale: number;
  position: Record<CompanionBreakpoint, NormalizedPosition>;
  presentationMode: Record<CompanionBreakpoint, ClawdPresentationMode>;
  miniOffset: Record<CompanionBreakpoint, number>;
  placement: Record<CompanionBreakpoint, ClawdPlacementState>;
}

interface CompanionPetState {
  preferences: CompanionPetPreferences;
  transientHidden: boolean;
  suppressionReasons: PetSuppressionReason[];
  setPosition: (breakpoint: CompanionBreakpoint, position: NormalizedPosition) => void;
  setSelectedPetPackId: (packId: CompanionPetPackId) => void;
  setSelectedVisual: (packId: CompanionPetPackId, visualId: string) => void;
  setPresentationMode: (breakpoint: CompanionBreakpoint, mode: ClawdPresentationMode, offset?: number) => void;
  setPlacement: (breakpoint: CompanionBreakpoint, placement: ClawdPlacementState) => void;
  resetPosition: (breakpoint: CompanionBreakpoint) => void;
  setExpression: (expression?: PetExpressionId) => void;
  setBubbleEnabled: (enabled: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setScale: (scale: number) => void;
  setPinned: (pinned: boolean) => void;
  setManuallyHidden: (hidden: boolean) => void;
  setTransientHidden: (hidden: boolean) => void;
  setSuppression: (reason: PetSuppressionReason, active: boolean) => void;
  setRoutePresentation: (routeKey: string, patch: CompanionRoutePresentation) => void;
  resetRoutePresentation: (routeKey: string) => void;
}

export const COMPANION_DEFAULT_POSITIONS: Record<CompanionBreakpoint, NormalizedPosition> = {
  desktop: { x: .94, y: .78 }, tablet: { x: .91, y: .72 }, mobile: { x: .86, y: .68 },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const normalizePosition = (value: Partial<NormalizedPosition> | undefined, fallback: NormalizedPosition) => ({
  x: clamp01(value?.x ?? fallback.x), y: clamp01(value?.y ?? fallback.y),
});

const DEFAULT_PLACEMENT: ClawdPlacementState = { mode: 'free' };

const defaults = (): CompanionPetPreferences => ({
  version: 6,
  routePresentation: {},
  selectedPetPackId: 'clawd',
  selectedVisualByPack: { clawd: 'clawd-idle', logos: 'logos-idle' },
  enabled: true,
  manuallyHidden: false,
  expressionMode: 'manual',
  manualExpression: 'idle',
  bubbleEnabled: true,
  pinned: false,
  scale: 1,
  position: { ...COMPANION_DEFAULT_POSITIONS },
  presentationMode: { desktop: 'free', tablet: 'free', mobile: 'free' },
  miniOffset: { desktop: MINI_OFFSET_RATIO, tablet: MINI_OFFSET_RATIO, mobile: MINI_OFFSET_RATIO },
  placement: { desktop: { ...DEFAULT_PLACEMENT }, tablet: { ...DEFAULT_PLACEMENT }, mobile: { ...DEFAULT_PLACEMENT } },
});

function readLegacyPosition(): NormalizedPosition | null {
  try {
    const parsed = JSON.parse(localStorage.getItem('lunartide-checkin-pet-v1') || 'null');
    const value = parsed?.state?.position;
    return value && typeof value.x === 'number' && typeof value.y === 'number'
      ? normalizePosition(value, COMPANION_DEFAULT_POSITIONS.desktop) : null;
  } catch { return null; }
}

function normalizePlacement(value: unknown): ClawdPlacementState {
  if (value && typeof value === 'object' && 'mode' in value) {
    const obj = value as { mode: string; perchId?: string; normalizedX?: number };
    if (obj.mode === 'clock-perch' && obj.perchId === 'home-flow-clock' && typeof obj.normalizedX === 'number') {
      return { mode: 'clock-perch', perchId: 'home-flow-clock', normalizedX: clamp01(obj.normalizedX) };
    }
  }
  return { mode: 'free' };
}

/** Persisted (partialized) shape of this store. */
export interface CompanionPetPersisted {
  preferences: CompanionPetPreferences;
}

/** v5 preferences: everything the current shape has except routePresentation. */
export type CompanionPetPreferencesV5 = Omit<CompanionPetPreferences, 'version' | 'routePresentation'> & { version?: number };

/** Defensive view of a v5 payload — every field may be missing. */
export interface CompanionPetPersistedV5 {
  preferences?: Partial<CompanionPetPreferencesV5> | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * v5 → v6 migration (pure, deterministic, immutable).
 * Moves persisted v5 preferences forward untouched and initialises only the
 * genuinely new v6 field (routePresentation). Nothing is reset, no second
 * store is created, and an already-v6 payload passes through unchanged.
 */
export function migrateCompanionPetPersisted(persisted: unknown, version: number): CompanionPetPersisted {
  const source = (isRecord(persisted) ? persisted : {}) as CompanionPetPersistedV5 & Partial<CompanionPetPersisted>;
  const saved = (isRecord(source.preferences) ? source.preferences : {}) as Partial<CompanionPetPreferencesV5> & Partial<CompanionPetPreferences>;

  if (version >= 6) {
    const current = saved as CompanionPetPreferences;
    return {
      preferences: {
        ...current,
        version: 6,
        routePresentation: isRecord(current.routePresentation) ? current.routePresentation : {},
      },
    };
  }

  const base = defaults();
  return {
    preferences: {
      ...base,
      ...(saved as Partial<CompanionPetPreferences>),
      version: 6,
      routePresentation: {},
    },
  };
}

export const useCompanionPetStore = create<CompanionPetState>()(persist((set) => ({
  preferences: defaults(), transientHidden: false, suppressionReasons: [],
  setSelectedPetPackId: (selectedPetPackId) => set((state) => ({ preferences: { ...state.preferences, selectedPetPackId: resolveAvailableCompanionPetPackId(selectedPetPackId, ACTIVE_COMPANION_AVAILABILITY_POLICY) } })),
  setSelectedVisual: (packId, visualId) => set((state) => ({ preferences: { ...state.preferences, selectedVisualByPack: { ...state.preferences.selectedVisualByPack, [packId]: visualId } } })),
  setPosition: (breakpoint, position) => set((state) => ({ preferences: { ...state.preferences, position: { ...state.preferences.position, [breakpoint]: normalizePosition(position, COMPANION_DEFAULT_POSITIONS[breakpoint]) } } })),
  setPresentationMode: (breakpoint, mode, offset) => set((state) => {
    const restored = restoreMiniMode(mode, offset ?? state.preferences.miniOffset[breakpoint]);
    const nextPlacement = mode !== 'free' ? { mode: 'free' as const } : state.preferences.placement[breakpoint];
    return { preferences: { ...state.preferences, presentationMode: { ...state.preferences.presentationMode, [breakpoint]: restored.mode }, miniOffset: { ...state.preferences.miniOffset, [breakpoint]: restored.offset }, placement: { ...state.preferences.placement, [breakpoint]: nextPlacement } } };
  }),
  setPlacement: (breakpoint, placement) => set((state) => {
    const nextPresentationMode = placement.mode === 'clock-perch' ? 'free' as const : state.preferences.presentationMode[breakpoint];
    return { preferences: { ...state.preferences, placement: { ...state.preferences.placement, [breakpoint]: placement }, presentationMode: { ...state.preferences.presentationMode, [breakpoint]: nextPresentationMode } } };
  }),
  resetPosition: (breakpoint) => set((state) => ({ preferences: { ...state.preferences, position: { ...state.preferences.position, [breakpoint]: COMPANION_DEFAULT_POSITIONS[breakpoint] } } })),
  setExpression: (expression) => set((state) => ({ preferences: { ...state.preferences, expressionMode: expression ? 'manual' : 'auto', manualExpression: expression } })),
  setBubbleEnabled: (bubbleEnabled) => set((state) => ({ preferences: { ...state.preferences, bubbleEnabled } })),
  setEnabled: (enabled) => set((state) => ({ preferences: { ...state.preferences, enabled, manuallyHidden: enabled ? false : state.preferences.manuallyHidden } })),
  setScale: (scale) => set((state) => ({ preferences: { ...state.preferences, scale: Math.min(1.35, Math.max(.75, scale)) } })),
  setPinned: (pinned) => set((state) => ({ preferences: { ...state.preferences, pinned } })),
  setManuallyHidden: (manuallyHidden) => set((state) => ({ preferences: { ...state.preferences, manuallyHidden } })),
  setTransientHidden: (transientHidden) => set({ transientHidden }),
  setRoutePresentation: (routeKey, patch) => set((state) => {
    const routePresentation = { ...state.preferences.routePresentation };
    routePresentation[routeKey] = { ...routePresentation[routeKey], ...patch };
    return { preferences: { ...state.preferences, routePresentation } };
  }),
  resetRoutePresentation: (routeKey) => set((state) => {
    const routePresentation = { ...state.preferences.routePresentation };
    delete routePresentation[routeKey];
    return { preferences: { ...state.preferences, routePresentation } };
  }),
  setSuppression: (reason, active) => set((state) => ({ suppressionReasons: active
    ? state.suppressionReasons.includes(reason) ? state.suppressionReasons : [...state.suppressionReasons, reason]
    : state.suppressionReasons.filter((item) => item !== reason) })),
}), {
  name: 'lunartide-companion-pet-v1', version: 6,
  migrate: (persisted, version) => migrateCompanionPetPersisted(persisted, version) as CompanionPetState,
  partialize: (state) => ({ preferences: state.preferences }),
  merge: (persisted, current) => {
    const saved = (persisted as Partial<CompanionPetState> | undefined)?.preferences;
    const legacy = typeof window !== 'undefined' ? readLegacyPosition() : null;
    const base = defaults();
    return {
      ...current,
      preferences: {
        ...base, ...saved,
        version: 6,
        routePresentation: typeof saved?.routePresentation === 'object' && saved?.routePresentation ? saved.routePresentation : {},
        expressionMode: 'manual',
        manualExpression: saved?.manualExpression ?? 'idle',
        selectedVisualByPack: { ...base.selectedVisualByPack, ...saved?.selectedVisualByPack },
        selectedPetPackId: resolveAvailableCompanionPetPackId(saved?.selectedPetPackId, ACTIVE_COMPANION_AVAILABILITY_POLICY),
        position: {
          desktop: normalizePosition(saved?.position?.desktop ?? legacy ?? undefined, base.position.desktop),
          tablet: normalizePosition(saved?.position?.tablet, base.position.tablet),
          mobile: normalizePosition(saved?.position?.mobile, base.position.mobile),
        },
        presentationMode: {
          desktop: restoreMiniMode(saved?.presentationMode?.desktop, saved?.miniOffset?.desktop).mode,
          tablet: restoreMiniMode(saved?.presentationMode?.tablet, saved?.miniOffset?.tablet).mode,
          mobile: restoreMiniMode(saved?.presentationMode?.mobile, saved?.miniOffset?.mobile).mode,
        },
        miniOffset: {
          desktop: restoreMiniMode(saved?.presentationMode?.desktop, saved?.miniOffset?.desktop).offset,
          tablet: restoreMiniMode(saved?.presentationMode?.tablet, saved?.miniOffset?.tablet).offset,
          mobile: restoreMiniMode(saved?.presentationMode?.mobile, saved?.miniOffset?.mobile).offset,
        },
        placement: {
          desktop: normalizePlacement(saved?.placement?.desktop),
          tablet: normalizePlacement(saved?.placement?.tablet),
          mobile: normalizePlacement(saved?.placement?.mobile),
        },
      },
      transientHidden: false, suppressionReasons: [],
    };
  },
  onRehydrateStorage: () => (state) => {
    // Rewrite the normalized selection so an unavailable local-only pack does
    // not remain stranded in public-build persistence after fallback.
    state?.setSelectedPetPackId(state.preferences.selectedPetPackId);
  },
}));
