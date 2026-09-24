export interface ChatBackgroundConfig {
  source: 'none' | 'custom';
  assetId?: string;
  overlayOpacity: number;
  blurPx: number;
  positionX: number;
  positionY: number;
  scale: number;
  updatedAt: number;
}

export interface ChatBackgroundSettings {
  global?: ChatBackgroundConfig;
  conversationOverrides: Record<string, ChatBackgroundConfig>;
}

export const DEFAULT_CHAT_BACKGROUND_CONFIG: ChatBackgroundConfig = {
  source: 'none', overlayOpacity: 0.55, blurPx: 6,
  positionX: 50, positionY: 50, scale: 100, updatedAt: 0,
};

const numberIn = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, typeof value === 'number' && Number.isFinite(value) ? value : fallback));

export function normalizeChatBackgroundConfig(value: unknown): ChatBackgroundConfig {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const assetId = typeof input.assetId === 'string' && input.assetId.trim() ? input.assetId : undefined;
  return {
    source: input.source === 'custom' && assetId ? 'custom' : 'none',
    ...(assetId ? { assetId } : {}),
    overlayOpacity: numberIn(input.overlayOpacity, DEFAULT_CHAT_BACKGROUND_CONFIG.overlayOpacity, 0, 1),
    blurPx: numberIn(input.blurPx, DEFAULT_CHAT_BACKGROUND_CONFIG.blurPx, 0, 50),
    positionX: numberIn(input.positionX, 50, 0, 100),
    positionY: numberIn(input.positionY, 50, 0, 100),
    scale: numberIn(input.scale, 100, 100, 200),
    updatedAt: numberIn(input.updatedAt, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function normalizeChatBackgroundSettings(value: unknown): ChatBackgroundSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawOverrides = input.conversationOverrides && typeof input.conversationOverrides === 'object'
    ? input.conversationOverrides as Record<string, unknown> : {};
  const conversationOverrides = Object.fromEntries(Object.entries(rawOverrides)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, config]) => [key, normalizeChatBackgroundConfig(config)]));
  return {
    ...(input.global ? { global: normalizeChatBackgroundConfig(input.global) } : {}),
    conversationOverrides,
  };
}

export function selectEffectiveChatBackground({ conversationId, settings }: {
  conversationId?: string | null;
  settings: ChatBackgroundSettings;
}): ChatBackgroundConfig {
  const normalized = normalizeChatBackgroundSettings(settings);
  if (conversationId?.trim()) {
    const override = normalized.conversationOverrides[conversationId];
    if (override?.source === 'custom' && override.assetId) return override;
  }
  if (normalized.global?.source === 'custom' && normalized.global.assetId) return normalized.global;
  return DEFAULT_CHAT_BACKGROUND_CONFIG;
}

export function clearChatBackgroundScope(settings: ChatBackgroundSettings, scope: 'global' | 'conversation', conversationId?: string | null): ChatBackgroundSettings {
  const normalized = normalizeChatBackgroundSettings(settings);
  if (scope === 'global') return { conversationOverrides: normalized.conversationOverrides };
  if (!conversationId?.trim()) return normalized;
  const conversationOverrides = { ...normalized.conversationOverrides };
  delete conversationOverrides[conversationId];
  return { ...normalized, conversationOverrides };
}

export function collectChatBackgroundAssetReferences(settings: ChatBackgroundSettings): Set<string> {
  const normalized = normalizeChatBackgroundSettings(settings);
  const ids = new Set<string>();
  if (normalized.global?.assetId) ids.add(normalized.global.assetId);
  Object.values(normalized.conversationOverrides).forEach((config) => { if (config.assetId) ids.add(config.assetId); });
  return ids;
}
