import { describe, expect, it } from 'vitest';
import {
  isChatConversationRoute,
  isChatLandingRoute,
  isChatMomentRoute,
  isChatRoute,
} from './chatRoutes';

describe('Chat route ownership', () => {
  it.each([
    ['/chat', true, true, false, false],
    ['/chat/moments', true, true, true, false],
    ['/chat/moments/test-post', true, true, true, false],
    ['/chat/conversation-1', true, false, false, true],
    ['/chat-inbox', false, false, false, false],
  ])('classifies %s', (pathname, chat, landing, moments, conversation) => {
    expect(isChatRoute(pathname)).toBe(chat);
    expect(isChatLandingRoute(pathname)).toBe(landing);
    expect(isChatMomentRoute(pathname)).toBe(moments);
    expect(isChatConversationRoute(pathname)).toBe(conversation);
  });
});
