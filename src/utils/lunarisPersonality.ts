import { useState, useEffect, useCallback } from 'react';
import type { Message } from '@/types';

/* ── Types ── */

export interface LunarisPersonality {
  tone: 'warm' | 'neutral' | 'cool' | 'playful';
  trustLevel: number;
  attachmentLevel: number;
  updatedAt: number;
}

export interface MemoryDrift {
  recentMessageCount: number;
  userMessageCount: number;
  responseDelayMs: number;
  emotionalTone: 'positive' | 'neutral' | 'low';
  engagement: 'high' | 'medium' | 'low';
}

export type LunarisEmotionV3 = 'attentive' | 'curious' | 'playful' | 'warm' | 'gentle' | 'tired' | 'distant' | 'default';

/* ── Defaults ── */

const DEFAULT_PERSONALITY: LunarisPersonality = {
  tone: 'warm',
  trustLevel: 40,
  attachmentLevel: 30,
  updatedAt: Date.now(),
};

const STORAGE_KEY = 'lunartide_personality_v1';

/* ── Memory Drift ── */
export function computeMemoryDrift(messages: Message[]): MemoryDrift {
  const now = Date.now();
  const HOUR = 3600000;

  const recentMessages = messages.filter(m => (now - new Date(m.time).getTime()) < HOUR);
  const userMessages = recentMessages.filter(m => m.sender === 'me');
  const recentCount = recentMessages.length;
  const userCount = userMessages.length;

  const interactionPairs: { userTs: number; aiTs: number }[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].sender === 'me' && messages[i + 1].sender !== 'me') {
      const userTime = new Date(messages[i].time).getTime();
      const aiTime = new Date(messages[i + 1].time).getTime();
      if (aiTime > userTime && (now - userTime < HOUR)) {
        interactionPairs.push({ userTs: userTime, aiTs: aiTime });
      }
    }
  }

  let responseDelayMs = 0;
  if (interactionPairs.length > 0) {
    responseDelayMs = interactionPairs.reduce((s, p) => s + (p.aiTs - p.userTs), 0) / interactionPairs.length;
  }

  const stickerEmojis = recentMessages.filter(m =>
    m.type === 'sticker' ||
    (m.type === 'text' && (m as any).stickerUrl)
  ).length;
  let emotionalTone: MemoryDrift['emotionalTone'] = 'neutral';
  if (stickerEmojis > 3 && userCount > 5) emotionalTone = 'positive';
  if (recentCount < 3 && messages.length < 10) emotionalTone = 'low';

  let engagement: MemoryDrift['engagement'] = 'medium';
  if (userCount > 10 && responseDelayMs < 10000) engagement = 'high';
  if (userCount < 3 || (recentCount > 0 && userCount === 0)) engagement = 'low';

  return { recentMessageCount: recentCount, userMessageCount: userCount, responseDelayMs, emotionalTone, engagement };
}

/* ── Emotion Engine v3 ── */
export function computeEmotion(
  personality: LunarisPersonality,
  drift: MemoryDrift,
  aiState: 'idle' | 'thinking' | 'streaming' | 'error',
): LunarisEmotionV3 {
  if (aiState === 'error') return 'tired';
  if (aiState === 'thinking') {
    if (personality.tone === 'playful' || drift.emotionalTone === 'positive') return 'curious';
    if (drift.engagement === 'high') return 'attentive';
    return 'gentle';
  }
  if (aiState === 'streaming') {
    if (personality.tone === 'warm') return 'warm';
    if (personality.tone === 'playful') return 'playful';
    return 'gentle';
  }
  // idle
  if (drift.engagement === 'low' && personality.attachmentLevel < 20) return 'distant';
  if (personality.tone === 'warm' && drift.emotionalTone === 'positive') return 'warm';
  return 'default';
}

/* ── Personality update from drift ── */
export function driftPersonality(prev: LunarisPersonality, drift: MemoryDrift): LunarisPersonality {
  const next = { ...prev, updatedAt: Date.now() };

  if (drift.engagement === 'high' && drift.emotionalTone === 'positive') {
    next.trustLevel = Math.min(100, prev.trustLevel + 2);
    next.attachmentLevel = Math.min(100, prev.attachmentLevel + 1);
  } else if (drift.engagement === 'low') {
    next.attachmentLevel = Math.max(0, prev.attachmentLevel - 1);
  }

  if (drift.userMessageCount > 15 && drift.emotionalTone === 'positive') {
    next.tone = 'warm';
  } else if (drift.userMessageCount > 20 && drift.emotionalTone === 'positive') {
    next.tone = 'playful';
  } else if (drift.engagement === 'low' && drift.emotionalTone === 'low') {
    if (next.trustLevel < 25) next.tone = 'cool';
  }

  if (next.trustLevel > 60) next.tone = next.tone === 'cool' ? 'neutral' : 'warm';

  return next;
}

/* ── Hook ── */
function loadPersonality(): LunarisPersonality {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PERSONALITY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PERSONALITY;
}

function savePersonality(p: LunarisPersonality) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export function useLunarisPersonality(messages: Message[]) {
  const [personality, setPersonality] = useState<LunarisPersonality>(loadPersonality);

  const drift = computeMemoryDrift(messages);

  const tick = useCallback(() => {
    setPersonality(prev => {
      const next = driftPersonality(prev, drift);
      if (next.updatedAt !== prev.updatedAt) {
        savePersonality(next);
        return next;
      }
      return prev;
    });
  }, [drift]);

  useEffect(() => {
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [tick]);

  const updatePersonality = useCallback((patch: Partial<LunarisPersonality>) => {
    setPersonality(prev => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      savePersonality(next);
      return next;
    });
  }, []);

  return { personality, drift, updatePersonality, tick };
}

/* ── Emotion label mapping ── */
export function emotionLabel(emotion: LunarisEmotionV3): string {
  switch (emotion) {
    case 'attentive': return '專注聆聽中';
    case 'curious': return '好奇地思考著';
    case 'playful': return '輕快地回應著';
    case 'warm': return '溫暖地回應著';
    case 'gentle': return '溫柔地回應著';
    case 'tired': return '有些疲倦';
    case 'distant': return '靜靜地待著';
    default: return '';
  }
}

/* ── Emotion → dot color ── */
export function emotionDotColor(emotion: LunarisEmotionV3): string {
  switch (emotion) {
    case 'attentive': return '#a78bfa';
    case 'curious': return '#f59e0b';
    case 'playful': return '#ec4899';
    case 'warm': return '#f97316';
    case 'gentle': return '#8bb4a8';
    case 'tired': return '#9ca3af';
    case 'distant': return '#6b7280';
    default: return 'var(--checkin-teal)';
  }
}

/* ── Emotion → bubble tone CSS vars ── */
export function emotionBubbleCSS(emotion: LunarisEmotionV3, tone: LunarisPersonality['tone']): React.CSSProperties {
  const vars: Record<string, string> = {};
  switch (tone) {
    case 'warm': vars['--luna-bubble-hue'] = '15'; break;
    case 'cool': vars['--luna-bubble-hue'] = '240'; break;
    case 'playful': vars['--luna-bubble-hue'] = '330'; break;
    default: vars['--luna-bubble-hue'] = '210'; break;
  }
  switch (emotion) {
    case 'attentive': vars['--luna-bubble-sat'] = '1.15'; break;
    case 'playful': vars['--luna-bubble-sat'] = '1.2'; break;
    case 'tired': vars['--luna-bubble-sat'] = '0.85'; break;
    default: vars['--luna-bubble-sat'] = '1'; break;
  }
  return vars as React.CSSProperties;
}
