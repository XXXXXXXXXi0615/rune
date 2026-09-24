import type { MemoryEntry } from '@/types';

const KEYWORDS = [
  '焦慮', '焦躁', '緊張', '害怕', '恐慌',
  '工作', '上班', '同事', '老闆', '加班', '職場',
  '睡覺', '失眠', '睡不著', '睡眠', '夢', '醒',
  '家人', '媽媽', '爸爸', '父母', '兄弟', '姐妹', '家裡',
  '學校', '課業', '考試', '老師', '同學', '成績',
  '壓力', '累', '崩潰', '無力', '撐不住',
  '孤單', '寂寞', '一個人', '朋友', '社交',
  '吵架', '衝突', '生氣', '難過', '委屈',
  '開心', '快樂', '幸福', '感動', '感恩',
  '身體', '不舒服', '頭痛', '月經', '經痛',
  '感情', '戀愛', '分手', '伴侶', '對象',
  '未來', '迷惘', '目標', '意義', '人生',
];

const MEMORY_TRIGGER_TERMS = [
  '最近', '今天', '昨天', '之前', '上次', '記得',
  '心情', '狀態', '我', '為什麼', '怎麼了',
  '難受', '焦慮', '睡不著',
];

const MAX_RESULTS_FULL = 5;
const MAX_RESULTS_TRIGGER = 2;

interface ScoredEntry {
  entry: MemoryEntry;
  score: number;
  matchedKeywords: string[];
}

export interface RetrievalResult {
  entries: MemoryEntry[];
  mode: 'keyword' | 'trigger' | 'skip';
}

export function retrieveRelevantMemories(options: {
  entries: MemoryEntry[];
  currentMessage: string;
}): RetrievalResult {
  const { entries, currentMessage } = options;
  if (entries.length === 0) return { entries: [], mode: 'skip' };

  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);

  const activeKeywords = KEYWORDS.filter((kw) => currentMessage.includes(kw));
  const hasTriggers = MEMORY_TRIGGER_TERMS.some((t) => currentMessage.includes(t));

  // Mode 1: keyword match — full scoring
  if (activeKeywords.length > 0) {
    const scored: ScoredEntry[] = sorted.map((entry, index) => {
      let score = 0;
      const matchedKeywords: string[] = [];

      if (index === 0) score += 3;
      else if (index === 1) score += 2;

      const searchText = [
        entry.scene,
        entry.triggerText,
        entry.bodyThoughts,
        entry.nextStep,
        entry.linkedForumPostContent,  // include forum bookmark content
      ]
        .filter(Boolean)
        .join(' ');

      for (const kw of activeKeywords) {
        if (searchText.includes(kw)) {
          score += 1;
          matchedKeywords.push(kw);
        }
      }

      return { entry, score, matchedKeywords };
    });

    scored.sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt);

    const top = scored.slice(0, MAX_RESULTS_FULL);

    console.debug('[AI] relevant memories', { mode: 'keyword', results: top.map((s) => ({
      id: s.entry.id,
      score: s.score,
      matches: s.matchedKeywords,
    })) });

    return { entries: top.map((s) => s.entry), mode: 'keyword' };
  }

  // Mode 2: no keyword, but trigger terms — recent 2 entries only
  if (hasTriggers) {
    const recent = sorted.slice(0, MAX_RESULTS_TRIGGER);

    console.debug('[AI] relevant memories', { mode: 'trigger', results: recent.map((e) => ({
      id: e.id,
      score: 0,
    })) });

    return { entries: recent, mode: 'trigger' };
  }

  // Mode 3: no keyword, no trigger — skip memory injection
  console.debug('[AI] relevant memories', { mode: 'skip', results: [] });
  return { entries: [], mode: 'skip' };
}
