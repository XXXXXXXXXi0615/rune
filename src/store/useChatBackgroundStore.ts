import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearChatBackgroundScope, normalizeChatBackgroundSettings, type ChatBackgroundConfig, type ChatBackgroundSettings } from '@/config/chatBackground';

interface State {
  settings: ChatBackgroundSettings;
  saveGlobal: (config: ChatBackgroundConfig) => void;
  saveConversation: (conversationId: string, config: ChatBackgroundConfig) => boolean;
  clearGlobal: () => void;
  clearConversation: (conversationId: string) => boolean;
}

export const useChatBackgroundStore = create<State>()(persist((set) => ({
  settings: { conversationOverrides: {} },
  saveGlobal: (config) => set((state) => ({ settings: { ...state.settings, global: config } })),
  saveConversation: (conversationId, config) => {
    if (!conversationId.trim()) return false;
    set((state) => ({ settings: { ...state.settings, conversationOverrides: { ...state.settings.conversationOverrides, [conversationId]: config } } }));
    return true;
  },
  clearGlobal: () => set((state) => ({ settings: clearChatBackgroundScope(state.settings, 'global') })),
  clearConversation: (conversationId) => {
    if (!conversationId.trim()) return false;
    set((state) => ({ settings: clearChatBackgroundScope(state.settings, 'conversation', conversationId) }));
    return true;
  },
}), {
  name: 'lunartide_chat_bg_v2',
  version: 3,
  migrate: (persisted) => {
    const legacy = persisted as Record<string, unknown> | undefined;
    if (legacy?.settings) return { ...legacy, settings: normalizeChatBackgroundSettings(legacy.settings) };
    const globalAssetId = typeof legacy?.globalBackgroundAssetId === 'string' ? legacy.globalBackgroundAssetId : '';
    const global = globalAssetId ? normalizeChatBackgroundSettings({ global: {
      source: 'custom', assetId: globalAssetId,
      overlayOpacity: legacy?.globalBackgroundOverlay, blurPx: legacy?.globalBackgroundBlur,
      positionX: 50, positionY: 50, scale: 100, updatedAt: Date.now(),
    } }).global : undefined;
    const raw = legacy?.perChatBackgrounds && typeof legacy.perChatBackgrounds === 'object' ? legacy.perChatBackgrounds as Record<string, Record<string, unknown>> : {};
    const conversationOverrides = Object.fromEntries(Object.entries(raw).filter(([id, item]) => id && item.assetId).map(([id, item]) => [id, normalizeChatBackgroundSettings({ global: {
      source: 'custom', assetId: item.assetId, overlayOpacity: item.overlay, blurPx: item.blur,
      positionX: 50, positionY: 50, scale: 100, updatedAt: Date.now(),
    } }).global!]));
    return { settings: { ...(global ? { global } : {}), conversationOverrides } };
  },
  partialize: (state) => ({ settings: state.settings }),
}));
