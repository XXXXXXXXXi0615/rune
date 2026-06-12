// ================================================================
// Simple local anxiety score estimator — not medical diagnosis
// ================================================================

interface EstimateResult {
  score: number;
  signals: string[];
}

const HIGH_ANXIETY_ZH = ['崩潰', '完蛋', '受不了', '喘不過氣', '恐慌', '想消失', '快死了'];
const HIGH_ANXIETY_EN = ['panic', 'overwhelmed', 'can\'t breathe', 'terrified', 'want to disappear'];

const MED_ANXIETY_ZH = ['焦慮', '緊張', '煩', '失眠', '壓力', '擔心', '難受', '害怕', '好怕'];
const MED_ANXIETY_EN = ['anxious', 'stressed', 'worried', 'scared', 'nervous', 'insomnia', 'afraid'];

const LOW_NEG_ZH = ['累', '困', '低落', '空', '麻木', '不安', '有點煩', '不太好'];
const LOW_NEG_EN = ['tired', 'numb', 'empty', 'low', 'uneasy', 'down', 'not great'];

const CALM_ZH = ['安靜', '平靜', '還好', '慢慢來', '可以', '沒事', '開心', '幸福', '溫暖', '好多了'];
const CALM_EN = ['calm', 'peaceful', 'okay', 'fine', 'happy', 'warm', 'better', 'good', 'nice'];

function countMatches(text: string, words: string[]): number {
  let count = 0;
  for (const w of words) {
    if (text.includes(w)) count++;
  }
  return count;
}

export function estimateAnxietyScore(text: string): EstimateResult {
  const signals: string[] = [];
  let score = 2;

  const highZH = countMatches(text, HIGH_ANXIETY_ZH);
  const highEN = countMatches(text, HIGH_ANXIETY_EN);
  if (highZH + highEN > 0) { score += 3 * (highZH + highEN); signals.push('high-anxiety'); }

  const medZH = countMatches(text, MED_ANXIETY_ZH);
  const medEN = countMatches(text, MED_ANXIETY_EN);
  if (medZH + medEN > 0) { score += 2 * (medZH + medEN); signals.push('medium-anxiety'); }

  const lowZH = countMatches(text, LOW_NEG_ZH);
  const lowEN = countMatches(text, LOW_NEG_EN);
  if (lowZH + lowEN > 0) { score += 1 * (lowZH + lowEN); signals.push('low-negative'); }

  // Punctuation intensity
  const exclamations = (text.match(/[！!]/g) || []).length;
  const questions = (text.match(/[？?]/g) || []).length;
  if (exclamations + questions > 2) { score += 1; signals.push('intense-punctuation'); }

  // Short text with no negatives → cap low
  const hasAnyNegative = highZH + highEN + medZH + medEN + lowZH + lowEN > 0;
  if (text.trim().length <= 15 && !hasAnyNegative) {
    score = Math.min(score, 3);
  }

  // Calm words
  const calmZH = countMatches(text, CALM_ZH);
  const calmEN = countMatches(text, CALM_EN);
  if (calmZH + calmEN > 0) { score -= 1 * (calmZH + calmEN); signals.push('calm-signals'); }

  return {
    score: Math.max(1, Math.min(10, score)),
    signals,
  };
}

export function getNextStep(anxiety: number): string {
  if (anxiety <= 3) return 'zh-TW:把這一刻留在這裡就好。|en:Just leave this moment here.';
  if (anxiety <= 6) return 'zh-TW:先停一下，喝水，慢慢呼吸。|en:Pause, drink water, breathe slowly.';
  return 'zh-TW:先離開刺激源，做三次深呼吸，再決定下一步。|en:Step away, take three deep breaths, then decide.';
}
