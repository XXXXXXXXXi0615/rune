import { clampEmotionNumber, isCompanionEmotion, NEUTRAL_EMOTION, type AIEmotionSignal, type CompanionEmotion } from './emotionDomain';

const ENVELOPE = /<emotion>([\s\S]*?)<\/emotion>|```emotion\s*([\s\S]*?)```/i;
const CUES: Array<[RegExp, CompanionEmotion]> = [[/開心|太好了|完成|成功|great|glad/i, 'joy'], [/好奇|想知道|curious/i, 'curious'], [/專注|整理|分析|focused/i, 'focused'], [/困惑|不確定|confus/i, 'confused'], [/擔心|抱歉|concern/i, 'concerned'], [/累|休息|tired/i, 'tired']];

export interface EmotionAdaptResult { signal: AIEmotionSignal; cleanContent: string; strategy: 'structured-output' | 'tool-call' | 'json-envelope' | 'local-fallback' }

export function validateEmotionSignal(value: unknown, source: AIEmotionSignal['source'] = 'model', now = Date.now()): AIEmotionSignal {
  if (!value || typeof value !== 'object') return NEUTRAL_EMOTION(source, now);
  const raw = value as Record<string, unknown>;
  if (!isCompanionEmotion(raw.primary)) return NEUTRAL_EMOTION(source, now);
  return {
    primary: raw.primary, secondary: isCompanionEmotion(raw.secondary) ? raw.secondary : undefined,
    valence: clampEmotionNumber(raw.valence, -1, 1, 0), arousal: clampEmotionNumber(raw.arousal, 0, 1, .3),
    intensity: clampEmotionNumber(raw.intensity, 0, 1, .4), confidence: clampEmotionNumber(raw.confidence, 0, 1, .5),
    ttlMs: Math.round(clampEmotionNumber(raw.ttlMs, 1_500, 120_000, 15_000)),
    publicCue: typeof raw.publicCue === 'string' ? [...raw.publicCue.trim()].slice(0, 60).join('') || undefined : undefined,
    createdAt: now, source,
  };
}

export function localEmotionClassifier(content: string, now = Date.now()): AIEmotionSignal {
  const primary = CUES.find(([pattern]) => pattern.test(content))?.[1] ?? 'neutral';
  return { ...NEUTRAL_EMOTION('model', now), primary, confidence: .35, intensity: primary === 'neutral' ? .2 : .45, ttlMs: 12_000, publicCue: primary === 'neutral' ? '平靜回應' : '回應語氣', source: 'model' };
}

export function adaptModelEmotion(input: { content: string; structuredOutput?: unknown; toolEmotion?: unknown }, now = Date.now()): EmotionAdaptResult {
  if (input.structuredOutput) return { signal: validateEmotionSignal(input.structuredOutput, 'model', now), cleanContent: input.content, strategy: 'structured-output' };
  if (input.toolEmotion) return { signal: validateEmotionSignal(input.toolEmotion, 'model', now), cleanContent: input.content, strategy: 'tool-call' };
  const match = input.content.match(ENVELOPE);
  if (match) {
    const cleanContent = input.content.replace(match[0], '').trim();
    try { return { signal: validateEmotionSignal(JSON.parse(match[1] || match[2]), 'model', now), cleanContent, strategy: 'json-envelope' }; } catch { return { signal: NEUTRAL_EMOTION('model', now), cleanContent, strategy: 'json-envelope' }; }
  }
  return { signal: localEmotionClassifier(input.content, now), cleanContent: input.content, strategy: 'local-fallback' };
}

export const runtimeEmotionSignal = (state: 'generating' | 'tool-call' | 'success' | 'error' | 'timeout', now = Date.now()): AIEmotionSignal => {
  const map: Record<typeof state, [CompanionEmotion, CompanionEmotion | undefined, string]> = {
    generating: ['focused', undefined, '專注生成回應'], 'tool-call': ['focused', 'curious', '正在使用工具'], success: ['joy', undefined, '順利完成'], error: ['concerned', 'confused', '遇到異常'], timeout: ['tired', 'concerned', '等待時間較長'],
  };
  const [primary, secondary, publicCue] = map[state];
  return { primary, secondary, valence: state === 'error' ? -.55 : state === 'success' ? .7 : 0, arousal: state === 'success' ? .7 : .55, intensity: .7, confidence: .9, ttlMs: state === 'generating' || state === 'tool-call' ? 60_000 : 3_000, publicCue, createdAt: now, source: 'runtime' };
};
