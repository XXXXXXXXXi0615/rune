import { getMoreActivePrefixes } from '@/features/navigation/appModuleRegistry';

export type DockTabId = 'home' | 'chat' | 'music' | 'calendar' | 'more';

export type DockActiveId = DockTabId | null;

/**
 * 「更多」按鈕應高亮的所有路由前綴。
 *
 * 從 App Module Registry 動態取得，確保 DockMoreSheet 中顯示的所有模組
 * 都能讓 More Tab 進入 active 狀態。
 *
 * 單一來源：src/features/navigation/appModuleRegistry.ts
 */
const MORE_ACTIVE_PREFIXES: readonly string[] = getMoreActivePrefixes();

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Single source of truth for which Dock tab highlights for a pathname.
 *
 * `/` or `/home*`      → home
 * `/chat*`             → chat
 * `/music*`            → music
 * `/calendar*`         → calendar
 * 任何 Registry 中 showInMobileMore=true 的模組路由 → more
 *
 * `/settings` must NEVER resolve to chat.
 */
export function resolveDockActiveId(pathname: string): DockActiveId {
  if (pathname === '/' || matchesPrefix(pathname, '/home')) return 'home';
  if (matchesPrefix(pathname, '/chat')) return 'chat';
  if (matchesPrefix(pathname, '/music')) return 'music';
  if (matchesPrefix(pathname, '/calendar') || matchesPrefix(pathname, '/timekeeper')) return 'calendar';
  for (const prefix of MORE_ACTIVE_PREFIXES) {
    if (matchesPrefix(pathname, prefix)) return 'more';
  }
  return null;
}

export interface DockVisibilityContext {
  pathname: string;
}

/**
 * Single source of truth for whether the LiquidDock renders.
 *
 * - Desktop with the left main navigation visible → never render.
 * - Every StandardShell route below desktop receives the canonical mobile dock.
 * - Immersive routes never reach this resolver because AppShell selects ImmersiveShell.
 */
export function resolveDockVisibility({ pathname }: DockVisibilityContext): boolean {
  void pathname;
  return true;
}
