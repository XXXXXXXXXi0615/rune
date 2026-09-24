import { useLayoutEffect, type ReactNode } from 'react';
import { useThemePresetStore } from '@/store/useThemePresetStore';
import { MoonRipple } from '@/themes/MoonRipple';

function onAccent(hex: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#ffffff';
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .42 ? '#17211f' : '#ffffff';
}

function ThemePresetAttribute({ children }: { children: ReactNode }) {
  const presetId = useThemePresetStore((state) => state.presetId);
  const draftPresetId = useThemePresetStore((state) => state.draftPresetId);
  const accentOverride = useThemePresetStore((state) => state.accentOverride);
  const draftAccentOverride = useThemePresetStore((state) => state.draftAccentOverride);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearancePreset = draftPresetId ?? presetId;
    root.toggleAttribute('data-theme-preview', draftPresetId !== null || draftAccentOverride !== undefined);
    const accent = draftAccentOverride === undefined ? accentOverride : draftAccentOverride;
    if (accent && /^#[0-9a-f]{6}$/i.test(accent)) root.style.setProperty('--theme-accent-override', accent);
    else root.style.removeProperty('--theme-accent-override');
    root.style.setProperty('--theme-on-accent', onAccent(accent));
    root.style.colorScheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  }, [accentOverride, draftAccentOverride, draftPresetId, presetId]);

  return <>{children}<MoonRipple /></>;
}

export function ThemePresetProvider({ children }: { children: ReactNode }) {
  return <ThemePresetAttribute>{children}</ThemePresetAttribute>;
}
