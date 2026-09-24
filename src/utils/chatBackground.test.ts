import { describe, expect, it } from 'vitest';
import { clearChatBackgroundScope, collectChatBackgroundAssetReferences, normalizeChatBackgroundConfig, selectEffectiveChatBackground, type ChatBackgroundConfig, type ChatBackgroundSettings } from '@/config/chatBackground';
import { createLatestAssetResolutionGuard } from '@/hooks/useAssetBlobUrl';

const config = (assetId: string): ChatBackgroundConfig => ({ source: 'custom', assetId, overlayOpacity: .4, blurPx: 4, positionX: 50, positionY: 50, scale: 100, updatedAt: 1 });
const settings: ChatBackgroundSettings = { global: config('global'), conversationOverrides: { a: config('a') } };

describe('chat background policy', () => {
  it('selects conversation override before global, then none', () => {
    expect(selectEffectiveChatBackground({ conversationId: 'a', settings }).assetId).toBe('a');
    expect(selectEffectiveChatBackground({ conversationId: 'b', settings }).assetId).toBe('global');
    expect(selectEffectiveChatBackground({ conversationId: 'b', settings: { conversationOverrides: {} } }).source).toBe('none');
  });
  it('guards empty conversation ids', () => {
    expect(clearChatBackgroundScope(settings, 'conversation', '')).toEqual(settings);
    expect(Object.keys(clearChatBackgroundScope(settings, 'conversation', 'a').conversationOverrides)).toEqual([]);
  });
  it('clears global without removing overrides and override falls back to global', () => {
    const noOverride = clearChatBackgroundScope(settings, 'conversation', 'a');
    expect(selectEffectiveChatBackground({ conversationId: 'a', settings: noOverride }).assetId).toBe('global');
    const noGlobal = clearChatBackgroundScope(settings, 'global');
    expect(noGlobal.global).toBeUndefined(); expect(noGlobal.conversationOverrides.a.assetId).toBe('a');
  });
  it('normalizes missing and unsafe values', () => {
    expect(normalizeChatBackgroundConfig({ source: 'custom', assetId: 'x', overlayOpacity: 9, blurPx: -3 })).toMatchObject({ source: 'custom', overlayOpacity: 1, blurPx: 0, positionX: 50, scale: 100 });
    expect(normalizeChatBackgroundConfig({ source: 'custom' }).source).toBe('none');
  });
  it('collects unique references across scopes', () => expect([...collectChatBackgroundAssetReferences({ global: config('same'), conversationOverrides: { a: config('same'), b: config('b') } })].sort()).toEqual(['b', 'same']));
  it('rejects stale async resolutions', () => {
    const guard = createLatestAssetResolutionGuard(); const first = guard.next(); const second = guard.next();
    expect(guard.isLatest(first)).toBe(false); expect(guard.isLatest(second)).toBe(true);
  });
});
