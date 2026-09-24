export type ThemeDensity = 'compact' | 'cozy' | 'spacious';

export interface ThemePack {
  version: 1;
  id: string;
  name: string;
  description?: string;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
  };
  glass: {
    blur: number;
    opacity: number;
    saturate: number;
  };
  radius: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  layout: {
    density: ThemeDensity;
    cardPadding: number;
    pageGap: number;
  };
}

export const THEME_PACK_STORAGE_KEY = 'lunartide_theme_pack_v1';
export const THEME_PACK_EVENT = 'lunartide:theme-pack-updated';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const PREDEFINED_THEME_PACKS: ThemePack[] = [
  {
    version: 1,
    id: 'lunartide-liquid',
    name: 'Lunartide Liquid',
    description: '月潮預設米白液態玻璃。',
    colors: {
      primary: '#cc785c',
      background: '#f2ede4',
      surface: '#fff8ef',
      text: '#2a1f14',
      mutedText: '#6b5a48',
    },
    glass: { blur: 24, opacity: 0.58, saturate: 145 },
    radius: { small: 14, medium: 20, large: 28, xlarge: 36 },
    layout: { density: 'cozy', cardPadding: 24, pageGap: 12 },
  },
  {
    version: 1,
    id: 'sillytavern-night',
    name: 'SillyTavern Night',
    description: '深色角色卡氛圍，適合長時間對話。',
    colors: {
      primary: '#8f7cff',
      background: '#171629',
      surface: '#252440',
      text: '#ece6d8',
      mutedText: '#aaa1c2',
    },
    glass: { blur: 18, opacity: 0.62, saturate: 125 },
    radius: { small: 10, medium: 14, large: 18, xlarge: 24 },
    layout: { density: 'compact', cardPadding: 18, pageGap: 10 },
  },
  {
    version: 1,
    id: 'moonlit-cream',
    name: 'Moonlit Cream',
    description: '更亮、更柔的奶油月光玻璃。',
    colors: {
      primary: '#d58a5c',
      background: '#f7efe2',
      surface: '#fffaf3',
      text: '#2f241d',
      mutedText: '#7b6859',
    },
    glass: { blur: 30, opacity: 0.66, saturate: 155 },
    radius: { small: 16, medium: 24, large: 32, xlarge: 42 },
    layout: { density: 'spacious', cardPadding: 28, pageGap: 16 },
  },
  {
    version: 1,
    id: 'terminal-oracle',
    name: 'Terminal Oracle',
    description: '低亮度終端感，保留月潮玻璃層級。',
    colors: {
      primary: '#6ee7b7',
      background: '#101412',
      surface: '#17201c',
      text: '#d9f7e8',
      mutedText: '#7aa58f',
    },
    glass: { blur: 12, opacity: 0.5, saturate: 110 },
    radius: { small: 8, medium: 12, large: 16, xlarge: 22 },
    layout: { density: 'compact', cardPadding: 16, pageGap: 8 },
  },
];

/**
 * Every CSS variable that ANY theme path might set.
 * Used by resetTheme() to guarantee a clean slate before applying a new theme.
 */
const ALL_THEME_VARIABLES = [
  /* theme pack: colors */
  '--accent',
  '--coral',
  '--bg',
  '--bg-2',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--modal-bg',
  '--nav-bg',
  '--text',
  '--text-2',
  '--text-3',
  '--diffuse-bg-1',
  '--diffuse-bg-2',
  '--diffuse-bg-3',
  /* theme pack: glass */
  '--glass-bg',
  '--glass-bg-soft',
  '--glass-bg-strong',
  '--glass-blur',
  '--glass-saturate',
  '--glass-radius',
  '--glass-radius-lg',
  /* theme pack: radius */
  '--r-sm',
  '--r-md',
  '--r-lg',
  '--r-xl',
  '--r-card',
  '--r-input',
  '--r-btn',
  /* theme pack: layout */
  '--card-pad',
  '--card-gap',
  /* fonts (AppShell + SettingsFontsPanel) */
  '--font-display',
  '--font-body',
  '--font-size',
] as const;

/**
 * Every HTML attribute that any theme path might set on <html>.
 * Does NOT include 'data-theme' — dark/light mode is managed by
 * useAppStore.theme and is orthogonal to theme packs.
 */
const ALL_THEME_ATTRIBUTES = [
  'data-theme-pack',
  'data-theme-density',
  'data-background-preset',
  'data-glass',
  'data-radius',
  'data-bubble',
  'data-font-scale',
] as const;

/**
 * Reset ALL theme state to CSS-defined defaults.
 *
 * Removes every CSS variable and HTML attribute that any theme-related code
 * path (theme pack, custom colours, fonts, glass config, density, etc.) may
 * have written. Call this BEFORE applying a new theme to guarantee zero
 * visual residue from the previous theme state.
 */
export function resetTheme(): void {
  if (typeof document === 'undefined') return;
  try {
    const root = document.documentElement;
    for (const variable of ALL_THEME_VARIABLES) root.style.removeProperty(variable);
    for (const attr of ALL_THEME_ATTRIBUTES) root.removeAttribute(attr);
  } catch {
    // Non-fatal — CSS defaults will take over.
  }
}

/**
 * Legacy alias — kept for backward compatibility.
 * @deprecated Use resetTheme() instead.
 */
export function clearRuntimeThemePack(): void {
  resetTheme();
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgba(hex: string, opacity: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function mixWithBlack(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function mixWithWhite(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function validateThemePack(raw: unknown): ThemePack | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ThemePack>;
  const colors = (value.colors || {}) as Partial<ThemePack['colors']>;
  const glass = (value.glass || {}) as Partial<ThemePack['glass']>;
  const radius = (value.radius || {}) as Partial<ThemePack['radius']>;
  const layout = (value.layout || {}) as Partial<ThemePack['layout']>;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `imported-${Date.now()}`;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Imported Theme';

  const colorEntries = {
    primary: colors.primary,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    mutedText: colors.mutedText,
  };

  if (Object.values(colorEntries).some((color) => typeof color !== 'string' || !HEX_COLOR.test(color))) {
    return null;
  }

  const density = ['compact', 'cozy', 'spacious'].includes(layout.density as string)
    ? layout.density as ThemeDensity
    : 'cozy';

  return {
    version: 1,
    id,
    name,
    description: typeof value.description === 'string' ? value.description : '',
    colors: colorEntries as ThemePack['colors'],
    glass: {
      blur: clamp(glass.blur, 0, 60, 24),
      opacity: clamp(glass.opacity, 0.18, 0.9, 0.58),
      saturate: clamp(glass.saturate, 80, 200, 145),
    },
    radius: {
      small: clamp(radius.small, 0, 36, 14),
      medium: clamp(radius.medium, 0, 48, 20),
      large: clamp(radius.large, 0, 64, 28),
      xlarge: clamp(radius.xlarge, 0, 80, 36),
    },
    layout: {
      density,
      cardPadding: clamp(layout.cardPadding, 10, 40, 24),
      pageGap: clamp(layout.pageGap, 6, 28, 12),
    },
  };
}

export function loadRuntimeThemePack(): ThemePack | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(THEME_PACK_STORAGE_KEY);
    if (!raw) return null;
    return validateThemePack(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveRuntimeThemePack(pack: ThemePack | null): void {
  if (typeof window === 'undefined') return;
  if (!pack) window.localStorage.removeItem(THEME_PACK_STORAGE_KEY);
  else window.localStorage.setItem(THEME_PACK_STORAGE_KEY, JSON.stringify(pack));
  window.dispatchEvent(new CustomEvent(THEME_PACK_EVENT, { detail: pack }));
}

/**
 * Safe accessor: returns a fully-populated ThemePack with defaults for any
 * missing field. Prevents undefined access crashes when a partially-malformed
 * pack slips through (e.g. corrupted localStorage, hand-edited JSON).
 */
const SAFE_DEFAULTS: ThemePack = {
  version: 1,
  id: 'lunartide-default',
  name: 'Lunartide Default',
  description: '',
  colors: { primary: '#cc785c', background: '#f2ede4', surface: '#fff8ef', text: '#2a1f14', mutedText: '#6b5a48' },
  glass: { blur: 24, opacity: 0.58, saturate: 145 },
  radius: { small: 14, medium: 20, large: 28, xlarge: 36 },
  layout: { density: 'cozy', cardPadding: 24, pageGap: 12 },
};

export function safeThemePack(pack: Partial<ThemePack> | null | undefined): ThemePack {
  if (!pack) return SAFE_DEFAULTS;
  return {
    version: 1,
    id: pack.id || SAFE_DEFAULTS.id,
    name: pack.name || SAFE_DEFAULTS.name,
    description: pack.description ?? SAFE_DEFAULTS.description,
    colors: { ...SAFE_DEFAULTS.colors, ...(pack.colors || {}) },
    glass: { ...SAFE_DEFAULTS.glass, ...(pack.glass || {}) },
    radius: { ...SAFE_DEFAULTS.radius, ...(pack.radius || {}) },
    layout: { ...SAFE_DEFAULTS.layout, ...(pack.layout || {}) },
  };
}

export function applyThemePack(pack: ThemePack | null): void {
  if (typeof document === 'undefined') return;
  try {
    // Step 1: Full reset — wipe all theme variables and attributes to prevent
    // CSS variable residue from the previous theme leaking into the new one.
    resetTheme();

    if (!pack) return;

    // Step 2: Normalize through safe defaults — prevents undefined access crashes.
    const safe = safeThemePack(pack);
    const root = document.documentElement;
    const { colors, glass, radius, layout } = safe;
    const softOpacity = Math.max(0.18, glass.opacity - 0.2);
    const strongOpacity = Math.min(0.92, glass.opacity + 0.12);

    root.setAttribute('data-theme-pack', safe.id);
    root.setAttribute('data-theme-density', layout.density);
    root.style.setProperty('--accent', colors.primary);
    root.style.setProperty('--coral', colors.primary);
    root.style.setProperty('--bg', colors.background);
    root.style.setProperty('--bg-2', mixWithBlack(colors.background, 0.04));
    root.style.setProperty('--surface', rgba(colors.surface, glass.opacity));
    root.style.setProperty('--surface-2', rgba(colors.surface, softOpacity));
    root.style.setProperty('--surface-3', rgba(colors.surface, strongOpacity));
    root.style.setProperty('--modal-bg', rgba(colors.surface, strongOpacity));
    root.style.setProperty('--nav-bg', rgba(colors.surface, Math.min(0.86, glass.opacity + 0.08)));
    root.style.setProperty('--text', colors.text);
    root.style.setProperty('--text-2', colors.mutedText);
    root.style.setProperty('--text-3', rgba(colors.mutedText, 0.72));
    root.style.setProperty('--glass-bg', rgba(colors.surface, glass.opacity));
    root.style.setProperty('--glass-bg-soft', rgba(colors.surface, softOpacity));
    root.style.setProperty('--glass-bg-strong', rgba(colors.surface, strongOpacity));
    root.style.setProperty('--glass-blur', `${glass.blur}px`);
    root.style.setProperty('--glass-saturate', `${glass.saturate}%`);
    root.style.setProperty('--glass-radius', `${radius.medium}px`);
    root.style.setProperty('--glass-radius-lg', `${radius.large}px`);
    root.style.setProperty('--r-sm', `${radius.small}px`);
    root.style.setProperty('--r-md', `${radius.medium}px`);
    root.style.setProperty('--r-lg', `${radius.large}px`);
    root.style.setProperty('--r-xl', `${radius.xlarge}px`);
    root.style.setProperty('--r-card', `${radius.large}px`);
    root.style.setProperty('--r-input', `${radius.small}px`);
    root.style.setProperty('--r-btn', `${radius.small}px`);
    root.style.setProperty('--card-pad', `${layout.cardPadding}px`);
    root.style.setProperty('--card-gap', `${layout.pageGap}px`);
    root.style.setProperty('--diffuse-bg-1', rgba(colors.primary, 0.18));
    root.style.setProperty('--diffuse-bg-2', rgba(mixWithWhite(colors.primary, 0.28), 0.16));
    root.style.setProperty('--diffuse-bg-3', rgba(colors.surface, 0.24));
  } catch {
    // If anything goes wrong, reset everything so the app falls back to its
    // CSS-defined defaults rather than staying in a broken state.
    resetTheme();
  }
}

export function downloadThemePack(pack: ThemePack): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pack.id || 'lunartide-theme'}.theme.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
