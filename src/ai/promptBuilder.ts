import type { AiPromptingData, MemoryEntry, WorldBookEntry } from '@/types';

interface BuildParams {
  prompting: AiPromptingData;
  chatMessages: { role: string; content: string }[];
  memories?: MemoryEntry[];
  diaryEntries?: { scene: string; bodyThoughts: string; createdAt: number }[];
  currentUserMessage: string;
}

export function buildPromptContext(params: BuildParams): { role: string; content: string }[] {
  const { prompting, chatMessages, memories, diaryEntries, currentUserMessage } = params;
  const messages: { role: string; content: string }[] = [];

  // 1. System prompt
  const sysParts: string[] = [];
  if (prompting.systemPrompt) sysParts.push(prompting.systemPrompt);
  if (prompting.characterPrompt) sysParts.push(prompting.characterPrompt);
  if (prompting.stylePrompt) sysParts.push(prompting.stylePrompt);
  if (prompting.safetyPrompt) sysParts.push(prompting.safetyPrompt);
  if (sysParts.length > 0) {
    messages.push({ role: 'system', content: sysParts.join('\n\n') });
  }

  // 2. World Book matching
  if (prompting.worldBookEnabled) {
    const matched = matchWorldBook(prompting.worldBookEntries, currentUserMessage, chatMessages);
    for (const entry of matched) {
      messages.push({ role: 'system', content: `[世界書：${entry.title}]\n${entry.content}` });
    }
  }

  // 3. Memory injection
  if (prompting.memoryEnabled) {
    const injected = selectMemories(memories || [], diaryEntries || [], prompting.memoryLimit, prompting.diaryMemoryEnabled, currentUserMessage);
    if (injected.length > 0) {
      const memText = injected.map((m) => `- ${m.scene || m.bodyThoughts?.slice(0, 80) || '記憶片段'}`).join('\n');
      messages.push({ role: 'system', content: `[近期記憶]\n${memText}` });
    }
  }

  // 4. Chat history
  const recentChat = chatMessages.slice(-20);
  for (const msg of recentChat) {
    messages.push(msg);
  }

  // 5. Current user message
  messages.push({ role: 'user', content: currentUserMessage });

  return messages;
}

function matchWorldBook(entries: WorldBookEntry[], userMsg: string, chatMessages: { role: string; content: string }[]): WorldBookEntry[] {
  if (!entries || entries.length === 0) return [];
  const recentText = chatMessages.slice(-4).map((m) => m.content).join(' ') + ' ' + userMsg;
  const matched = entries
    .filter((e) => e.enabled)
    .filter((e) => e.keywords.some((kw) => recentText.includes(kw)))
    .sort((a, b) => b.priority - a.priority);
  return matched.slice(0, 5);
}

function selectMemories(
  memories: MemoryEntry[],
  diaryEntries: { scene: string; bodyThoughts: string; createdAt: number }[],
  limit: number,
  includeDiary: boolean,
  userMsg: string,
): (MemoryEntry | { scene: string; bodyThoughts: string; createdAt: number })[] {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  let pool = memories.filter((m) => m.createdAt > weekAgo);

  if (includeDiary) {
    const recentDiary = diaryEntries.filter((d) => d.createdAt > weekAgo);
    pool = [...pool, ...recentDiary.map((d) => ({ ...d, id: '', triggerText: '', anxietyLevel: 0, nextStep: '', updatedAt: d.createdAt } as MemoryEntry))];
  }

  // Sort: keyword match first, then by recency
  const keywords = userMsg.split(/\s+/).filter((w) => w.length > 1);
  const scored = pool.map((m) => {
    const text = (m.scene + m.bodyThoughts).toLowerCase();
    const matchCount = keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
    return { item: m, score: matchCount * 10 + (m.createdAt / 86400000) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
