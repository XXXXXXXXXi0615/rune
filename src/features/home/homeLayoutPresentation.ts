import { HOME_WIDGET_DEFINITIONS, type HomeWidgetId, type HomeWidgetPreset } from './homeLayout';

/**
 * Phase 2B — Edit Home wording.
 *
 * Internal preset enum names never reach the user: each widget exposes only
 * its own 精簡 / 完整 pair, and the option order is the presentation order.
 */
export const HOME_WIDGET_LABELS: Readonly<Record<HomeWidgetId, string>> = {
  'moon-clock': '月相時鐘',
  'daily-checkin': '每日打卡',
  presence: '存在狀態',
  'pixel-world': 'Rune 像素世界',
  'music-now-playing': '音樂 · 目前播放',
  countdown: '倒數',
};

const PRESET_PRESENTATION: Readonly<Record<HomeWidgetId, Readonly<Record<string, { label: string; order: number }>>>> = {
  'moon-clock': { medium: { label: '精簡', order: 0 }, large: { label: '完整', order: 1 } },
  'daily-checkin': { island: { label: '精簡', order: 0 }, medium: { label: '完整', order: 1 } },
  presence: { island: { label: '精簡', order: 0 }, medium: { label: '完整', order: 1 } },
  'pixel-world': { medium: { label: '精簡', order: 0 }, large: { label: '完整', order: 1 } },
  'music-now-playing': { island: { label: '膠囊', order: 0 }, medium: { label: '中型', order: 1 } },
  countdown: { island: { label: '精簡', order: 0 } },
};

export function homeWidgetPresetLabel(id: HomeWidgetId, preset: HomeWidgetPreset): string {
  return PRESET_PRESENTATION[id][preset]?.label ?? preset;
}

export function homeWidgetPresetOptions(id: HomeWidgetId): Array<{ value: HomeWidgetPreset; label: string }> {
  return HOME_WIDGET_DEFINITIONS[id].supportedPresets
    .slice()
    .sort((a, b) => (PRESET_PRESENTATION[id][a]?.order ?? 0) - (PRESET_PRESENTATION[id][b]?.order ?? 0))
    .map((preset) => ({ value: preset, label: homeWidgetPresetLabel(id, preset) }));
}

export function homeWidgetLabel(id: HomeWidgetId): string {
  return HOME_WIDGET_LABELS[id];
}
