/**
 * Chat Context Pipeline
 * Builds the full generation context from Prompt Studio + World Book + messages.
 */

import { loadPromptStudio, type PromptStudioData } from '@/config/promptStudio';
import { queryWorldBook, type WorldBookEntry } from '@/config/worldBook';
import type { Message } from '@/types';

export interface ChatContext {
  /** System rules from Prompt Studio */
  system: string;
  /** World building from Prompt Studio */
  world: string;
  /** Matched world book entries */
  worldBookEntries: WorldBookEntry[];
  /** Character card from Prompt Studio */
  character: PromptStudioData['character'];
  /** Relationship data from Prompt Studio */
  relationship: PromptStudioData['relationship'];
  /** Recent messages for context */
  recentMessages: string[];
  /** The current user message(s) */
  userMessage: string;
}

/**
 * Build the full chat generation context.
 * Called before each reply round.
 */
export function generateChatContext(userText: string, messages?: Message[]): ChatContext {
  const studio = loadPromptStudio();
  const wbEntries = queryWorldBook(userText);

  // Recent messages (last 10, user only, for context awareness)
  const recentMessages: string[] = [];
  if (messages) {
    const userMsgs = messages.filter((m) => m.sender === 'me' && m.type === 'text');
    const last10 = userMsgs.slice(-10);
    for (const m of last10) {
      const content = (m as { content: string }).content;
      if (content && content !== userText) {
        recentMessages.push(content);
      }
    }
  }

  return {
    system: studio.system,
    world: studio.world,
    worldBookEntries: wbEntries,
    character: studio.character,
    relationship: studio.relationship,
    recentMessages,
    userMessage: userText,
  };
}

/**
 * Build a condensed context string for mock reply generation.
 */
export function buildContextString(ctx: ChatContext): string {
  const parts: string[] = [];

  // System rules
  if (ctx.system.trim()) {
    parts.push(`[System]\n${ctx.system.trim()}`);
  }

  // World
  if (ctx.world.trim()) {
    parts.push(`[World]\n${ctx.world.trim()}`);
  }

  // World Book matches
  for (const entry of ctx.worldBookEntries) {
    parts.push(`[世界書：${entry.title}]\n${entry.content}`);
  }

  // Character
  const charParts: string[] = [];
  if (ctx.character.name) charParts.push(`名稱：${ctx.character.name}`);
  if (ctx.character.role) charParts.push(`身份：${ctx.character.role}`);
  if (ctx.character.personality) charParts.push(`性格：${ctx.character.personality.replace(/\n/g, '、')}`);
  if (charParts.length > 0) {
    parts.push(`[Character]\n${charParts.join('\n')}`);
  }

  // Relationship
  const relParts: string[] = [];
  if (ctx.relationship.firstMeeting) relParts.push(`初次見面：${ctx.relationship.firstMeeting}`);
  if (ctx.relationship.knownFacts) relParts.push(ctx.relationship.knownFacts);
  if (relParts.length > 0) {
    parts.push(`[Relationship]\n${relParts.join('\n')}`);
  }

  return parts.join('\n\n');
}

/**
 * Determine if the user is asking about world lore.
 * Returns true for questions about location, identity, or concepts.
 */
export function isLoreQuestion(text: string, wbEntries: WorldBookEntry[]): boolean {
  if (wbEntries.length > 0) return true;
  const lorePatterns = [
    /這是哪|这是哪|這裡是|这里是|在哪|什麼地方|什么地方/,
    /你是誰|你是谁|你是|你叫什麼|你叫什么|你的名字/,
    /什麼是|什么是|什麼是|月潮|lunartide|lunaris|noctra/,
    /月讀室|月读室|記憶系統|记忆系统|provider|雲匣|云匣/,
    /這個空間|这个空间|這個世界|这个世界/,
  ];
  return lorePatterns.some((p) => p.test(text));
}
