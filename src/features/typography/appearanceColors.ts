export interface AppearanceColors {
  text: string;
  text2: string;
  accent: string;
  readable: boolean;
}

const STORAGE_KEY = 'lunartide-appearance-colors-v1';

export const DEFAULT_APPEARANCE_COLORS: AppearanceColors = {
  text: '#2a1f14',
  text2: '#6b5a48',
  accent: '#e8735a',
  readable: false,
};

export function loadAppearanceColors(): AppearanceColors {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AppearanceColors>;
    return {
      text: typeof stored.text === 'string' ? stored.text : DEFAULT_APPEARANCE_COLORS.text,
      text2: typeof stored.text2 === 'string' ? stored.text2 : DEFAULT_APPEARANCE_COLORS.text2,
      accent: typeof stored.accent === 'string' ? stored.accent : DEFAULT_APPEARANCE_COLORS.accent,
      readable: Boolean(stored.readable),
    };
  } catch {
    return { ...DEFAULT_APPEARANCE_COLORS };
  }
}

export function applyAppearanceColors(colors: AppearanceColors, persist = false): void {
  const root = document.documentElement;
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--text-2', colors.text2);
  root.style.setProperty('--accent', colors.accent);
  root.toggleAttribute('data-high-readability', colors.readable);
  if (!persist) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colors)); } catch { /* local persistence is best effort */ }
}

export function restoreAppearanceColors(): void {
  applyAppearanceColors(loadAppearanceColors());
}
