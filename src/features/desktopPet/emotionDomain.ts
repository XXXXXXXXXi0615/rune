export const COMPANION_EMOTIONS = ['neutral', 'joy', 'curious', 'focused', 'confused', 'concerned', 'frustrated', 'tired', 'surprised', 'playful'] as const;
export type CompanionEmotion = typeof COMPANION_EMOTIONS[number];
export type EmotionSignalSource = 'model' | 'runtime' | 'interaction' | 'system';

export interface AIEmotionSignal {
  primary: CompanionEmotion;
  secondary?: CompanionEmotion;
  valence: number;
  arousal: number;
  intensity: number;
  confidence: number;
  ttlMs: number;
  publicCue?: string;
  createdAt: number;
  source: EmotionSignalSource;
}

export const NEUTRAL_EMOTION = (source: EmotionSignalSource = 'system', now = Date.now()): AIEmotionSignal => ({ primary: 'neutral', valence: 0, arousal: .2, intensity: .2, confidence: 1, ttlMs: 30_000, publicCue: '平靜待機', createdAt: now, source });
export const isCompanionEmotion = (value: unknown): value is CompanionEmotion => typeof value === 'string' && (COMPANION_EMOTIONS as readonly string[]).includes(value);
export const clampEmotionNumber = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
