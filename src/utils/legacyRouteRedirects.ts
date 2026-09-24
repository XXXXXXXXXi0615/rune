/** Explicit compatibility redirects for legacy URLs that remain supported. */
export const LEGACY_ROUTE_REDIRECTS = {
  '/todo': '/quests',
  '/todos': '/quests',
  '/focus': '/',
  '/focus/traces': '/',
  '/clawd': '/',
} as const;

export type LegacyRoutePath = keyof typeof LEGACY_ROUTE_REDIRECTS;

export function resolveLegacyRouteRedirect(pathname: string): string | null {
  return LEGACY_ROUTE_REDIRECTS[pathname as LegacyRoutePath] ?? null;
}
