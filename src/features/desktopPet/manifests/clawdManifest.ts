import { CLAWD_RESOLVED_ASSETS, type ResolvedClawdAsset } from './clawdOverrides';
import type { PetCapabilityManifest, PetPresentationDefinition } from '../types';
import { localizeClawdPresentation } from './clawdPresentationLabels';
import { emotionMetadataFor } from '../presentationEmotionMetadata';

const EXCLUDED_IDS = new Set(['clawd-crafting-1']);
const WIDE_PREVIEW_IDS = new Set(['clawd-climbing', 'clawd-peeking', 'clawd-skateboard', 'clawd-dragon-boat', 'clawd-guitar']);
const TALL_PREVIEW_IDS = new Set(['clawd-astronaut', 'clawd-chef', 'clawd-detective', 'clawd-shipping', 'clawd-sleeping']);
const EDGE_TO_EDGE_PREVIEW_IDS = new Set(['clawd-500', 'clawd-error']);
const SMALL_VISUAL_PREVIEW_SCALE: Record<string, number> = {
  'clawd-peeking': 1.72,
  'clawd-working-overheated': 1.72,
  'clawd-crab-walking': 1.35,
  'clawd-going-away': 1.35,
  'clawd-eating': 1.35,
  'clawd-exercise': 1.35,
  'clawd-reading': 1.35,
  'clawd-bored': 1.25,
};

function previewFor(asset: ResolvedClawdAsset): PetPresentationDefinition['preview'] {
  if (SMALL_VISUAL_PREVIEW_SCALE[asset.id]) return { scale: SMALL_VISUAL_PREVIEW_SCALE[asset.id], anchor: 'bottom' };
  if (WIDE_PREVIEW_IDS.has(asset.id)) return { scale: 1, anchor: 'bottom' };
  if (EDGE_TO_EDGE_PREVIEW_IDS.has(asset.id)) return { scale: 1.04, anchor: 'bottom' };
  if (TALL_PREVIEW_IDS.has(asset.id)) return { scale: 1.2, anchor: 'bottom' };
  if (asset.format === 'gif') return { scale: 1.22, anchor: 'bottom' };
  return { scale: 1.16, offsetY: asset.id === 'clawd-happy' ? 1 : 0, anchor: 'bottom' };
}

const manualPresentations: PetPresentationDefinition[] = CLAWD_RESOLVED_ASSETS
  .filter((asset) => !EXCLUDED_IDS.has(asset.id))
  .map((asset) => ({
    id: asset.id,
    label: asset.label,
    category: asset.presentationCategory,
    assetId: asset.id,
    renderer: 'clawd-asset',
    format: asset.animated ? 'animated' : 'static',
    loop: asset.animated,
    availableForManual: true,
    availableForAutomatic: ['clawd-working-typing', 'clawd-sleeping', 'clawd-notification'].includes(asset.id),
    triggerPolicy: asset.presentationCategory === 'http'
      ? (Number(asset.label) >= 400 ? 'agent-error-or-manual' : 'manual-only')
      : 'automatic',
    reducedMotionFallbackId: 'clawd-idle',
    preview: previewFor(asset),
    ...localizeClawdPresentation(asset.id, asset.label, asset.presentationCategory),
    ...emotionMetadataFor({ id: asset.id, label: asset.label, category: asset.presentationCategory, loop: asset.animated }),
  }));

const runtimeOnlyBase: PetPresentationDefinition[] = [
  { id: 'clawd-idle', label: '待機', displayName: '待機', localizedNames: {'zh-TW':'待機',en:'Idle'}, categoryLabel:'日常', libraryCategory:'daily', searchKeywords:['待機','idle'], category: 'daily', assetId: 'idle', renderer: 'lunaris-animation', format: 'animated', loop: true, availableForManual: true, availableForAutomatic: true, reducedMotionFallbackId: 'clawd-idle', preview: { scale: 1.42, anchor: 'bottom' } },
  { id: 'clawd-happy-runtime', label: '完成任務', category: 'emotion', assetId: 'happy', renderer: 'lunaris-animation', format: 'animated', loop: true, availableForManual: false, availableForAutomatic: true, reducedMotionFallbackId: 'clawd-idle', preview: { scale: 1.42, anchor: 'bottom' } },
  { id: 'clawd-error-runtime', label: '運行異常', displayName: '運行異常', localizedNames: {'zh-TW':'運行異常',en:'Runtime error'}, categoryLabel:'情緒', libraryCategory:'emotion', searchKeywords:['運行異常','error'], category: 'emotion', assetId: 'error', renderer: 'lunaris-animation', format: 'animated', loop: true, availableForManual: true, availableForAutomatic: true, triggerPolicy: 'agent-error-or-manual', reducedMotionFallbackId: 'clawd-idle', preview: { scale: 1.42, anchor: 'bottom' } },
];
const runtimeOnly: PetPresentationDefinition[] = runtimeOnlyBase.map((item) => ({ ...item, ...emotionMetadataFor(item) }));

export const CLAWD_CAPABILITY_MANIFEST: PetCapabilityManifest = {
  petId: 'clawd',
  displayName: 'CLAWD',
  compositionMode: 'baked',
  skins: [{ id: 'default', label: '經典 CLAWD' }],
  defaultSkinId: 'default',
  defaultPresentationId: 'clawd-idle',
  presentations: [...runtimeOnly, ...manualPresentations],
  automaticStateMap: {
    idle: 'clawd-idle',
    happy: 'clawd-happy-runtime',
    working: 'clawd-working-typing',
    sleeping: 'clawd-sleeping',
    warning: 'clawd-notification',
    error: 'clawd-error-runtime',
  },
};

export const CLAWD_EXCLUDED_PRESENTATION_IDS = [...EXCLUDED_IDS];
