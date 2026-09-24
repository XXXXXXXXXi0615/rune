/**
 * Conversation Engine — context compression, prompt assembly,
 * long-term memory management.
 *
 * Context compression (summarisation) is separate from long-term memory.
 * Summaries participate in prompt assembly only and never modify original messages.
 */

import type { ChatMessage, ContentPart } from '@/ai/types';
import type { Message } from '@/types';
import type {
  ConversationRuntimeSettings,
  ConversationContextState,
  ConversationSummary,
  LongTermMemory,
} from '@/store/useChatRuntimeStore';
import { DEFAULT_SETTINGS, estimateTokens } from '@/store/useChatRuntimeStore';
import type { AIRequestConfig } from '@/ai/types';

/* ── Prompt Assembly ── */

export interface PromptAssemblyInput {
  systemPrompt: string;
  persona?: string;
  settings: ConversationRuntimeSettings;
  contextState: ConversationContextState;
  chatMessages: ChatMessage[];
  rawMessages: Message[];
  currentUserMessage: string;
}

export interface PromptAssemblyOutput {
  systemPrompt: string;
  messages: ChatMessage[];
  usedSummary: boolean;
  rawRoundsUsed: number;
  longTermMemoriesUsed: number;
  estimatedInputTokens: number;
}

/**
 * Assemble the final system prompt and messages for the API request.
 *
 * Assembly order:
 * 1. System Prompt
 * 2. Persona
 * 3. Pinned Long-term Memories
 * 4. Rolling Conversation Summary
 * 5. Recent Raw Messages (based on context strategy)
 * 6. Current User Message
 */
export function assemblePrompt(input: PromptAssemblyInput): PromptAssemblyOutput {
  const { systemPrompt, persona, settings, contextState, chatMessages, rawMessages, currentUserMessage } = input;
  const effective = { ...DEFAULT_SETTINGS, ...settings };

  let fullSystemPrompt = systemPrompt || '';

  // 2. Persona
  if (persona) {
    fullSystemPrompt += '\n\n' + persona;
  }

  // 3. Pinned Long-term Memories
  const activeLtm = contextState.longTermMemories.filter((m) => m.pinned && !m.paused);
  if (activeLtm.length > 0) {
    fullSystemPrompt += '\n\n' + activeLtm.map((m) => `【長期記憶】${m.content}`).join('\n');
  }

  // 4. Rolling Conversation Summary
  let usedSummary = false;
  const currentSummary = contextState.summaryVersions.find(
    (v) => v.version === contextState.currentVersion,
  );
  if (currentSummary) {
    fullSystemPrompt += '\n\n【對話摘要】' + currentSummary.content;
    usedSummary = true;
  }

  // 5. Recent Raw Messages — apply context strategy
  let rawRoundsUsed = 0;
  let messageSlice: Message[];

  switch (effective.contextStrategy) {
    case 'recent':
      messageSlice = rawMessages.slice(-effective.recentRounds);
      rawRoundsUsed = effective.recentRounds;
      break;
    case 'full':
      messageSlice = rawMessages;
      rawRoundsUsed = rawMessages.length;
      break;
    case 'smart':
    default:
      if (effective.autoCompress && usedSummary) {
        // With summary, keep only recent N raw rounds
        messageSlice = rawMessages.slice(-effective.retainRecentRounds);
        rawRoundsUsed = effective.retainRecentRounds;
      } else if (effective.autoCompress && !usedSummary) {
        // No summary yet, but may auto-compress — use full for now
        messageSlice = rawMessages;
        rawRoundsUsed = rawMessages.length;
      } else {
        messageSlice = rawMessages;
        rawRoundsUsed = rawMessages.length;
      }
      break;
  }

  // Convert raw messages to ChatMessage format
  const convertedMessages = messageSlice
    .filter((m) => m.type === 'text' && !m.revoked && !m.deletedAt && !m.deletedForSelfAt && !m.deletedForAllAt)
    .map((m): ChatMessage => ({
      role: m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.type === 'text' ? m.content : '',
    }));

  // 6. Current user message
  if (currentUserMessage.trim()) {
    convertedMessages.push({
      role: 'user',
      content: currentUserMessage,
    });
  }

  // Estimate tokens
  const estimatedInputTokens = estimateTokens(fullSystemPrompt) +
    convertedMessages.reduce((sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : ''), 0);

  return {
    systemPrompt: fullSystemPrompt,
    messages: convertedMessages,
    usedSummary,
    rawRoundsUsed,
    longTermMemoriesUsed: activeLtm.length,
    estimatedInputTokens,
  };
}

/* ── Context Compression (Summarisation) ── */

export interface CompressInput {
  messages: Message[];
  existingSummary?: ConversationSummary;
  targetRounds: number;
  /** Human-readable description of the summarisation threshold/mode for the prompt */
  instruction?: string;
}

/**
 * Build a prompt for the AI to generate a rolling conversation summary.
 *
 * The summary prompt is designed so we can send it as a system instruction
 * to the model at summarisation time.
 */
export function buildCompressPrompt(input: CompressInput): string {
  const { existingSummary, targetRounds } = input;
  const messagesToCompress = input.messages.slice(0, -targetRounds);

  if (messagesToCompress.length === 0) return '';

  const msgTexts = messagesToCompress
    .filter((m) => m.type === 'text' && !m.revoked && !m.deletedAt && !m.deletedForSelfAt && !m.deletedForAllAt)
    .map((m) => {
      const role = m.sender === 'assistant' ? 'LUNARIS' : '使用者';
      return `${role}：${m.type === 'text' ? m.content : ''}`;
    })
    .join('\n');

  const prefix = existingSummary
    ? `之前的摘要：${existingSummary.content}\n\n`
    : '';

  return `${prefix}請用繁體中文生成一段對話摘要（150–300 字），保留：
- 使用者表達的核心需求、情緒、問題
- LUNARIS 的回應重點與建議方向
- 關鍵話題與決策

不要逐字複述訊息。用自然語氣書寫。

原始對話：
${msgTexts}`;
}

/**
 * Estimate whether context should be compressed based on settings.
 * Returns true when estimated token usage exceeds the threshold.
 */
export function shouldCompress(
  totalEstimatedTokens: number,
  maxTokens: number,
  settings: ConversationRuntimeSettings,
): boolean {
  if (!settings.autoCompress) return false;
  const threshold = maxTokens * (settings.compressThreshold / 100);
  return totalEstimatedTokens > threshold;
}

/* ── Long-term Memory Helpers ── */

export function createLongTermMemory(
  content: string,
  sourceMessageIds: string[],
  pinned = false,
): LongTermMemory {
  return {
    id: `ltm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    pinned,
    paused: false,
    sourceMessageIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createConversationSummary(
  content: string,
  version: number,
  sourceStart: number,
  sourceEnd: number,
  previousVersion?: string,
): ConversationSummary {
  return {
    id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    version,
    previousVersion,
    sourceMessageRange: { start: sourceStart, end: sourceEnd },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
