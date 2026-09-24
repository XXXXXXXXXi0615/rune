import { describe, expect, it } from 'vitest';
import { resolveDockActiveId, resolveDockVisibility } from './dockNavigation';
import { resolveLegacyRouteRedirect } from './legacyRouteRedirects';

describe('resolveDockActiveId', () => {
  it('maps primary destinations', () => {
    expect(resolveDockActiveId('/')).toBe('home');
    expect(resolveDockActiveId('/home')).toBe('home');
    expect(resolveDockActiveId('/chat')).toBe('chat');
    expect(resolveDockActiveId('/chat/group-1')).toBe('chat');
    expect(resolveDockActiveId('/chat/moments')).toBe('chat');
    expect(resolveDockActiveId('/chat/moments/post-1')).toBe('chat');
    expect(resolveDockActiveId('/music')).toBe('music');
    expect(resolveDockActiveId('/music/listen/track-1')).toBe('music');
    expect(resolveDockActiveId('/calendar')).toBe('calendar');
  });

  it('maps settings and secondary destinations to more', () => {
    expect(resolveDockActiveId('/settings')).toBe('more');
    expect(resolveDockActiveId('/settings/data/storage')).toBe('more');
    expect(resolveDockActiveId('/settings/modules')).toBe('more');
    expect(resolveDockActiveId('/settings/about')).toBe('more');
    expect(resolveDockActiveId('/quests')).toBe('more');
    expect(resolveDockActiveId('/profile')).toBe('more');
  });

  it('maps restored More entries to more', () => {
    // Phase D: the Tide Ledger module (/ledger, /subscriptions) is retired — the routes
    // redirect (ledger → /, /ledger?tab=exchange → /exchange) and own no dock entry.
    expect(resolveDockActiveId('/ledger')).toBeNull();
    expect(resolveDockActiveId('/objects')).toBe('more');
    expect(resolveDockActiveId('/objects/archive')).toBe('more');
    expect(resolveDockActiveId('/objects/some-id')).toBe('more');
    expect(resolveDockActiveId('/focus')).toBeNull();
    expect(resolveDockActiveId('/subscriptions')).toBeNull();
  });

  it('maps creation modules (hidden by default) to more', () => {
    expect(resolveDockActiveId('/works')).toBe('more');
    expect(resolveDockActiveId('/inspiration')).toBe('more');
  });

  it('resolves only supported legacy URLs to their current routes', () => {
    expect(resolveLegacyRouteRedirect('/todo')).toBe('/quests');
    expect(resolveLegacyRouteRedirect('/todos')).toBe('/quests');
    expect(resolveLegacyRouteRedirect('/focus')).toBe('/');
    expect(resolveLegacyRouteRedirect('/focus/traces')).toBe('/');
    expect(resolveLegacyRouteRedirect('/clawd')).toBe('/');
    expect(resolveLegacyRouteRedirect('/games')).toBeNull();
    expect(resolveLegacyRouteRedirect('/playroom')).toBeNull();
  });

  it('never maps settings routes to chat', () => {
    expect(resolveDockActiveId('/settings')).not.toBe('chat');
    expect(resolveDockActiveId('/settings/chat')).not.toBe('chat');
    expect(resolveDockActiveId('/settings/chat')).toBe('more');
  });

  it('does not leak prefixes onto sibling routes', () => {
    // Retired MoonDiet route: /diet redirects to /calendar and owns no dock tab.
    expect(resolveDockActiveId('/diet')).toBeNull();
    expect(resolveDockActiveId('/chat-inbox')).toBeNull();
    expect(resolveDockActiveId('/timeline')).toBeNull();
    expect(resolveDockActiveId('/playroom')).toBeNull();
    expect(resolveDockActiveId('/games')).toBeNull();
    expect(resolveDockActiveId('/gacha')).toBeNull();
    expect(resolveDockActiveId('/period')).toBeNull();
  });
});

describe('resolveDockVisibility', () => {
  it('renders the same dock at mobile and desktop preview widths', () => {
    expect(resolveDockVisibility({ pathname: '/' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/calendar' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/settings' })).toBe(true);
  });

  it('keeps canonical navigation reachable on StandardShell child pages', () => {
    expect(resolveDockVisibility({ pathname: '/settings/appearance' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/settings/data/storage' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/settings/modules' })).toBe(true);
  });

  it('renders the canonical dock on Chat, Music and overflow routes', () => {
    expect(resolveDockVisibility({ pathname: '/chat' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/chat/moments' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/chat/moments/post-1' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/music' })).toBe(true);
    expect(resolveDockVisibility({ pathname: '/quests' })).toBe(true);
  });
});
