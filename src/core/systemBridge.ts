/* ═══════════════════════════════════════════════════════
   systemBridge.ts — Global System Integration Layer

   Unifies LifeRhythm, Gacha, Chat, and Memory into a
   single state-driven system.

   Event flow:
     checkin      → +streak → +drift → +gachaChance
     gacha_pull   → -gachaChance → +memoryEvent → ±moodBias
     chat_message → reads moodBias → affects response tone
     memory_save  → logs event → ±moodBias

   State model:
     streak      consecutive active days from daily log
     drift       7-day rolling avg activity score
     driftState  calm | balanced | warm
     moodBias    computed mood vector [-1.0, +1.0]
     gachaChance accumulated pull opportunities
   ═══════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react';
import { logAIContextRead } from './aiTelemetry';

/* ── Types ── */

export type DriftState = 'calm' | 'balanced' | 'warm';
export type MoodState = 'calm' | 'neutral' | 'warm';

export interface SystemState {
  /** Consecutive active days */
  streak: number;
  /** 7-day rolling average activity score */
  drift: number;
  /** drift tier */
  driftState: DriftState;
  /** computed mood vector [-1.0, +1.0] */
  moodBias: number;
  /** accumulated gacha pull opportunities */
  gachaChance: number;
}

export interface SystemMemoryEvent {
  id: string;
  type: 'checkin' | 'gacha_pull' | 'chat_message' | 'memory_save';
  data: Record<string, unknown>;
  timestamp: number;
}

export interface EmotionalReward {
  emoji: string;
  item: string;
  /** How much the reward shifts mood [-1.0, +1.0] */
  moodDelta: number;
  /** How much the reward shifts personality drift [-0.5, +0.5] */
  driftDelta: number;
  /** Emotional impact tier */
  rarity: 'gentle' | 'warm' | 'rare' | 'luminous';
}

export type SystemEvent =
  | { type: 'checkin'; payload?: Record<string, unknown> }
  | { type: 'gacha_pull'; payload?: Record<string, unknown> }
  | { type: 'chat_message'; payload?: Record<string, unknown> }
  | { type: 'memory_save'; payload?: Record<string, unknown> };

/* ── Emotional Reward Pool ── */

export const EMOTIONAL_REWARD_POOL: EmotionalReward[] = [
  { emoji: '🌌', item: '銀河回響',       moodDelta: +0.80, driftDelta: +0.45, rarity: 'luminous' },
  { emoji: '🌙', item: 'Luna 的晚安吻',  moodDelta: +0.55, driftDelta: +0.30, rarity: 'rare' },
  { emoji: '🎀', item: 'Luna 的蝴蝶結',  moodDelta: +0.50, driftDelta: +0.25, rarity: 'rare' },
  { emoji: '💎', item: '記憶水晶',       moodDelta: +0.60, driftDelta: +0.35, rarity: 'rare' },
  { emoji: '🍀', item: '幸運草標本',     moodDelta: +0.45, driftDelta: +0.20, rarity: 'rare' },
  { emoji: '🔮', item: '夢境漣漪',       moodDelta: +0.35, driftDelta: +0.18, rarity: 'warm' },
  { emoji: '📿', item: '寧靜念珠',       moodDelta: +0.30, driftDelta: +0.15, rarity: 'warm' },
  { emoji: '🧿', item: '護身符',         moodDelta: +0.25, driftDelta: +0.12, rarity: 'warm' },
  { emoji: '⭐', item: '一顆碎星',       moodDelta: +0.15, driftDelta: +0.08, rarity: 'gentle' },
  { emoji: '🌸', item: '夜櫻花瓣',       moodDelta: +0.12, driftDelta: +0.05, rarity: 'gentle' },
  { emoji: '🕯️', item: '月潮燭火',       moodDelta: +0.10, driftDelta: +0.06, rarity: 'gentle' },
  { emoji: '✨', item: '星光塵埃',       moodDelta: +0.08, driftDelta: +0.04, rarity: 'gentle' },
];

/* ── localStorage keys (shared with LifeRhythmCenter) ── */

const DAILY_LOG_KEY = 'lunartide_daily_log';
const BRIDGE_STATE_KEY = 'lunartide_system_bridge_state';
const BRIDGE_EVENTS_KEY = 'lunartide_system_bridge_events';

/* ═══════════════════════════════════════════
   INTERNAL STATE (module-level singleton)
   ═══════════════════════════════════════════ */

let _state: SystemState = loadBridgeState();
let _events: SystemMemoryEvent[] = loadBridgeEvents();
const _listeners = new Set<() => void>();

function loadBridgeState(): SystemState {
  try {
    const raw = localStorage.getItem(BRIDGE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        streak: parsed.streak ?? 0,
        drift: parsed.drift ?? 0,
        driftState: parsed.driftState ?? 'balanced',
        moodBias: parsed.moodBias ?? 0,
        gachaChance: parsed.gachaChance ?? 0,
      };
    }
  } catch { /* ignore corrupt state */ }
  return { streak: 0, drift: 0, driftState: 'balanced', moodBias: 0, gachaChance: 0 };
}

function saveBridgeState(state: SystemState): void {
  try {
    localStorage.setItem(BRIDGE_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function loadBridgeEvents(): SystemMemoryEvent[] {
  try {
    const raw = localStorage.getItem(BRIDGE_EVENTS_KEY);
    if (raw) return JSON.parse(raw).slice(-50);
  } catch {}
  return [];
}

function saveBridgeEvents(events: SystemMemoryEvent[]): void {
  try {
    localStorage.setItem(BRIDGE_EVENTS_KEY, JSON.stringify(events.slice(-50)));
  } catch {}
}

function notify(): void {
  _listeners.forEach((fn) => fn());
}

/* ═══════════════════════════════════════════
   DAILY LOG (shared persistence layer)
   ═══════════════════════════════════════════ */

function addDailyLog(): void {
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(DAILY_LOG_KEY);
    const log: Record<string, number> = raw ? JSON.parse(raw) : {};
    log[todayKey] = (log[todayKey] || 0) + 1;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    for (const key of Object.keys(log)) {
      if (key < cutoffKey) delete log[key];
    }
    localStorage.setItem(DAILY_LOG_KEY, JSON.stringify(log));
  } catch {}
}

function getDailyLog(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DAILY_LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* ═══════════════════════════════════════════
   STATE COMPUTATION (pure functions)
   ═══════════════════════════════════════════ */

function computeStreak(): number {
  const log = getDailyLog();
  let count = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (log[key] && log[key] > 0) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

function computeDrift(): { avg: number; state: DriftState; days: number } {
  const log = getDailyLog();
  if (Object.keys(log).length === 0) {
    return { avg: 0, state: 'balanced', days: 0 };
  }
  const today = new Date();
  const past7: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    past7.push(log[key] || 0);
  }
  const total = past7.reduce((s, v) => s + v, 0);
  const avg = total / 7;
  const activeDays = past7.filter((v) => v > 0).length;
  let state: DriftState = 'balanced';
  if (avg < 1.5 && activeDays < 4) state = 'calm';
  else if (avg > 3.5) state = 'warm';
  return { avg: Math.round(avg * 10) / 10, state, days: activeDays };
}

function computeMoodBias(): number {
  const recentEvents = _events.filter(
    (e) => e.type === 'checkin' || e.type === 'gacha_pull',
  );
  const baseCount = recentEvents.length;
  const driftMod =
    _state.driftState === 'calm' ? -1.0 : _state.driftState === 'warm' ? 1.0 : 0;
  const effectiveCount = baseCount + driftMod;
  if (effectiveCount <= 1) return -0.8;
  if (effectiveCount >= 4) return 0.8;
  return Math.round((-0.8 + ((effectiveCount - 1) / 3) * 1.6) * 10) / 10;
}

function recalcState(): void {
  const drift = computeDrift();
  const streak = computeStreak();
  _state = {
    streak,
    drift: drift.avg,
    driftState: drift.state,
    moodBias: 0, // computed on next step
    gachaChance: _state.gachaChance,
  };
  _state.moodBias = computeMoodBias();
  saveBridgeState(_state);
  notify();
}

/* ═══════════════════════════════════════════
   EMOTIONAL REWARD ENGINE
   ═══════════════════════════════════════════ */

/**
 * Attune to the moon tide — select a reward weighted
 * by current emotional state. Higher moodBias increases
 * the chance of rarer rewards, creating a self-reinforcing
 * emotional feedback loop.
 */
function pullEmotionalReward(): EmotionalReward {
  const roll = Math.random();
  const moodBoost = _state.moodBias > 0 ? _state.moodBias * 0.08 : 0;
  const driftBoost = _state.driftState === 'warm' ? 0.04 : 0;
  const lowMoodMercy = _state.moodBias < -0.3 ? 0.03 : 0;

  let rarity: EmotionalReward['rarity'];
  const rareThreshold = 0.07 + moodBoost + driftBoost + lowMoodMercy;      // ~7–19%
  const warmThreshold = rareThreshold + 0.22;                               // next tier
  const luminousThreshold = 0.04 + moodBoost * 0.5;                         // ~4–8%

  if (roll < luminousThreshold) rarity = 'luminous';
  else if (roll < rareThreshold) rarity = 'rare';
  else if (roll < warmThreshold) rarity = 'warm';
  else rarity = 'gentle';

  const pool = EMOTIONAL_REWARD_POOL.filter((r) => r.rarity === rarity);
  const reward = pool[Math.floor(Math.random() * pool.length)] || EMOTIONAL_REWARD_POOL[0];

  // Apply emotional feedback — reward changes internal state
  _state.moodBias = Math.min(1.0, Math.max(-1.0, _state.moodBias + reward.moodDelta));
  _state.drift = Math.min(10.0, Math.max(0.0, _state.drift + reward.driftDelta));

  return reward;
}

function addMemoryEvent(
  type: SystemMemoryEvent['type'],
  data: Record<string, unknown> = {},
): void {
  const event: SystemMemoryEvent = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    data,
    timestamp: Date.now(),
  };
  _events.push(event);
  saveBridgeEvents(_events);
}

/* ═══════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════ */

/**
 * Returns the current system state (streak / drift / moodBias / gachaChance).
 */
export function getSystemState(): Readonly<SystemState> {
  return _state;
}

/**
 * Returns the recent system memory event log (last 50 events).
 */
export function getMemoryEvents(): ReadonlyArray<SystemMemoryEvent> {
  return _events;
}

/**
 * Subscribe to system state changes. Returns an unsubscribe function.
 */
export function subscribeSystemState(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/**
 * Central event dispatcher. All system mutations flow through here.
 *
 * ```ts
 * handleSystemEvent({ type: 'checkin' })
 * handleSystemEvent({ type: 'gacha_pull' })
 * handleSystemEvent({ type: 'chat_message', payload: { text, sender } })
 * handleSystemEvent({ type: 'memory_save', payload: { scene } })
 * ```
 */
export function handleSystemEvent(event: SystemEvent): void {
  switch (event.type) {
    /* ── CHECK-IN ── */
    case 'checkin': {
      addDailyLog();
      _state.gachaChance += 1 + Math.floor(_state.streak / 3);
      saveBridgeState(_state);
      addMemoryEvent('checkin', event.payload || {});
      recalcState();
      break;
    }

    /* ── EMOTIONAL REWARD ── */
    case 'gacha_pull': {
      if (_state.gachaChance <= 0) return;
      _state.gachaChance -= 1;
      const reward = pullEmotionalReward();
      // Luminous rewards echo through the daily log
      if (reward.rarity === 'luminous') {
        addDailyLog();
      }
      saveBridgeState(_state);
      addMemoryEvent('gacha_pull', {
        emoji: reward.emoji,
        item: reward.item,
        rarity: reward.rarity,
        moodDelta: reward.moodDelta,
        driftDelta: reward.driftDelta,
      });
      recalcState();
      break;
    }

    /* ── CHAT MESSAGE ── */
    case 'chat_message': {
      const moodContext = _state.moodBias;
      addMemoryEvent('chat_message', {
        moodBias: moodContext,
        driftState: _state.driftState,
        ...event.payload,
      });
      recalcState();
      break;
    }

    /* ── MEMORY SAVE ── */
    case 'memory_save': {
      addMemoryEvent('memory_save', event.payload || {});
      recalcState();
      break;
    }
  }
}

/**
 * Current mood context for chat / AI systems.
 * ChatPage can call this to modulate Luna's response tone.
 */
export function getChatMoodContext(): {
  moodBias: number;
  driftState: DriftState;
  streak: number;
  gachaChance: number;
} {
  logAIContextRead({ moodBias: _state.moodBias, driftState: _state.driftState, streak: _state.streak, gachaChance: _state.gachaChance });
  return {
    moodBias: _state.moodBias,
    driftState: _state.driftState,
    streak: _state.streak,
    gachaChance: _state.gachaChance,
  };
}

/* ═══════════════════════════════════════════
   REACT HOOK
   ═══════════════════════════════════════════ */

const emptySubscribe = (cb: () => void) => subscribeSystemState(cb);

/**
 * React hook — subscribes to system state changes.
 *
 * ```tsx
 * const { streak, drift, moodBias, gachaChance } = useSystemState()
 * ```
 */
export function useSystemState(): SystemState {
  return useSyncExternalStore(emptySubscribe, getSystemState);
}
