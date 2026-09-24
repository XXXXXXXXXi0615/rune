import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_WALLPAPER_SETTINGS } from '@/features/wallpaper/wallpaperTypes';
import { useWallpaperStore } from './useWallpaperStore';

describe('useWallpaperStore draft boundary', () => {
  beforeEach(() => useWallpaperStore.setState({ applied: { ...DEFAULT_WALLPAPER_SETTINGS }, draft: null }));

  it('keeps preview changes out of applied settings until apply', () => {
    const store = useWallpaperStore.getState();
    store.beginDraft();
    store.updateDraft({ brightness: 1.2, readabilityMode: 'high' });
    expect(useWallpaperStore.getState().applied.brightness).toBe(DEFAULT_WALLPAPER_SETTINGS.brightness);
    expect(useWallpaperStore.getState().draft?.readabilityMode).toBe('high');
  });

  it('cancel restores the applied settings and apply commits once', () => {
    useWallpaperStore.getState().beginDraft();
    useWallpaperStore.getState().updateDraft({ positionX: 18 });
    useWallpaperStore.getState().cancelDraft();
    expect(useWallpaperStore.getState().draft).toBeNull();
    expect(useWallpaperStore.getState().applied.positionX).toBe(50);
    useWallpaperStore.getState().beginDraft();
    useWallpaperStore.getState().updateDraft({ positionX: 18 });
    useWallpaperStore.getState().applyDraft();
    expect(useWallpaperStore.getState().applied.positionX).toBe(18);
    expect(useWallpaperStore.getState().draft).toBeNull();
  });
});
