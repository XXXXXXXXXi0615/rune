/**
 * convMemory.ts
 * ── Conversation-level short-term memory ──
 *
 * Auto-generates a summary every 20 messages per conversation.
 * Injected into the system prompt before Reference/Memory/Auto.
 *
 * Does NOT modify retrieval.ts, memoryContext.ts, or prompt assembly.
 */

import type { Message, ConversationSummary } from '@/types';

// ── Tokenization helpers (Chinese-aware) ──

const STOP_CHARS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
  '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没',
  '看', '好', '自己', '这', '他', '她', '它', '们', '那', '什么', '怎么',
  '吗', '吧', '呢', '啊', '哦', '嗯', '哈', '呀', '嘛',
]);

/** Split Chinese text into meaningful segments (2-4 char n-grams). */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Split by punctuation/whitespace
  const segments = text.split(/[\s,，。！？、；：""''（）\(\)\[\]【】\n\r]+/).filter(Boolean);
  for (const seg of segments) {
    if (seg.length <= 1) continue;
    // For short segments, use them directly
    if (seg.length <= 4) {
      tokens.push(seg);
    } else {
      // Extract 2-3 gram sliding windows
      for (let i = 0; i < seg.length - 1; i++) {
        const bigram = seg.slice(i, i + 2);
        if (!STOP_CHARS.has(bigram) && bigram.length >= 2) tokens.push(bigram);
        if (i < seg.length - 2) {
          const trigram = seg.slice(i, i + 3);
          if (trigram.length >= 3) tokens.push(trigram);
        }
      }
    }
  }
  return tokens;
}

/** Count token frequency and return top topics. */
function extractTopics(text: string, maxTopics = 4): string[] {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([word]) => word);
}

// ── Main export ──

const SUMMARY_INTERVAL = 20;

/**
 * Generate a ConversationSummary from a conversation's messages.
 * Called every 20 messages to build short-term memory.
 */
export function generateConversationSummary(messages: Message[]): ConversationSummary {
  const textMessages = messages.filter((m) => m.type === 'text');
  if (textMessages.length === 0) {
    return { summary: '', topics: [], updatedAt: Date.now(), messageCount: messages.length };
  }

  // Take the last SUMMARY_INTERVAL messages for analysis
  const sample = textMessages.slice(-SUMMARY_INTERVAL);
  const sampleText = sample.map((m) => m.content).join('\n');

  // Extract topics
  const topics = extractTopics(sampleText);

  // Build summary from first user message + recent keywords + count
  const firstUserMsg = textMessages.find((m) => m.sender === 'me');
  const firstContent = firstUserMsg?.content?.slice(0, 60) || '';
  const summary = `共 ${textMessages.length} 則，最近話題：${topics.length > 0 ? topics.join('、') : '無'}。${
    firstContent ? `開頭：${firstContent}${firstContent.length >= 60 ? '…' : ''}` : ''
  }`;

  return {
    summary,
    topics,
    updatedAt: Date.now(),
    messageCount: textMessages.length,
  };
}

/**
 * Format a ConversationSummary into a string for system prompt injection.
 * Injected before Reference/Memory/Auto.
 */
export function buildConvMemoryBlock(summary: ConversationSummary): string {
  const section = '【本對話摘要】';
  const summaryLine = summary.summary.slice(0, 200);
  const topicsLine = summary.topics.length > 0
    ? `關鍵話題：${summary.topics.join('、')}`
    : '';
  const msgCountLine = `累計 ${summary.messageCount} 則使用者訊息`;
  return [
    '\n\n' + section,
    summaryLine,
    topicsLine,
    msgCountLine,
  ].filter(Boolean).join('\n');
}

export { SUMMARY_INTERVAL };
