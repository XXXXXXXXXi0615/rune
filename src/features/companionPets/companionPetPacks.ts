import { measuredCompanionHitBounds, type CompanionHitBounds } from './companionVisualHitBounds';

export type { CompanionHitBounds };

export interface ClawdVisualNormalization { scaleX: number; scaleY: number; translateX: number; footAnchor: number; visibleBounds: { left: number; top: number; right: number; bottom: number } }

export type CompanionPetPackId = 'clawd' | 'logos';
export type CompanionVisualId = string | LogosAnimationId;
export type CompanionPackAvailability = 'bundled' | 'local-only' | 'development-only' | 'unavailable';

export interface CompanionSpriteMetadata {
  columns: 8;
  rows: 11;
  row: number;
  frameCount: 4 | 5 | 6 | 8;
  frameWidth: 192;
  frameHeight: 208;
  fps: number;
  loop: boolean;
  startFrame: number;
  holdLastFrame: boolean;
  previewDurationMs: number;
  restoreAfterPreview: boolean;
}

export interface CompanionVisual {
  id: CompanionVisualId;
  label: string;
  src: string;
  renderer: 'image' | 'sprite';
  normalization: ClawdVisualNormalization;
  /**
   * Pointer-interaction region inside the square pet box (0..1). Measured as the
   * union of visible (>alpha 16) pixels across the animation; the transparent
   * remainder of the box stays click-through so pages behind it keep their
   * controls. See `companionVisualHitBounds.ts`.
   */
  hitBounds: CompanionHitBounds;
  mode: 'full' | 'mini';
  quickAccess: boolean;
  manualPreview: boolean;
  sprite?: CompanionSpriteMetadata;
}

export interface CompanionPetPack {
  id: CompanionPetPackId;
  displayName: string;
  assetFamily: string;
  availability: CompanionPackAvailability;
  provenance: {
    sourceType: 'upstream-repository' | 'generated';
    source: string;
    revision?: string;
    license: string;
    redistribution: 'approved' | 'restricted' | 'unknown';
    modified: boolean;
    publicDistributionEligible: boolean;
  };
  visuals: readonly CompanionVisual[];
  fallbackId: CompanionVisualId;
  runtime: {
    semanticMappings: Readonly<Record<string, CompanionVisualId>>;
    movementMappings: Readonly<Partial<Record<'left' | 'right', CompanionVisualId>>>;
    mobileFullScale?: { x: number; y: number };
  };
  settingsGroups: readonly {
    id: string;
    label: string;
    visualIds: readonly CompanionVisualId[];
  }[];
}

const LOGOS_ATLAS = `${import.meta.env.BASE_URL}assets/companion-pets/logos/spritesheet.webp`;
const LOGOS_NORMALIZATION: ClawdVisualNormalization = {
  scaleX: 1.02,
  scaleY: 1.02,
  translateX: 0,
  footAnchor: .94,
  visibleBounds: { left: .08, top: .03, right: .92, bottom: .98 },
};

export type LogosAnimationId = `logos-${'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review'}`;

type LogosPlayback = Pick<CompanionSpriteMetadata, 'fps' | 'loop' | 'holdLastFrame' | 'previewDurationMs' | 'restoreAfterPreview'>;

/**
 * Measured hit bounds when available; otherwise the pack's conservative
 * `visibleBounds` rectangle so an unmeasured visual stays fully draggable
 * instead of losing interaction.
 */
function resolveHitBounds(visualId: string, normalization: ClawdVisualNormalization): CompanionHitBounds {
  const measured = measuredCompanionHitBounds(visualId);
  if (measured) return measured;
  const { left, top, right, bottom } = normalization.visibleBounds;
  return { left, top, right, bottom };
}

function logosVisual(id: LogosAnimationId, label: string, row: number, frameCount: 4 | 5 | 6 | 8, playback: LogosPlayback, quickAccess = false): CompanionVisual {
  return {
    id, label, src: LOGOS_ATLAS, renderer: 'sprite', normalization: LOGOS_NORMALIZATION, hitBounds: resolveHitBounds(id, LOGOS_NORMALIZATION), mode: 'full',
    quickAccess, manualPreview: true,
    sprite: { columns: 8, rows: 11, row, frameCount, frameWidth: 192, frameHeight: 208, startFrame: 0, ...playback },
  };
}

export const LOGOS_ANIMATION_CATALOG: readonly CompanionVisual[] = [
  logosVisual('logos-idle', '待機', 0, 6, { fps: 4, loop: true, holdLastFrame: false, previewDurationMs: 3200, restoreAfterPreview: true }, true),
  logosVisual('logos-running-right', '向右移動', 1, 8, { fps: 8, loop: true, holdLastFrame: false, previewDurationMs: 2400, restoreAfterPreview: true }),
  logosVisual('logos-running-left', '向左移動', 2, 8, { fps: 8, loop: true, holdLastFrame: false, previewDurationMs: 2400, restoreAfterPreview: true }),
  logosVisual('logos-waving', '揮手', 3, 4, { fps: 4, loop: false, holdLastFrame: true, previewDurationMs: 2600, restoreAfterPreview: true }, true),
  logosVisual('logos-jumping', '跳躍', 4, 5, { fps: 5, loop: false, holdLastFrame: true, previewDurationMs: 2800, restoreAfterPreview: true }, true),
  logosVisual('logos-failed', '失落', 5, 8, { fps: 4, loop: false, holdLastFrame: true, previewDurationMs: 3600, restoreAfterPreview: true }, true),
  logosVisual('logos-waiting', '等待', 6, 6, { fps: 3, loop: true, holdLastFrame: false, previewDurationMs: 3200, restoreAfterPreview: true }, true),
  logosVisual('logos-running', '處理中', 7, 6, { fps: 5, loop: true, holdLastFrame: false, previewDurationMs: 2800, restoreAfterPreview: true }),
  logosVisual('logos-review', '檢視', 8, 6, { fps: 4, loop: true, holdLastFrame: false, previewDurationMs: 3000, restoreAfterPreview: true }),
] as const;

const CLAWD_GIF_FILES = [
  'clawd-idle.gif','clawd-static-base.gif','clawd-mini-clawd.gif','mini-crab-typing.gif','clawd-idle-living.gif','clawd-idle-reading.gif','clawd-sleeping.gif','clawd-bubble.gif',
  'clawd-happy.gif','clawd-react-annoyed.gif','clawd-react-double-jump.gif','clawd-dizzy.gif','clawd-error.gif','clawd-notification.gif','clawd-disconnected.gif',
  'clawd-thinking.gif','clawd-typing.gif','clawd-coding.gif','clawd-debugger.gif','clawd-building.gif','clawd-carrying.gif','clawd-conducting.gif','clawd-exercise.gif','clawd-guitar.gif','clawd-headphones-groove.gif','clawd-juggling.gif','clawd-painting.gif','clawd-photo.gif','clawd-sweeping.gif',
  'clawd-working-debugger.gif','clawd-working-juggling.gif','clawd-working-pushing.gif','clawd-working-conducting.gif','clawd-working-confused.gif','clawd-working-sweeping.gif','clawd-working-carrying.gif','clawd-working-typing.gif','clawd-working-overheated.gif','clawd-working-wizard.gif','clawd-working-building.gif','clawd-working-thinking.gif','clawd-working-beacon.gif','clawd-crab-walking.gif','clawd-going-away.gif',
] as const;
const CLAWD_NORMALIZATION: ClawdVisualNormalization = { scaleX: 1, scaleY: 1, translateX: 0, footAnchor: .94, visibleBounds: { left: .04, top: .02, right: .96, bottom: .98 } };
const labelFor = (file: string) => file.replace(/\.(gif|svg)$/,'').replace(/^clawd-/,'').replace(/^working-/,'工作 · ').replaceAll('-',' ');
const CLAWD_VISUALS: readonly CompanionVisual[] = CLAWD_GIF_FILES.map((file, index) => ({
  id: file.replace(/\.(gif|svg)$/,''), label: labelFor(file), src: `${import.meta.env.BASE_URL}assets/companion-pets/clawd/${file}`,
  renderer: 'image', normalization: CLAWD_NORMALIZATION, hitBounds: resolveHitBounds(file.replace(/\.(gif|svg)$/,''), CLAWD_NORMALIZATION), mode: file.includes('mini') ? 'mini' : 'full', quickAccess: index < 8, manualPreview: true,
}));
const CLAWD_SETTINGS_GROUPS = [
  { id: 'calm', label: '日常', visualIds: CLAWD_VISUALS.slice(0, 8).map((item) => item.id) },
  { id: 'emotion', label: '表情', visualIds: CLAWD_VISUALS.slice(8, 16).map((item) => item.id) },
  { id: 'activity', label: '活動', visualIds: CLAWD_VISUALS.slice(16, 30).map((item) => item.id) },
  { id: 'work', label: '工作', visualIds: CLAWD_VISUALS.slice(30).map((item) => item.id) },
] as const;

const LOGOS_SEMANTIC_MAPPINGS: Readonly<Record<string, LogosAnimationId>> = {
  error: 'logos-failed', 'reaction-annoyed': 'logos-failed',
  attention: 'logos-jumping', 'reaction-poke': 'logos-jumping', 'reaction-flail': 'logos-jumping',
  notification: 'logos-waving', 'reaction-tap': 'logos-waving', waking: 'logos-waving',
  thinking: 'logos-review', 'working-typing': 'logos-running', 'working-groove': 'logos-running',
  'working-building': 'logos-running', juggling: 'logos-running', sweeping: 'logos-running', carrying: 'logos-running',
  sleeping: 'logos-waiting', yawning: 'logos-waiting',
  'mini-alert': 'logos-waving', 'mini-happy': 'logos-jumping', 'mini-idle': 'logos-idle', 'mini-peek': 'logos-idle',
};

export const COMPANION_PET_PACKS: Record<CompanionPetPackId, CompanionPetPack> = {
  clawd: {
    id: 'clawd', displayName: 'CLAWD', assetFamily: 'clawd-pet-mit', availability: 'bundled',
    provenance: { sourceType: 'upstream-repository', source: 'abderrahimghazali/clawd-pet', revision: 'b208f0c', license: 'MIT', redistribution: 'approved', modified: true, publicDistributionEligible: true },
    visuals: CLAWD_VISUALS, fallbackId: 'clawd-idle',
    runtime: { semanticMappings: {}, movementMappings: {}, mobileFullScale: { x: 1.08, y: 1.18 } },
    settingsGroups: CLAWD_SETTINGS_GROUPS,
  },
  logos: {
    id: 'logos', displayName: 'logos', assetFamily: 'logos-generated-v2', availability: 'local-only',
    provenance: { sourceType: 'generated', source: 'project-specific image-generation pipeline', license: 'project record required', redistribution: 'unknown', modified: false, publicDistributionEligible: false },
    visuals: LOGOS_ANIMATION_CATALOG, fallbackId: 'logos-idle',
    runtime: { semanticMappings: LOGOS_SEMANTIC_MAPPINGS, movementMappings: { left: 'logos-running-left', right: 'logos-running-right' } },
    settingsGroups: [{ id: 'logos', label: 'logos', visualIds: LOGOS_ANIMATION_CATALOG.map((entry) => entry.id) }],
  },
};

export function getCompanionVisual(packId: CompanionPetPackId, id: string | undefined): CompanionVisual {
  const pack = COMPANION_PET_PACKS[packId];
  return pack.visuals.find((visual) => visual.id === id) ?? pack.visuals.find((visual) => visual.id === pack.fallbackId) ?? pack.visuals[0];
}
