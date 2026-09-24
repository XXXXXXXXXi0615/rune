import type { PetCapabilityManifest } from '../types';
import { emotionMetadataFor } from '../presentationEmotionMetadata';

export const JIYI_CAPABILITY_MANIFEST: PetCapabilityManifest = {
  petId: 'jiyi', displayName: '吉伊', compositionMode: 'baked',
  skins: [{ id: 'default', label: '經典吉伊' }], defaultSkinId: 'default', defaultPresentationId: 'idle',
  presentations: [
    ['idle', '待機', 'daily', 'idle-calm', true], ['happy', '開心', 'emotion', 'idle-happy', true],
    ['sad', '難過', 'emotion', 'idle-sad', true], ['tired', '疲憊', 'emotion', 'idle-tired', true],
    ['walk', '走動', 'movement', 'walk-calm', true], ['work', '專注', 'work', 'work-calm', true],
    ['cheer', '打氣', 'emotion', 'cheer-happy', false], ['cry', '哭泣', 'emotion', 'cry-sad', false],
    ['rest', '休息', 'daily', 'rest-calm', true], ['sleep', '睡覺', 'daily', 'sleep-tired', true],
  ].map(([id, label, category, assetId, loop]) => ({
    id, label, displayName: label, localizedNames: { 'zh-TW': label },
    categoryLabel: category === 'work' ? '工作' : category === 'emotion' ? '情緒' : category === 'movement' ? '移動' : '日常',
    libraryCategory: category === 'work' ? 'work' : category === 'emotion' ? 'emotion' : category === 'movement' ? 'movement' : 'daily',
    searchKeywords: [label, id], category, assetId, renderer: 'sprite-atlas', format: 'animated', loop,
    availableForManual: true, availableForAutomatic: true, reducedMotionFallbackId: 'idle', preview: { scale: .94, anchor: 'bottom' },
    ...emotionMetadataFor({ id: String(id), label: String(label), category: category as PetCapabilityManifest['presentations'][number]['category'], loop: Boolean(loop) }),
  })) as PetCapabilityManifest['presentations'],
  automaticStateMap: { idle: 'idle', happy: 'happy', working: 'work', sleeping: 'sleep', warning: 'tired', error: 'sad' },
};
