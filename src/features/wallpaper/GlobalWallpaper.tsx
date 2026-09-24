import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { useWallpaperStore } from '@/store/useWallpaperStore';
import { getWallpaper } from '@/storage/wallpaperStorage';
import { AmbientMist } from './AmbientMist';
import './wallpaper.css';

export function GlobalWallpaper() {
  const { pathname } = useLocation();
  const applied = useWallpaperStore((state) => state.applied);
  const draft = useWallpaperStore((state) => state.draft);
  const fallbackToDefault = useWallpaperStore((state) => state.fallbackToDefault);
  const settings = draft ?? applied;
  const showAmbientMist = pathname === '/' || pathname === '/stash';
  const [customUrl, setCustomUrl] = useState<string>();

  useEffect(() => {
    document.documentElement.dataset.wallpaperActive = 'true';
    return () => { delete document.documentElement.dataset.wallpaperActive; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.wallpaperImage = settings.backgroundKind === 'builtin' || (settings.backgroundKind === 'custom' && Boolean(settings.wallpaperId)) ? 'true' : 'false';
    document.documentElement.dataset.wallpaperKind = settings.backgroundKind;
    document.documentElement.dataset.wallpaperReadability = settings.readabilityMode;
    return () => {
      delete document.documentElement.dataset.wallpaperImage;
      delete document.documentElement.dataset.wallpaperKind;
      delete document.documentElement.dataset.wallpaperReadability;
    };
  }, [settings.backgroundKind, settings.readabilityMode, settings.wallpaperId]);

  useEffect(() => {
    let active = true;
    let nextUrl: string | undefined;
    if (settings.backgroundKind !== 'custom' || !settings.wallpaperId) { setCustomUrl(undefined); return; }
    void getWallpaper(settings.wallpaperId).then((blob) => {
      if (!active) return;
      if (!blob) { fallbackToDefault(); return; }
      nextUrl = URL.createObjectURL(blob);
      setCustomUrl(nextUrl);
    }).catch(() => { if (active) fallbackToDefault(); });
    return () => { active = false; if (nextUrl) URL.revokeObjectURL(nextUrl); };
  }, [settings.backgroundKind, settings.wallpaperId, fallbackToDefault]);

  const source = settings.backgroundKind === 'builtin' ? `${import.meta.env.BASE_URL}wallpapers/${settings.builtinId}.avif` : customUrl;
  const baseBackground = settings.backgroundKind === 'solid'
    ? settings.solidColor
    : settings.backgroundKind === 'gradient'
      ? `linear-gradient(${settings.gradientAngle}deg, ${settings.gradientFrom}, ${settings.gradientTo})`
      : undefined;
  const clarity = settings.interfaceClarity / 100;
  const style = {
    '--wallpaper-opacity': settings.imageOpacity,
    '--wallpaper-blur': `${settings.blur}px`,
    '--wallpaper-brightness': settings.brightness,
    '--wallpaper-saturation': settings.saturation,
    '--wallpaper-scale': settings.scale,
    '--wallpaper-position-x': `${settings.positionX}%`,
    '--wallpaper-position-y': `${settings.positionY}%`,
    '--wallpaper-tint': settings.tintColor,
    '--wallpaper-scrim': settings.tintOpacity,
    '--wallpaper-surface-opacity': `${(0.52 + clarity * 0.38) * 100}%`,
    '--wallpaper-surface-strong-opacity': `${(0.68 + clarity * 0.27) * 100}%`,
    '--wallpaper-interface-blur': `${12 + clarity * 22}px`,
    '--wallpaper-border-contrast': `${(0.14 + clarity * 0.32) * 100}%`,
    '--wallpaper-clarity-tint': Math.min(0.34, settings.tintOpacity + clarity * 0.12),
  } as CSSProperties;

  return (
    <div className="global-wallpaper" style={style} aria-hidden="true" data-testid="global-wallpaper">
      <div className="global-wallpaper__base" style={baseBackground ? { background: baseBackground } : undefined} />
      {source && <div className="global-wallpaper__layer" data-testid="global-wallpaper-layer" style={{ backgroundImage: `url(${JSON.stringify(source)})`, backgroundSize: settings.fit === 'contain' ? 'contain' : 'cover' }} />}
      <div className="global-wallpaper__scrim" data-testid="global-wallpaper-scrim" />
      {showAmbientMist && <AmbientMist />}
    </div>
  );
}
