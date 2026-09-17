import { sendChatMessage } from '@/ai/client';
import { resolveProviderRequestConfig } from '@/ai/providerRuntime';
import type { AIRequestConfig, ChatMessage } from '@/ai/types';
import type { ProviderConfig } from '@/types';

export type GuestConversationRole = 'guest' | 'rune';

export interface GuestConversationMessage {
  id: string;
  role: GuestConversationRole;
  content: string;
}

export const GUEST_SYSTEM_INSTRUCTION = [
  'You are Rune speaking in a temporary pre-auth guest lounge outside the private application.',
  'Use only the messages included in this request.',
  'You have no memory, tools, files, actions, calendar, profile, or authenticated context.',
  'Never claim to remember the guest or to know anything behind the login gate.',
  'Do not request secrets, credentials, or private records.',
  'Reply briefly and calmly in the language used by the guest.',
].join(' ');

export function buildGuestConversationMessages(
  messages: readonly GuestConversationMessage[],
  contextLimit = 20,
): ChatMessage[] {
  const safeLimit = Math.max(1, Math.min(20, Math.trunc(contextLimit) || 20));
  const sessionMessages = messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-safeLimit)
    .map((message): ChatMessage => ({
      role: message.role === 'guest' ? 'user' : 'assistant',
      content: message.content,
    }));

  return [{ role: 'system', content: GUEST_SYSTEM_INSTRUCTION }, ...sessionMessages];
}

export function lockGuestRequestConfig(config: AIRequestConfig): AIRequestConfig {
  return {
    ...config,
    systemPrompt: GUEST_SYSTEM_INSTRUCTION,
    tools: undefined,
    telemetry: undefined,
    persistUsage: false,
  };
}

export async function requestGuestReply(
  provider: ProviderConfig,
  messages: readonly GuestConversationMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const resolved = await resolveProviderRequestConfig(provider, GUEST_SYSTEM_INSTRUCTION);
  const config = lockGuestRequestConfig(resolved);
  const requestMessages = buildGuestConversationMessages(messages, provider.contextMessageLimit);
  let content = '';

  for await (const chunk of sendChatMessage(requestMessages, config, signal)) {
    content += chunk.content;
  }

  const reply = content.trim();
  if (!reply) throw new Error('Guest transport returned no text');
  return reply;
}
