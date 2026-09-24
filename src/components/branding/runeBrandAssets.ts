export type RuneBrandMood =
  | 'neutral'
  | 'focused'
  | 'sleepy'
  | 'pleased'
  | 'annoyed'
  | 'smug'
  | 'fury'
  | 'arrogant'
  | 'scorn'
  | 'despise';

const assetPath = (fileName: string) => `${import.meta.env.BASE_URL}branding/rune/${fileName}`;

export const RUNE_LOGIN_ASSETS = {
  portrait: {
    neutral: assetPath('rune-login-neutral.png'),
    soft: assetPath('rune-login-soft.png'),
  },
  wordmark: assetPath('rune-wordmark.svg'),
  sourceWordmark: assetPath('rune-wordmark.png'),
  referenceBoard: assetPath('rune-login-reference-board.png'),
  characterMaster: assetPath('rune-character-master.png'),
} as const;

export function resolveRuneWordmarkAsset(): string {
  return RUNE_LOGIN_ASSETS.wordmark;
}

export type RuneLoginPortraitState = keyof typeof RUNE_LOGIN_ASSETS.portrait;

export function resolveRuneLoginPortraitAsset(state: RuneLoginPortraitState = 'neutral'): string {
  return RUNE_LOGIN_ASSETS.portrait[state];
}

export const RUNE_BRAND_ASSET_MAP = {
  neutral: assetPath('rune-logo-neutral.png'),
  focused: assetPath('rune-logo-focused.png'),
  sleepy: assetPath('rune-logo-sleepy.png'),
  pleased: assetPath('rune-logo-pleased.png'),
  annoyed: assetPath('rune-logo-annoyed.png'),
  smug: assetPath('rune-logo-smug.png'),
  fury: assetPath('rune-logo-fury.png'),
  arrogant: assetPath('rune-logo-arrogant.png'),
  scorn: assetPath('rune-logo-scorn.png'),
  despise: assetPath('rune-logo-despise.png'),
} as const satisfies Record<RuneBrandMood, string>;

export function resolveRuneBrandAsset(mood: RuneBrandMood = 'neutral'): string {
  return RUNE_BRAND_ASSET_MAP[mood];
}

export type RuneOrbExpression = 'neutral';

const RUNE_ORB_AVATAR_ASSET_MAP = {
  neutral: assetPath('rune-orb-neutral.png'),
} as const satisfies Record<RuneOrbExpression, string>;

export function resolveRuneOrbAvatarAsset(expression: RuneOrbExpression = 'neutral'): string {
  return RUNE_ORB_AVATAR_ASSET_MAP[expression];
}

export type RunePresentationAssetId = 'tidewatch-checkin-neutral';

export interface RunePresentationAsset {
  id: RunePresentationAssetId;
  src: string;
  canvas: { width: number; height: number };
  visualBounds: { x: number; y: number; width: number; height: number; alphaThreshold: number };
}

export const RUNE_PRESENTATION_ASSETS = {
  'tidewatch-checkin-neutral': {
    id: 'tidewatch-checkin-neutral',
    src: assetPath('rune-checkin-neutral.png'),
    canvas: { width: 1376, height: 1143 },
    visualBounds: { x: 38, y: 28, width: 923, height: 1088, alphaThreshold: 8 },
  },
} as const satisfies Record<RunePresentationAssetId, RunePresentationAsset>;

export function resolveRunePresentationAsset(id: RunePresentationAssetId): RunePresentationAsset {
  return RUNE_PRESENTATION_ASSETS[id];
}
