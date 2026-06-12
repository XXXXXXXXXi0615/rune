import type { ChatPresenceStatus, ChatContact, AiConfig } from '@/types';

/**
 * Resolve Luna's effective display presence using the same auto-switch rules
 * used on the chat page. Call this from both the Inbox and the Chat page
 * so they always show the same status.
 */
export function resolveLunaPresence(
  lunaContact: ChatContact | undefined,
  aiConfig: Pick<AiConfig, 'enabled' | 'apiKey' | 'devMockEnabled'>,
  aiState?: 'idle' | 'thinking' | 'streaming' | 'error',
): ChatPresenceStatus {
  const savedPresence = lunaContact?.status || 'online';
  const manualOverride = lunaContact?.manualStatusOverride || false;
  const hasAi = aiConfig.enabled && aiConfig.apiKey;
  const useMock = aiConfig.devMockEnabled && !hasAi;
  const state = aiState || 'idle';

  // If user manually set any status, respect it (don't auto-override)
  if (manualOverride) return savedPresence;
  // AI error → offline
  if (state === 'error') return 'offline';
  // AI thinking/streaming → syncing/online
  if (state === 'thinking') return 'syncing';
  if (state === 'streaming') return 'online';
  // AI not configured → local mode (only when user never manually set status)
  if (!hasAi && !useMock) return 'local';
  // Default to saved
  return savedPresence;
}
