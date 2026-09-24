export function isMusicRoute(pathname: string): boolean {
  return pathname === '/music' || pathname.startsWith('/music/');
}
