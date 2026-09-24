import type { TypographyProfile } from './types';

export const TYPOGRAPHY_PRESETS: TypographyProfile[] = [
  {
    id: 'lunartide-softlight',
    name: '月潮柔光',
    displayFontId: 'lora',
    bodyFontId: 'inter',
    monoFontId: 'jetbrains-mono',
    displayWeight: 400,
    bodyWeight: 400,
    monoWeight: 400,
    baseSize: 16,
    lineHeight: 1.55,
    letterSpacing: 0,
  },
  {
    id: 'lunartide-page',
    name: '月潮書頁',
    displayFontId: 'noto-serif-tc',
    bodyFontId: 'noto-sans-tc',
    monoFontId: 'jetbrains-mono',
    displayWeight: 400,
    bodyWeight: 400,
    monoWeight: 400,
    baseSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  {
    id: 'deep-sea-minimal',
    name: '深海極簡',
    displayFontId: 'inter',
    bodyFontId: 'source-sans-3',
    monoFontId: 'source-code-pro',
    displayWeight: 500,
    bodyWeight: 400,
    monoWeight: 400,
    baseSize: 15,
    lineHeight: 1.5,
    letterSpacing: -0.01,
  },
  {
    id: 'lunartide-note',
    name: '月潮手記',
    displayFontId: 'iansui',
    bodyFontId: 'noto-sans-tc',
    monoFontId: 'jetbrains-mono',
    displayWeight: 400,
    bodyWeight: 400,
    monoWeight: 400,
    baseSize: 16,
    lineHeight: 1.7,
    letterSpacing: 0.02,
  },
];

export function getPresetById(id: string): TypographyProfile | undefined {
  return TYPOGRAPHY_PRESETS.find((p) => p.id === id);
}

export function getDefaultPreset(): TypographyProfile {
  return TYPOGRAPHY_PRESETS[0];
}
