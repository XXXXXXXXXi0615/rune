import type { ClawdInteractionState } from '@/features/clawdInteraction/clawdInteraction';
import type { ClawdPresentationMode } from '@/features/clawdMiniMode/clawdMiniMode';
import type { ClawdRestState } from '@/features/clawdRest/ClawdRestController';

export type ProductionClawdAssetId =
  | 'idle' | 'static' | 'thinking' | 'working-typing' | 'working-groove' | 'working-building'
  | 'juggling' | 'error' | 'notification' | 'attention' | 'sweeping' | 'carrying'
  | 'sleeping' | 'yawning' | 'waking' | 'reaction-tap' | 'reaction-poke'
  | 'reaction-annoyed' | 'reaction-flail' | 'reaction-hold' | 'reaction-drag'
  | 'reaction-drag-left' | 'reaction-drag-right' | 'mini-idle' | 'mini-alert' | 'mini-happy' | 'mini-peek';

export interface ClawdVisualNormalization {
  scaleX: number;
  scaleY: number;
  translateX: number;
  footAnchor: number;
  visibleBounds: { left: number; top: number; right: number; bottom: number };
}

export interface ProductionClawdAsset {
  id: ProductionClawdAssetId;
  fileName: string;
  src: string;
  actualType: 'svg';
  animated: boolean;
  mode: 'full' | 'mini';
  semanticIntent: string;
  provenance: 'abderrahimghazali/clawd-pet@b208f0c';
  license: 'MIT';
  normalization: ClawdVisualNormalization;
  eyeCapability: 'body-only';
}

const ROOT = `${import.meta.env.BASE_URL}vendor/clawd-pet/pets`;
const PROVENANCE = 'abderrahimghazali/clawd-pet@b208f0c' as const;
const VISIBLE_BOUNDS: Record<string, ClawdVisualNormalization['visibleBounds']> = {
  'clawd-idle-living.svg': { left: .332, top: .688, right: .668, bottom: .91 }, 'clawd-static-base.svg': { left: .032, top: .374, right: .966, bottom: .998 },
  'clawd-working-thinking.svg': { left: .306, top: .4, right: .69, bottom: .91 }, 'clawd-working-typing.svg': { left: .344, top: .688, right: .652, bottom: .91 },
  'clawd-music.svg': { left: .31, top: .466, right: .688, bottom: .91 }, 'clawd-working-building.svg': { left: .244, top: .576, right: .756, bottom: .91 },
  'clawd-working-juggling.svg': { left: .324, top: .592, right: .674, bottom: .91 }, 'clawd-error.svg': { left: .332, top: .688, right: .668, bottom: .91 },
  'clawd-notification.svg': { left: .332, top: .688, right: .668, bottom: .91 }, 'clawd-happy.svg': { left: .31, top: .524, right: .69, bottom: .774 },
  'clawd-working-sweeping.svg': { left: .35, top: .648, right: .648, bottom: .918 }, 'clawd-working-carrying.svg': { left: .324, top: .592, right: .674, bottom: .912 },
  'clawd-sleeping.svg': { left: .286, top: .724, right: .71, bottom: .898 }, 'clawd-yawning.svg': { left: .288, top: .484, right: .71, bottom: .91 },
  'clawd-waving.svg': { left: .336, top: .688, right: .664, bottom: .91 }, 'clawd-smile.svg': { left: .332, top: .688, right: .668, bottom: .91 },
  'clawd-surprised.svg': { left: .332, top: .554, right: .668, bottom: .91 }, 'clawd-angry.svg': { left: .334, top: .576, right: .666, bottom: .91 },
  'clawd-dizzy.svg': { left: .296, top: .524, right: .704, bottom: .91 }, 'clawd-peeking.svg': { left: 0, top: .844, right: .998, bottom: .998 },
  'clawd-crab-walking.svg': { left: .332, top: .688, right: .668, bottom: .91 },
};

function normalized(fileName: string, scaleX: number, scaleY: number, footAnchor = .94): ClawdVisualNormalization {
  return { scaleX, scaleY, translateX: 0, footAnchor, visibleBounds: VISIBLE_BOUNDS[fileName] };
}

const NORMAL = (file: string) => normalized(file, 2.55, 2.78);
const COMPACT = (file: string) => normalized(file, 2.25, 2.5);
const ACTION = (file: string, scale: number) => normalized(file, scale, scale);
const SLEEP = (file: string) => normalized(file, 2.1, 3, .93);
const STATIC = (file: string) => normalized(file, .92, .98, .98);
const MINI = (file: string, footAnchor = .9) => normalized(file, 1.1, 1.1, footAnchor);

function asset(id: ProductionClawdAssetId, fileName: string, semanticIntent: string, normalization = NORMAL(fileName), mode: 'full' | 'mini' = 'full', animated = true): ProductionClawdAsset {
  return { id, fileName, src: `${ROOT}/${fileName}`, actualType: 'svg', animated, mode, semanticIntent, provenance: PROVENANCE, license: 'MIT', normalization, eyeCapability: 'body-only' };
}

export const PRODUCTION_CLAWD_ASSETS: readonly ProductionClawdAsset[] = [
  asset('idle', 'clawd-idle-living.svg', 'neutral idle'), asset('static', 'clawd-static-base.svg', 'static neutral', STATIC('clawd-static-base.svg'), 'full', false),
  asset('thinking', 'clawd-working-thinking.svg', 'thinking', ACTION('clawd-working-thinking.svg', 1.62)), asset('working-typing', 'clawd-working-typing.svg', 'single active tool'),
  asset('working-groove', 'clawd-music.svg', 'parallel groove', ACTION('clawd-music.svg', 1.78)), asset('working-building', 'clawd-working-building.svg', 'heavy building', normalized('clawd-working-building.svg', 1.9, 2.15)),
  asset('juggling', 'clawd-working-juggling.svg', 'multi-agent juggling', ACTION('clawd-working-juggling.svg', 2.25)), asset('error', 'clawd-error.svg', 'runtime failure', NORMAL('clawd-error.svg')),
  asset('notification', 'clawd-notification.svg', 'notification'), asset('attention', 'clawd-happy.svg', 'success attention', COMPACT('clawd-happy.svg')),
  asset('sweeping', 'clawd-working-sweeping.svg', 'context cleanup', ACTION('clawd-working-sweeping.svg', 2.45)), asset('carrying', 'clawd-working-carrying.svg', 'worktree carrying', ACTION('clawd-working-carrying.svg', 2.2)),
  asset('sleeping', 'clawd-sleeping.svg', 'deep sleep', SLEEP('clawd-sleeping.svg')), asset('yawning', 'clawd-yawning.svg', 'yawning', ACTION('clawd-yawning.svg', 1.8)), asset('waking', 'clawd-waving.svg', 'wake transition'),
  asset('reaction-tap', 'clawd-smile.svg', 'tap reaction'), asset('reaction-poke', 'clawd-surprised.svg', 'poke reaction', ACTION('clawd-surprised.svg', 1.95)),
  asset('reaction-annoyed', 'clawd-angry.svg', 'annoyed reaction', ACTION('clawd-angry.svg', 2.1)), asset('reaction-flail', 'clawd-dizzy.svg', 'flail reaction', ACTION('clawd-dizzy.svg', 1.85)),
  asset('reaction-hold', 'clawd-surprised.svg', 'long-press grab pose', ACTION('clawd-surprised.svg', 1.95)),
  asset('reaction-drag', 'clawd-crab-walking.svg', 'drag loop'), asset('reaction-drag-left', 'clawd-crab-walking.svg', 'left drag loop'), asset('reaction-drag-right', 'clawd-crab-walking.svg', 'right drag loop'),
  asset('mini-idle', 'clawd-idle-living.svg', 'expanded mini idle', MINI('clawd-idle-living.svg'), 'mini'), asset('mini-alert', 'clawd-notification.svg', 'mini alert', MINI('clawd-notification.svg'), 'mini'),
  asset('mini-happy', 'clawd-happy.svg', 'mini success', MINI('clawd-happy.svg', .76), 'mini'), asset('mini-peek', 'clawd-peeking.svg', 'collapsed mini peek', MINI('clawd-peeking.svg'), 'mini'),
] as const;

export type ClawdAnimationCategory = 'daily' | 'work' | 'reaction' | 'mini';

export interface ClawdAnimationCatalogEntry {
  id: ProductionClawdAssetId;
  label: string;
  category: ClawdAnimationCategory;
  asset: ProductionClawdAsset;
  runtimeState?: string;
  manualPreview: boolean;
  quickAccess: boolean;
  reducedMotionFallback: ProductionClawdAssetId;
}

const QUICK_ACCESS_IDS = new Set<ProductionClawdAssetId>(['idle', 'attention', 'reaction-poke', 'reaction-annoyed', 'reaction-flail']);

const CATALOG_METADATA: readonly [ProductionClawdAssetId, string, ClawdAnimationCategory, string?][] = [
  ['idle', '待機', 'daily', 'idle'], ['thinking', '思考', 'daily', 'thinking'], ['sleeping', '睡眠', 'daily', 'sleeping'],
  ['working-typing', '打字', 'work', 'working'], ['working-groove', '節奏', 'work', 'working'], ['working-building', '建造', 'work', 'working'],
  ['juggling', '多工', 'work', 'juggling'], ['sweeping', '清掃', 'work', 'sweeping'], ['carrying', '搬運', 'work', 'carrying'],
  ['attention', '開心', 'reaction', 'attention'], ['notification', '通知', 'reaction', 'notification'], ['error', '錯誤', 'reaction', 'error'],
  ['reaction-tap', '微笑', 'reaction'], ['reaction-poke', '驚訝', 'reaction'], ['reaction-annoyed', '生氣', 'reaction'], ['reaction-flail', '暈眩', 'reaction'],
  ['mini-idle', 'Mini 待機', 'mini'], ['mini-peek', '探頭', 'mini'], ['mini-alert', '警報', 'mini'], ['mini-happy', 'Mini 開心', 'mini'],
] as const;

/** Single production-approved catalog consumed by Settings and the quick palette. */
export const CLAWD_ANIMATION_CATALOG: readonly ClawdAnimationCatalogEntry[] = CATALOG_METADATA.map(([id, label, category, runtimeState]) => ({
  id, label, category, runtimeState, asset: PRODUCTION_CLAWD_ASSETS.find((entry) => entry.id === id)!, manualPreview: true, quickAccess: QUICK_ACCESS_IDS.has(id), reducedMotionFallback: 'static',
}));

const BY_ID = new Map(PRODUCTION_CLAWD_ASSETS.map((entry) => [entry.id, entry]));
export const PRODUCTION_CLAWD_PRESENTATION_IDS = new Set(PRODUCTION_CLAWD_ASSETS.map((entry) => entry.id));

export function getProductionClawdAsset(id: ProductionClawdAssetId): ProductionClawdAsset {
  return BY_ID.get(id) ?? BY_ID.get('static')!;
}

const RUNTIME_PRESENTATIONS: Record<string, ProductionClawdAssetId> = {
  'clawd-thinking': 'thinking', 'clawd-typing': 'working-typing', 'clawd-groove': 'working-groove', 'clawd-tool-use': 'working-building',
  'clawd-random': 'juggling', 'clawd-error': 'error', 'clawd-notification': 'notification', 'clawd-success': 'attention',
  'clawd-cleaning-system': 'sweeping', 'clawd-carrying': 'carrying', 'clawd-sleeping': 'sleeping', 'companion-neutral-static': 'static',
};
export const PRODUCTION_CLAWD_RUNTIME_PRESENTATION_IDS = new Set(Object.keys(RUNTIME_PRESENTATIONS));

const EXPRESSION_PRESENTATIONS: Record<string, ProductionClawdAssetId> = {
  idle: 'idle', waiting: 'idle', waving: 'reaction-tap', jumping: 'attention', failed: 'error', review: 'attention',
  'look-left': 'idle', 'look-right': 'idle', running: 'idle', 'running-left': 'idle', 'running-right': 'idle',
};

export interface ResolveProductionClawdInput {
  runtimePresentationId?: string;
  runtimeState: string;
  expression: string;
  interaction: ClawdInteractionState;
  restState: ClawdRestState;
  restOwnsPresentation: boolean;
  presentationMode: ClawdPresentationMode;
  miniExpanded: boolean;
  reducedMotion: boolean;
}

export function resolveProductionClawdAsset(input: ResolveProductionClawdInput): ProductionClawdAsset {
  if (input.reducedMotion) return getProductionClawdAsset('static');
  if (input.presentationMode !== 'free') {
    if (input.runtimeState === 'error' || input.runtimeState === 'notification' || input.runtimeState === 'attention') return getProductionClawdAsset('mini-alert');
    if (!input.miniExpanded) return getProductionClawdAsset('mini-peek');
    if (input.interaction.kind === 'reaction' || input.runtimeState === 'idle' && input.expression === 'jumping') return getProductionClawdAsset('mini-happy');
    return getProductionClawdAsset('mini-idle');
  }
  if (input.interaction.kind === 'held') return getProductionClawdAsset('reaction-hold');
  if (input.interaction.kind === 'dragging') return getProductionClawdAsset(input.interaction.direction === 'left' ? 'reaction-drag-left' : input.interaction.direction === 'right' ? 'reaction-drag-right' : 'reaction-drag');
  if (input.interaction.kind === 'reaction') return getProductionClawdAsset(`reaction-${input.interaction.reaction}`);
  if (input.restOwnsPresentation) {
    if (input.restState === 'sleeping') return getProductionClawdAsset('sleeping');
    if (input.restState === 'yawning') return getProductionClawdAsset('yawning');
    if (input.restState === 'waking') return getProductionClawdAsset('waking');
  }
  const runtimeAssetId = input.runtimePresentationId ? RUNTIME_PRESENTATIONS[input.runtimePresentationId] : undefined;
  if (runtimeAssetId) return getProductionClawdAsset(runtimeAssetId);
  return getProductionClawdAsset(EXPRESSION_PRESENTATIONS[input.expression] ?? 'idle');
}
