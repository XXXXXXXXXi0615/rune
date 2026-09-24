import type { MemoryEntry } from '@/types';

/**
 * Unified memory category predicates.
 *
 * Both the CATEGORIES sidebar and TYPE_FILTERS chips in the Memory page
 * use these predicates. Previously the `tide` filter had inconsistent
 * definitions across the two UI surfaces (sidebar excluded `emotion`).
 */

export const MEMORY_PREDICATES: Record<string, (e: MemoryEntry) => boolean> = {
  all: () => true,

  /** Chat-sourced entries and tide bookmarks */
  tide: (e) =>
    e.triggerText === '來自聊天' ||
    e.cardType === 'forum_bookmark' ||
    e.category === 'emotion',

  /** Luna-generated summaries and dialogue/emotion entries */
  luna: (e) =>
    !!e.summary ||
    e.category === 'dialogue' ||
    e.category === 'emotion',

  /** Explicit dialogue entries */
  dialogue: (e) => e.category === 'dialogue',

  /** Inspiration / idea entries */
  inspiration: (e) =>
    e.category === 'idea' ||
    (e.triggerText || '').includes('靈感') ||
    (e.triggerText || '').includes('inspiration'),

  /** Journal entries */
  diary: (e) => e.cardType === 'journal',

  /** Works / creations */
  works: (e) => e.triggerText === '來自作品庫',

  /** Chat-sourced only */
  chat: (e) => e.triggerText === '來自聊天',

  /** User-authored notes */
  user: (e) =>
    e.cardType === 'journal' ||
    (!e.cardType &&
      e.triggerText !== '來自聊天' &&
      e.triggerText !== '來自作品庫') ||
    (e.cardType !== 'todo' &&
      e.cardType !== 'forum_bookmark' &&
      e.cardType !== 'health' &&
      e.cardType !== 'diet_receipt' &&
      e.cardType !== 'sleep_receipt'),
};

/**
 * Get entries matching a category ID.
 * Wraps the predicate in a try-catch for safety.
 */
export function getEntriesByCategory(entries: MemoryEntry[], categoryId: string): MemoryEntry[] {
  const pred = MEMORY_PREDICATES[categoryId];
  if (!pred) return entries;
  return entries.filter(pred);
}
