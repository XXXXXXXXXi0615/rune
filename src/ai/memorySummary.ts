/**
 * Memory Summary Layer
 * —————————————————
 * Generates meaningful summaries and detects categories
 * before storing memories.
 */

import type { MemoryCategory } from '@/types';
import { detectIntent, type Intent } from './intent';

// ── Summary generation ──

/**
 * Generate a one-line summary from the raw content.
 * Converts vague/long text into a concise, searchable memory title.
 */
export function generateMemorySummary(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '未命名記憶';

  // Already short → use as-is (with cleanup)
  if (trimmed.length <= 18) {
    // Clean up template phrases
    const cleaned = cleanupTemplate(trimmed);
    if (cleaned.length <= 18) return cleaned;
  }

  // Use intent detection to guide summary
  const intent = detectIntent(trimmed);

  switch (intent) {
    case 'identity':
      return trimmed.includes('我是') ? '詢問自身身份' : '詢問 LUNARIS 身份';
    case 'location':
      return '詢問目前所在位置';
    case 'greeting':
      return '與 LUNARIS 打招呼';
    case 'emotion': {
      if (/累|疲憊|想睡|睏|沒力|😴|🥱/.test(trimmed)) return '感到疲憊';
      if (/難過|傷心|哭|😢|😭|低落/.test(trimmed)) return '感到難過';
      if (/開心|快樂|高興|😊|😄|🥰/.test(trimmed)) return '感到開心';
      if (/焦慮|緊張|壓力|擔心|😰|😨/.test(trimmed)) return '感到焦慮';
      return '記錄了當下情緒';
    }
    case 'complaint':
      return '表達不滿與抱怨';
    case 'question':
      return `提問：${trimmed.slice(0, 15)}${trimmed.length > 15 ? '…' : ''}`;
    case 'memory':
      return `回想過去：${trimmed.slice(0, 12)}${trimmed.length > 12 ? '…' : ''}`;
    default:
      // Truncate with context
      return trimmed.length <= 24
        ? cleanupTemplate(trimmed)
        : cleanupTemplate(trimmed.slice(0, 22) + '…');
  }
}

// ── Category detection ──

/**
 * Auto-detect memory category from content and intent.
 */
export function detectMemoryCategory(content: string, source?: string): MemoryCategory {
  const trimmed = content.trim();
  const intent = detectIntent(trimmed);

  // Source-based hints
  if (source === 'moonread' || /月讀|閱讀|看書|書|moonread/i.test(trimmed)) return 'reading';
  if (source === 'system' || /系統|更新|部署|構建|build|完成|實作|建立|新增功能/i.test(trimmed)) return 'system';

  // Intent-based
  switch (intent) {
    case 'emotion': return 'emotion';
    case 'complaint': return 'emotion';
    case 'greeting': return 'dialogue';
    case 'question': return 'dialogue';
    case 'identity': return 'dialogue';
    case 'location': return 'dialogue';
    case 'memory': return 'dialogue';
    default: {
      if (/完成|成功|做到|達成|解決|突破/i.test(trimmed)) return 'achievement';
      if (/想法|idea|靈感|想到|也許|可以試/i.test(trimmed)) return 'idea';
      return 'dialogue';
    }
  }
}

// ── Template cleanup ──

const TEMPLATE_PATTERNS = [
  /^嗯[，,]\s*/,
  /^我在[。，,]?\s*/,
  /^月光見證[。，,]?\s*/,
  /^月潮\S*[。，,]?\s*/,
  /^每一次漲退[^。]+[。，,]?\s*/,
  /^你的\S*像\S*[。，,]?\s*/,
  /^繼續說[。，,]?\s*/,
  /^我聽到了[。，,]?\s*/,
  /^我感覺到了[。，,]?\s*/,
  /^收到了[。，,]?\s*/,
];

function cleanupTemplate(text: string): string {
  let result = text;
  for (const pattern of TEMPLATE_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.trim() || text.trim();
}

// ── Dynamic stats ──

export interface MemoryStats {
  total: number;
  thisWeek: number;
  byCategory: Partial<Record<MemoryCategory, number>>;
  dominantCategory: MemoryCategory | null;
  dominantEmotion: string | null;
}

export function computeMemoryStats(
  entries: Array<{ category?: MemoryCategory; bodyThoughts?: string; createdAt: number }>,
): MemoryStats {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const thisWeek = entries.filter((e) => e.createdAt >= weekAgo).length;

  const byCategory: Partial<Record<MemoryCategory, number>> = {};
  for (const e of entries) {
    if (e.category) {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    }
  }

  // Dominant category
  let dominantCategory: MemoryCategory | null = null;
  let maxCount = 0;
  for (const [cat, count] of Object.entries(byCategory)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat as MemoryCategory;
    }
  }

  // Dominant emotion
  const emotions: Record<string, number> = {};
  for (const e of entries) {
    const t = e.bodyThoughts || '';
    if (/疲憊|累|想睡|睏/.test(t)) emotions['疲憊'] = (emotions['疲憊'] || 0) + 1;
    else if (/開心|快樂|高興/.test(t)) emotions['開心'] = (emotions['開心'] || 0) + 1;
    else if (/難過|傷心|低落/.test(t)) emotions['難過'] = (emotions['難過'] || 0) + 1;
    else if (/焦慮|緊張|壓力/.test(t)) emotions['焦慮'] = (emotions['焦慮'] || 0) + 1;
    else if (/生氣|怒|不滿/.test(t)) emotions['憤怒'] = (emotions['憤怒'] || 0) + 1;
    else emotions['平靜'] = (emotions['平靜'] || 0) + 1;
  }

  let dominantEmotion: string | null = null;
  maxCount = 0;
  for (const [emo, count] of Object.entries(emotions)) {
    if (count > maxCount) { maxCount = count; dominantEmotion = emo; }
  }

  return { total: entries.length, thisWeek, byCategory, dominantCategory, dominantEmotion };
}

/**
 * Generate a one-line stats summary for display.
 */
export function formatStatsSummary(stats: MemoryStats): string {
  const parts: string[] = [];
  if (stats.thisWeek > 0) parts.push(`本週新增 ${stats.thisWeek} 條記憶`);
  if (stats.dominantEmotion) parts.push(`最近情緒以「${stats.dominantEmotion}」為主`);
  if (parts.length === 0) parts.push('尚無記憶記錄');
  return parts.join(' · ');
}
