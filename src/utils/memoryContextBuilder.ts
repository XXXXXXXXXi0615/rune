import { useAppStore } from '@/store/useAppStore';
import type { MemoryEntry } from '@/types';

interface BuildContextInput {
  userMessage?: string;
  currentRoute?: string;
  maxItems?: number;
}

interface ContextMemory {
  title: string;
  content: string;
  source: string;
  type: string;
  pinned: boolean;
}

function pickMemories(entries: MemoryEntry[], query?: string, maxItems = 5): MemoryEntry[] {
  const eligible = entries.filter((e) => {
    if (!e.allowAiRecall) return false;
    if (e.status === 'trash' || e.status === 'fading') return false;
    if (e.sensitive) return false;
    return true;
  });

  const pinned = eligible.filter((e) => e.pinned);
  const rest = eligible.filter((e) => !e.pinned);

  let scored = rest.map((e) => {
    let score = 0;
    if (query) {
      const q = query.toLowerCase();
      const title = (e.title || e.scene || '').toLowerCase();
      const content = (e.content || e.bodyThoughts || '').toLowerCase();
      if (title.includes(q)) score += 3;
      if (content.includes(q)) score += 1;
      e.tags?.forEach((t) => { if (t.toLowerCase().includes(q)) score += 2; });
    }
    if (e.status === 'pinned') score += 5;
    if (e.source === 'chat') score += 1;
    score -= (Date.now() - e.updatedAt) / (86400000 * 30) * 0.1; // decay over 30 days
    return { entry: e, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const result = [...pinned, ...scored.map((s) => s.entry)].slice(0, maxItems);
  return result;
}

export function buildMemoryContext(input: BuildContextInput = {}): ContextMemory[] {
  const state = useAppStore.getState();
  const entries = state.memoryEntries || [];
  const picked = pickMemories(entries, input.userMessage, input.maxItems || 5);

  return picked.map((e) => ({
    title: e.title || e.scene || '',
    content: e.content || e.bodyThoughts || '',
    source: e.source || 'manual',
    type: e.type || 'note',
    pinned: e.pinned === true,
  }));
}
