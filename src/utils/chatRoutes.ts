const CHAT_ROOT = '/chat';
const CHAT_MOMENTS_ROOT = '/chat/moments';

export function isChatRoute(pathname: string): boolean {
  return pathname === CHAT_ROOT || pathname.startsWith(`${CHAT_ROOT}/`);
}

export function isChatMomentRoute(pathname: string): boolean {
  return pathname === CHAT_MOMENTS_ROOT || pathname.startsWith(`${CHAT_MOMENTS_ROOT}/`);
}

export function isChatLandingRoute(pathname: string): boolean {
  return pathname === CHAT_ROOT || isChatMomentRoute(pathname);
}

export function isChatConversationRoute(pathname: string): boolean {
  return isChatRoute(pathname)
    && !isChatMomentRoute(pathname)
    && /^\/chat\/[^/]+$/.test(pathname);
}
