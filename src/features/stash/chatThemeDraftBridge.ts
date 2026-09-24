export interface ChatThemeDraftSeed {
  source: 'rune-stash';
  colors: string[];
}

export interface StashChatThemeNavigationState {
  chatThemeDraftSeed: ChatThemeDraftSeed;
  openPaletteMapping?: boolean;
  returnTo: '/stash';
  stashContext: { filter: 'color'; workspaceTab: 'library' | 'palettes'; scrollY: number };
}

const normalizeHex = (value: string) => /^#[0-9A-F]{6}$/i.test(value.trim())
  ? value.trim().toUpperCase()
  : null;

export function createChatThemeDraftSeed(colors: string[]): ChatThemeDraftSeed | null {
  const normalized = colors.slice(0, 12).map(normalizeHex).filter((color): color is string => Boolean(color));
  return normalized.length ? { source: 'rune-stash', colors: normalized } : null;
}

export function readStashChatThemeNavigationState(value: unknown): StashChatThemeNavigationState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<StashChatThemeNavigationState>;
  const seed = candidate.chatThemeDraftSeed;
  if (candidate.returnTo !== '/stash' || !seed || seed.source !== 'rune-stash' || !Array.isArray(seed.colors)) return null;
  const normalized = createChatThemeDraftSeed(seed.colors);
  if (!normalized) return null;
  return {
    chatThemeDraftSeed: normalized,
    openPaletteMapping: candidate.openPaletteMapping === true,
    returnTo: '/stash',
    stashContext: {
      filter: 'color',
      workspaceTab: candidate.stashContext?.workspaceTab === 'palettes' ? 'palettes' : 'library',
      scrollY: Number.isFinite(candidate.stashContext?.scrollY) ? Math.max(0, candidate.stashContext!.scrollY) : 0,
    },
  };
}
