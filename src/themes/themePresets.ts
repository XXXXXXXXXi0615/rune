import type { ThemePresetId } from '@/store/useThemePresetStore';

export interface ThemePresetDefinition { id: ThemePresetId; name: string; description: string; light: string[]; dark: string[] }

export const THEME_PRESETS: ThemePresetDefinition[] = [
  { id: 'lunar-tide', name: '月潮原生', description: '奶油、潮汐青與琥珀', light: ['#f7f1e7', '#fffaf2', '#247c78', '#d69a45'], dark: ['#151a1e', '#222a2e', '#75bdb5', '#d9aa61'] },
  { id: 'amber-dusk', name: '琥珀薄暮', description: '暖紙、焦糖與琥珀', light: ['#f6eddd', '#fff8ea', '#ad6f31', '#d49a45'], dark: ['#1c1714', '#2b231d', '#d29a5c', '#e0b66c'] },
  { id: 'verdant-tide', name: '青潮森林', description: '鼠尾草、霧青與暖象牙', light: ['#eef2e7', '#faf8ee', '#477f72', '#9a9e60'], dark: ['#131b19', '#202c28', '#79b5a1', '#b7bd7d'] },
  { id: 'eclipse', name: '月蝕深海', description: '深海藍黑、月白與冷青', light: ['#e9f0f4', '#f8fbfc', '#177e94', '#6aa8bd'], dark: ['#080e16', '#111d29', '#67c7dd', '#a9dbe6'] },
  { id: 'rosy-mist', name: '櫻霧夢潮', description: '霧粉、柔紫、珍珠與低彩青', light: ['#f5ebef', '#fff8fa', '#8c718f', '#6f9c98'], dark: ['#1b151d', '#2b222e', '#c49bc3', '#8bb7b0'] },
];

export const THEME_PRESET_BY_ID = Object.fromEntries(THEME_PRESETS.map((preset) => [preset.id, preset])) as Record<ThemePresetId, ThemePresetDefinition>;
