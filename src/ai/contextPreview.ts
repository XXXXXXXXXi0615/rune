/**
 * contextPreview.ts
 * ── Structured context preview for UI visualization ──
 *
 * Provides structured context item data and budget calculations
 * for the ContextBar chips, ContextDrawer, and Header badge.
 *
 * Does NOT modify retrieval.ts, memory retrieval, prompt assembly,
 * or context budget rules — only reads from store state for display.
 */

import type { ReferenceChip } from '@/components/chat/AttachmentSheet';
import type {
  SleepReceipt,
  FocusSessionEntry,
  MemoryEntry,
} from '@/types';
import { buildReferenceContext } from '@/ai/referenceContext';
import { buildMemoryContext } from '@/ai/memoryContext';
import { retrieveRelevantContext } from '@/ai/retrieval';

// ── Types ──

export interface ContextItem {
  id: string;
  category: 'reference' | 'memory' | 'auto';
  icon: string;
  label: string;
  detail: string;
}

export interface ContextBudget {
  referenceChars: number;
  memoryChars: number;
  autoChars: number;
  totalChars: number;
}

export interface ContextSnapshot {
  items: ContextItem[];
  budget: ContextBudget;
}

// ── Builders ──

/** Convert user-attached reference chips into structured context items. */
export function buildReferenceItems(chips: ReferenceChip[]): ContextItem[] {
  return chips.map((chip) => ({
    id: chip.id,
    category: 'reference' as const,
    icon: chip.icon,
    label: chip.label,
    detail: chip.detail,
  }));
}

/** Build structured auto-context preview items from store data (no message filtering). */
export function buildAutoPreviewItems(store: {
  sleepReceipts: SleepReceipt[];
  focusSessionLog: FocusSessionEntry[];
}): ContextItem[] {
  const items: ContextItem[] = [];

  const sleep = [...(store.sleepReceipts || [])].sort((a, b) => b.createdAt - a.createdAt);
  if (sleep.length > 0) {
    items.push({
      id: 'auto-sleep',
      category: 'auto',
      icon: '😴',
      label: '睡眠',
      detail: `${sleep.length} 筆收據`,
    });
  }

  const focus = (store.focusSessionLog || []).filter((s) => s.status === 'completed');
  if (focus.length > 0) {
    items.push({
      id: 'auto-focus',
      category: 'auto',
      icon: '🎯',
      label: '專注',
      detail: `${focus.length} 筆記錄`,
    });
  }

  return items;
}

/** Build structured memory preview items with the same cap as buildMemoryContext. */
export function buildMemoryPreviewItems(
  entries: MemoryEntry[],
  retrievalResult: MemoryEntry[] = [],
): ContextItem[] {
  const source = retrievalResult.length > 0 ? retrievalResult : entries.slice(0, 3);
  return source.map((entry, i) => {
    const summary = entry.scene || entry.summary || entry.triggerText || entry.bodyThoughts || '';
    return {
      id: `memory-preview-${entry.id}`,
      category: 'memory' as const,
      icon: '🧠',
      label: '記憶',
      detail: summary.slice(0, 60),
    };
  });
}

// ── Budget ──

const BUDGET_TOTAL = 4000;

/** Compute character budgets by actually calling the build functions. */
export function computeContextBudget(
  referenceChips: ReferenceChip[],
  memoryEntries: MemoryEntry[],
  autoDb: {
    sleepReceipts: SleepReceipt[];
    focusSessionLog: FocusSessionEntry[];
    memoryEntries: MemoryEntry[];
  },
  sampleMessage: string = '',
): ContextBudget {
  const refText = buildReferenceContext(referenceChips);
  const autoText = retrieveRelevantContext(sampleMessage || '最近', autoDb);
  const memText = buildMemoryContext(memoryEntries);

  return {
    referenceChars: refText.length,
    memoryChars: memText.length,
    autoChars: autoText.length,
    totalChars: refText.length + memText.length + autoText.length,
  };
}

export { BUDGET_TOTAL };

// ── Context Trace (per-reply trace of what was used) ──

export interface ContextTraceEntry {
  icon: string;
  label: string;
}

export interface ContextTracePayload {
  references: ContextTraceEntry[];
  memoryCount: number;
  autoLabels: string[];
}

/** Parse auto context string to extract category labels found between 【】 */
export function parseAutoContextLabels(autoText: string): string[] {
  if (!autoText) return [];
  const matches = autoText.match(/【(.+?)】/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

/** Build a trace payload from the data available during reply generation. */
export function buildContextTracePayload(
  references: ReferenceChip[],
  memoryCount: number,
  autoText: string,
): ContextTracePayload {
  return {
    references: references.map((r) => ({ icon: r.icon, label: r.label })),
    memoryCount,
    autoLabels: parseAutoContextLabels(autoText),
  };
}
