import { describe, expect, it } from 'vitest';
import { resolveMessageBubblePresentation, describeBubblePresentation, shouldShowCssTail, bubblePresentationStyleVars } from './resolveMessageBubblePresentation';
import { createRuneDefaultChatTheme, type ChatTheme } from '@/store/useChatThemeStore';
import type { ChatBubbleSkin } from './types';

function themeWith(skin: ChatBubbleSkin | undefined): ChatTheme {
  return { ...createRuneDefaultChatTheme(), bubbleSkin: skin };
}

const cssSkin: ChatBubbleSkin = { mode: 'css' };
const mirroredImageSkin: ChatBubbleSkin = {
  mode: 'image',
  source: { kind: 'url', url: '/assets/skin.png' },
  slice: { top: 20, right: 28, bottom: 20, left: 28 },
  insets: { top: 12, right: 18, bottom: 12, left: 18 },
  mirror: { allowed: true },
  tail: { kind: 'image-integrated' },
};
const noMirrorImageSkin: ChatBubbleSkin = {
  ...mirroredImageSkin,
  mirror: { allowed: false },
  tail: { kind: 'none' },
};
const explicitDirectionalSkin: ChatBubbleSkin = {
  ...mirroredImageSkin,
  mirror: { allowed: false, leftAsset: { kind: 'url', url: '/assets/skin-l.png' }, rightAsset: { kind: 'url', url: '/assets/skin-r.png' } },
};

describe('resolveMessageBubblePresentation', () => {
  it('defaults to css when theme has no bubbleSkin', () => {
    const p = resolveMessageBubblePresentation({ theme: createRuneDefaultChatTheme(), isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(p.skinMode).toBe('css');
    expect(p.image).toBeNull();
    expect(p.role).toBe('self');
    expect(p.orientation).toBe('right');
  });

  it('derives role and orientation from group / self', () => {
    const group = resolveMessageBubblePresentation({ theme: themeWith(cssSkin), isSelf: false, isGroup: true, messageType: 'text', position: 'only' });
    expect(group.role).toBe('group-participant');
    expect(group.orientation).toBe('left');
    const direct = resolveMessageBubblePresentation({ theme: themeWith(cssSkin), isSelf: false, isGroup: false, messageType: 'text', position: 'only' });
    expect(direct.role).toBe('agent');
    expect(direct.orientation).toBe('left');
  });

  it('forces css fallback for non-text message types even with an image skin', () => {
    const p = resolveMessageBubblePresentation({ theme: themeWith(mirroredImageSkin), isSelf: true, isGroup: false, messageType: 'image', position: 'only' });
    expect(p.skinMode).toBe('css');
    expect(p.image).toBeNull();
  });

  it('uses right asset directly and left mirrored when mirroring is allowed', () => {
    const right = resolveMessageBubblePresentation({ theme: themeWith(mirroredImageSkin), isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(right.skinMode).toBe('image');
    expect(right.image?.mirrored).toBe(false);
    const left = resolveMessageBubblePresentation({ theme: themeWith(mirroredImageSkin), isSelf: false, isGroup: false, messageType: 'text', position: 'only' });
    expect(left.skinMode).toBe('image');
    expect(left.image?.mirrored).toBe(true);
  });

  it('falls back to css on the left when mirroring is disallowed and no left asset', () => {
    const left = resolveMessageBubblePresentation({ theme: themeWith(noMirrorImageSkin), isSelf: false, isGroup: false, messageType: 'text', position: 'only' });
    expect(left.skinMode).toBe('image');
    expect(left.image?.cssFallback).toBe(true);
  });

  it('prefers explicit directional assets over mirroring', () => {
    const right = resolveMessageBubblePresentation({ theme: themeWith(explicitDirectionalSkin), isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(describeBubblePresentation(right)).toBe('image:right:/assets/skin-r.png:direct');
    const left = resolveMessageBubblePresentation({ theme: themeWith(explicitDirectionalSkin), isSelf: false, isGroup: false, messageType: 'text', position: 'only' });
    expect(describeBubblePresentation(left)).toBe('image:left:/assets/skin-l.png:direct');
  });

  it('css tail hides when an image tail owns the geometry', () => {
    const integrated = resolveMessageBubblePresentation({ theme: themeWith(mirroredImageSkin), isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(shouldShowCssTail(integrated)).toBe(false);
    const cssSkinTheme = themeWith({ ...mirroredImageSkin, tail: { kind: 'css' } });
    const cssTail = resolveMessageBubblePresentation({ theme: cssSkinTheme, isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(shouldShowCssTail(cssTail)).toBe(true);
  });

  it('exposes content insets + slice as inline CSS vars (pure, no DOM)', () => {
    const p = resolveMessageBubblePresentation({ theme: themeWith(mirroredImageSkin), isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    const vars = bubblePresentationStyleVars(p);
    expect((vars as Record<string, string>)['--bubble-skin-slice']).toBe('20 28 20 28');
    expect((vars as Record<string, string>)['--bubble-skin-pad-left']).toBe('18px');
    expect((vars as Record<string, string>)['--bubble-skin-mirrored']).toBe('0');
  });

  it('does not mutate the theme object', () => {
    const theme = themeWith(mirroredImageSkin);
    const snapshot = JSON.stringify(theme);
    resolveMessageBubblePresentation({ theme, isSelf: true, isGroup: false, messageType: 'text', position: 'only' });
    expect(JSON.stringify(theme)).toBe(snapshot);
  });
});
