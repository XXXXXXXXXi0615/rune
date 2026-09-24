export type FontRole = 'display' | 'body' | 'mono';

export type FontSource = 'bundled' | 'downloadable' | 'system' | 'custom';

export type FontStatus =
  | 'available'
  | 'not-installed'
  | 'not-downloaded'
  | 'loading'
  | 'failed';

export interface FontVariant {
  url?: string;
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
  weight?: number;
  style?: 'normal' | 'italic';
  sizeBytes?: number;
}

export interface FontFamilyDefinition {
  id: string;
  family: string;
  displayName: string;
  source: FontSource;
  roles: FontRole[];
  fallbackStack: string[];
  supportedWeights: number[];
  variants?: FontVariant[];
  variableAxes?: {
    tag: string;
    min: number;
    max: number;
    defaultValue: number;
  }[];
  assets?: {
    url?: string;
    format: 'woff2' | 'woff' | 'ttf' | 'otf';
    weight?: number;
    style?: 'normal' | 'italic';
    sizeBytes?: number;
  }[];
  languageCoverage: {
    latin: boolean;
    traditionalChinese: boolean;
    simplifiedChinese: boolean;
    japanese: boolean;
    korean: boolean;
  };
  license: {
    name: string;
    noticePath?: string;
    sourceUrl?: string;
  };
  status: FontStatus;
}

export interface TypographyProfile {
  id: string;
  name: string;
  displayFontId: string;
  bodyFontId: string;
  monoFontId: string;
  displayWeight: number;
  bodyWeight: number;
  monoWeight: number;
  baseSize: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface CustomFontRecord {
  id: string;
  displayName: string;
  assetId: string;
  format: 'woff2' | 'woff' | 'ttf' | 'otf';
  sizeBytes: number;
  originalFilename: string;
  family: string;
  weights: number[];
  createdAt: number;
}

export interface TypographyState {
  displayFontId: string;
  bodyFontId: string;
  monoFontId: string;
  displayWeight: number;
  bodyWeight: number;
  monoWeight: number;
  baseSize: number;
  lineHeight: number;
  letterSpacing: number;
  activeProfileId: string | null;
  customProfiles: TypographyProfile[];
  downloadedFontIds: string[];
  customFonts: CustomFontRecord[];
}

export const DEFAULT_BASE_SIZE = 16;
export const DEFAULT_LINE_HEIGHT = 1.55;
export const DEFAULT_LETTER_SPACING = 0;
export const DEFAULT_DISPLAY_WEIGHT = 400;
export const DEFAULT_BODY_WEIGHT = 400;
export const DEFAULT_MONO_WEIGHT = 400;

export const DEFAULT_PROFILE_ID = 'lunartide-softlight';

export const SANITIZED_FALLBACKS = {
  display: "'Times New Roman', serif",
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'Courier New', monospace",
} as const;
