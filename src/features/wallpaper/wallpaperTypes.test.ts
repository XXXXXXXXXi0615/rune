import { describe, expect, it } from 'vitest';
import { DEFAULT_WALLPAPER_SETTINGS, sanitizeWallpaperSettings } from './wallpaperTypes';
import { validateWallpaperFile, WALLPAPER_MAX_FILE_BYTES } from '@/storage/wallpaperStorage';

describe('sanitizeWallpaperSettings', () => {
  it('clamps unsafe persisted display parameters', () => {
    const result = sanitizeWallpaperSettings({ blur: 99, imageOpacity: -1, scale: 8, interfaceClarity: 130 });
    expect(result.blur).toBe(30);
    expect(result.imageOpacity).toBe(0);
    expect(result.scale).toBe(1.5);
    expect(result.interfaceClarity).toBe(100);
  });

  it('migrates legacy non-image modes to an image-free default', () => {
    expect(sanitizeWallpaperSettings({ kind: 'linear-gradient' }).wallpaperId).toBeNull();
  });

  it('preserves a legacy custom image id', () => {
    expect(sanitizeWallpaperSettings({ kind: 'custom', wallpaperId: 'saved-image' }).wallpaperId).toBe('saved-image');
  });

  it('sanitizes readability modes', () => {
    expect(sanitizeWallpaperSettings({ readabilityMode: 'high' }).readabilityMode).toBe('high');
    expect(sanitizeWallpaperSettings({ readabilityMode: 'unsafe' as never }).readabilityMode).toBe('standard');
  });

  it('sanitizes fit mode', () => {
    expect(sanitizeWallpaperSettings({ fit: 'contain' }).fit).toBe('contain');
    expect(sanitizeWallpaperSettings({ fit: 'cover' }).fit).toBe('cover');
    expect(sanitizeWallpaperSettings({ fit: 'invalid' as never }).fit).toBe('cover');
    expect(sanitizeWallpaperSettings({}).fit).toBe('cover');
  });
});

describe('validateWallpaperFile', () => {
  it('accepts supported local image MIME types', () => {
    expect(validateWallpaperFile(new File(['image'], 'wallpaper.webp', { type: 'image/webp' }))).toBeNull();
  });

  it('rejects unsupported MIME types and oversized files', () => {
    expect(validateWallpaperFile(new File(['x'], 'wallpaper.svg', { type: 'image/svg+xml' }))).toMatch(/僅支援/);
    const oversized = new File([new Uint8Array(WALLPAPER_MAX_FILE_BYTES + 1)], 'huge.png', { type: 'image/png' });
    expect(validateWallpaperFile(oversized)).toMatch(/20 MB/);
  });
});
