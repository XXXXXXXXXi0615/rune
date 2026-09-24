import type { CompanionState, CompanionMood, Message } from '@/types';

const MOOD_CYCLE: CompanionMood[] = ['idle', 'curious', 'happy', 'focused', 'concerned', 'sleepy', 'annoyed', 'protective', 'quiet'];
const MIN_UPDATE_INTERVAL_MS = 30_000;

const DEFAULT_STATE: CompanionState = {
  mood: 'idle',
  statusText: 'LUNARIS 正安靜陪著你',
  energy: 80,
  focus: 50,
  affection: 60,
  annoyance: 10,
  lastUpdatedAt: 0,
  reason: undefined,
  source: 'rule',
};

/* ── Keyword / heuristic rules ── */
const MOOD_KEYWORDS: Record<CompanionMood, { positive: string[]; negative: string[] }> = {
  idle:        { positive: ['休息', '等等', '沒有'], negative: [] },
  curious:     { positive: ['為什麼', '解釋', '想想', '好奇', '什麼是', '查'], negative: [] },
  happy:       { positive: ['謝謝', '開心', '喜歡', '太好了', '愛', '很棒', '喜歡這個'], negative: ['生氣', '爛', '討厭'] },
  focused:     { positive: ['專注', '任務', '整理', '需求', '架構', 'code', '程式', 'debug', '修正', '實作'], negative: [] },
  concerned:   { positive: ['擔心', '不舒服', '難過', '生病', '累', '不好'], negative: [] },
  sleepy:      { positive: ['晚', '夜', '睡', '睏', '疲勞', '夢', '沒睡'], negative: [] },
  annoyed:     { positive: ['生氣', '爛', '討厭', '不滿', '一直', '又來了', '重複'], negative: ['開玩笑'] },
  protective:  { positive: ['保護', '幫忙', '照顧', '需要', '緊急'], negative: [] },
  quiet:       { positive: ['安靜', '靜靜', '陪伴', '沒事', '還好'], negative: [] },
};

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

export function parseLLMMetadata(text: string): Partial<CompanionState> | null {
  const jsonMatch = text.match(/\{[^}]*"mood"[^}]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.mood || !MOOD_CYCLE.includes(parsed.mood)) return null;
    return {
      mood: parsed.mood as CompanionMood,
      statusText: typeof parsed.statusText === 'string' ? parsed.statusText.slice(0, 80) : undefined,
      energy: typeof parsed.energy === 'number' ? clamp(parsed.energy, 0, 100) : undefined,
      focus: typeof parsed.focus === 'number' ? clamp(parsed.focus, 0, 100) : undefined,
      affection: typeof parsed.affection === 'number' ? clamp(parsed.affection, 0, 100) : undefined,
      annoyance: typeof parsed.annoyance === 'number' ? clamp(parsed.annoyance, 0, 100) : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : undefined,
      source: 'llm' as const,
    };
  } catch {
    return null;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(v), min), max);
}

function countKeywords(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((sum, w) => sum + (lower.includes(w.toLowerCase()) ? 1 : 0), 0);
}

function scoreMood(text: string, mood: CompanionMood): number {
  const kw = MOOD_KEYWORDS[mood];
  let score = 0;
  score += countKeywords(text, kw.positive) * 2;
  score -= countKeywords(text, kw.negative) * 3;
  return score;
}

function moodFromText(text: string): CompanionMood {
  const scores = MOOD_CYCLE.map((mood) => ({ mood, score: scoreMood(text, mood) }));
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return 'idle';
  return scores[0].mood;
}

function statusTextForMood(mood: CompanionMood): string {
  const map: Record<CompanionMood, string> = {
    idle:       'LUNARIS 正安靜陪著你',
    curious:    '嗯？你在想什麼有趣的事？',
    happy:      '跟你聊天很開心呢。',
    focused:    '我正在幫你盯著這件事。',
    concerned:  '你還好嗎？感覺你不太對勁。',
    sleepy:     '夜深了…但我還在這裡。',
    annoyed:    '你是不是又想把功能堆爆了…',
    protective: '有我在，別擔心。',
    quiet:      '靜靜地陪在你旁邊。',
  };
  return map[mood] || map.idle;
}

function applyInertia(current: CompanionState, nextMood: CompanionMood, sameMoodCount: number): CompanionMood {
  if (nextMood === current.mood) return nextMood;
  // If current mood has been stable for 2+ rounds, resist change unless score diff > 4
  if (sameMoodCount >= 2) {
    return current.mood;
  }
  return nextMood;
}

/* ── Exported engine ── */
let _state: CompanionState = { ...DEFAULT_STATE };
let _sameMoodCount = 0;
let _lastUpdate = 0;

export function getCompanionState(): CompanionState {
  return { ..._state };
}

export function setCompanionState(partial: Partial<CompanionState>) {
  _state = { ..._state, ...partial, lastUpdatedAt: Date.now() };
  _lastUpdate = Date.now();
}

export function updateFromAssistantReply(replyText: string, userText?: string) {
  const now = Date.now();
  if (now - _lastUpdate < MIN_UPDATE_INTERVAL_MS) return;

  const llmMeta = parseLLMMetadata(replyText);
  if (llmMeta && llmMeta.mood) {
    const prevMood = _state.mood;
    _state = {
      ..._state,
      mood: llmMeta.mood,
      statusText: llmMeta.statusText || statusTextForMood(llmMeta.mood),
      energy: llmMeta.energy ?? _state.energy,
      focus: llmMeta.focus ?? _state.focus,
      affection: llmMeta.affection ?? _state.affection,
      annoyance: llmMeta.annoyance ?? _state.annoyance,
      reason: llmMeta.reason ?? _state.reason,
      source: 'llm',
      lastUpdatedAt: now,
    };
    _sameMoodCount = prevMood === _state.mood ? _sameMoodCount + 1 : 0;
    _lastUpdate = now;
    return;
  }

  // Rule-based fallback: only look at user messages
  const text = stripTags(userText || '');
  if (!text.trim() || text.length < 2) return;

  const ruleMood = moodFromText(text);
  const finalMood = applyInertia(_state, ruleMood, _sameMoodCount);

  if (finalMood !== _state.mood || now - _lastUpdate > 5 * 60_000) {
    _state = {
      ..._state,
      mood: finalMood,
      statusText: statusTextForMood(finalMood),
      energy: clamp(_state.energy + (Math.random() * 10 - 5), 20, 95),
      focus: clamp(_state.focus + (Math.random() * 8 - 4), 10, 95),
      affection: clamp(_state.affection + (Math.random() * 4 - 2), 10, 95),
      annoyance: clamp(_state.annoyance + (Math.random() * 6 - 3), 0, 70),
      reason: text.slice(0, 80),
      source: 'rule',
      lastUpdatedAt: now,
    };
    _sameMoodCount = finalMood === _state.mood ? _sameMoodCount + 1 : 0;
    _lastUpdate = now;
  }
}

export function resetCompanionState() {
  _state = { ...DEFAULT_STATE };
  _sameMoodCount = 0;
  _lastUpdate = 0;
}
