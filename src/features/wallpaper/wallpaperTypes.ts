export interface WallpaperSettings {
  backgroundKind: 'theme' | 'builtin' | 'custom' | 'solid' | 'gradient';
  builtinId: 'moon-tide' | 'misty-orbit' | 'quiet-dawn';
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  wallpaperId: string | null;
  imageOpacity: number;
  blur: number;
  brightness: number;
  saturation: number;
  scale: number;
  fit: 'cover' | 'contain';
  positionX: number;
  positionY: number;
  tintColor: string;
  tintOpacity: number;
  interfaceClarity: number;
  readabilityMode: 'low' | 'standard' | 'high';
}

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  backgroundKind: 'theme',
  builtinId: 'moon-tide',
  solidColor: '#151a1e',
  gradientFrom: '#17272a',
  gradientTo: '#34283a',
  gradientAngle: 145,
  wallpaperId: null,
  imageOpacity: 0.78,
  blur: 0,
  brightness: 0.94,
  saturation: 0.9,
  scale: 1,
  fit: 'cover',
  positionX: 50,
  positionY: 50,
  tintColor: '#241d2a',
  tintOpacity: 0.22,
  interfaceClarity: 72,
  readabilityMode: 'standard',
};

export function sanitizeWallpaperSettings(value: Partial<WallpaperSettings> & { kind?: unknown } | undefined): WallpaperSettings {
  const source = value ?? {};
  const clamp = (candidate: unknown, min: number, max: number, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? Math.min(max, Math.max(min, candidate)) : fallback;
  // v1 stored five background modes. Only a v1 custom image survives; all other
  // modes intentionally migrate to the neutral, image-free MoonTide base.
  const legacyCustomImage = source.kind === 'custom' && typeof source.wallpaperId === 'string' ? source.wallpaperId : null;
  const wallpaperId = typeof source.wallpaperId === 'string' && source.kind === undefined
    ? source.wallpaperId
    : legacyCustomImage;
  return {
    ...DEFAULT_WALLPAPER_SETTINGS,
    backgroundKind: source.backgroundKind === 'builtin' || source.backgroundKind === 'custom' || source.backgroundKind === 'solid' || source.backgroundKind === 'gradient'
      ? source.backgroundKind
      : legacyCustomImage || wallpaperId ? 'custom' : 'theme',
    builtinId: source.builtinId === 'misty-orbit' || source.builtinId === 'quiet-dawn' ? source.builtinId : 'moon-tide',
    solidColor: typeof source.solidColor === 'string' ? source.solidColor : DEFAULT_WALLPAPER_SETTINGS.solidColor,
    gradientFrom: typeof source.gradientFrom === 'string' ? source.gradientFrom : DEFAULT_WALLPAPER_SETTINGS.gradientFrom,
    gradientTo: typeof source.gradientTo === 'string' ? source.gradientTo : DEFAULT_WALLPAPER_SETTINGS.gradientTo,
    gradientAngle: clamp(source.gradientAngle, 0, 360, DEFAULT_WALLPAPER_SETTINGS.gradientAngle),
    wallpaperId: wallpaperId && wallpaperId.trim() ? wallpaperId : null,
    imageOpacity: clamp(source.imageOpacity, 0, 1, DEFAULT_WALLPAPER_SETTINGS.imageOpacity),
    blur: clamp(source.blur, 0, 30, DEFAULT_WALLPAPER_SETTINGS.blur),
    brightness: clamp(source.brightness, 0.4, 1.6, DEFAULT_WALLPAPER_SETTINGS.brightness),
    saturation: clamp(source.saturation, 0, 2, DEFAULT_WALLPAPER_SETTINGS.saturation),
    scale: clamp(source.scale, 1, 1.5, DEFAULT_WALLPAPER_SETTINGS.scale),
    fit: source.fit === 'contain' ? 'contain' : 'cover',
    positionX: clamp(source.positionX, 0, 100, DEFAULT_WALLPAPER_SETTINGS.positionX),
    positionY: clamp(source.positionY, 0, 100, DEFAULT_WALLPAPER_SETTINGS.positionY),
    tintOpacity: clamp(source.tintOpacity, 0, 0.85, DEFAULT_WALLPAPER_SETTINGS.tintOpacity),
    interfaceClarity: clamp(source.interfaceClarity, 0, 100, DEFAULT_WALLPAPER_SETTINGS.interfaceClarity),
    readabilityMode: source.readabilityMode === 'low' || source.readabilityMode === 'high' ? source.readabilityMode : 'standard',
  };
}
