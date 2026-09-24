/* ═══════════════════════════════════════════════════════
   rewardRules.ts — User-configurable Emotion Reward Rules

   Default rules mirror the systemBridge EMOTIONAL_REWARD_POOL
   but with trigger conditions. Users can add, edit, or delete
   rules. Each pull matches rules by current emotional state.
   ═══════════════════════════════════════════════════════ */

import type { RewardRule } from '@/types';

const LS_KEY = 'lunartide_reward_rules_v1';

export const DEFAULT_RULES: RewardRule[] = [
  {
    id: 'rule-galaxy',
    name: '銀河回響',
    emoji: '🌌',
    condition: {},
    rewardContent: '🌌 銀河回響 — 月潮在你心中泛起最美的漣漪',
    moodDelta: +0.80, driftDelta: +0.45, rarity: 'luminous',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-goodnight',
    name: 'Luna 的晚安吻',
    emoji: '🌙',
    condition: {},
    rewardContent: '🌙 Luna 在你額頭輕輕印下一個晚安吻',
    moodDelta: +0.55, driftDelta: +0.30, rarity: 'rare',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-ribbon',
    name: 'Luna 的蝴蝶結',
    emoji: '🎀',
    condition: {},
    rewardContent: '🎀 Luna 將蝴蝶結繫在你的手腕，說「今天也很好看」',
    moodDelta: +0.50, driftDelta: +0.25, rarity: 'rare',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-crystal',
    name: '記憶水晶',
    emoji: '💎',
    condition: {},
    rewardContent: '💎 記憶水晶在你掌心閃爍，過往的溫柔時光靜靜浮現',
    moodDelta: +0.60, driftDelta: +0.35, rarity: 'rare',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-clover',
    name: '幸運草標本',
    emoji: '🍀',
    condition: {},
    rewardContent: '🍀 月潮送來一片幸運草標本，夾在你的時間裡',
    moodDelta: +0.45, driftDelta: +0.20, rarity: 'rare',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-dream',
    name: '夢境漣漪',
    emoji: '🔮',
    condition: {},
    rewardContent: '🔮 夢境漣漪輕輕捲過，你感受到月光的擁抱',
    moodDelta: +0.35, driftDelta: +0.18, rarity: 'warm',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-beads',
    name: '寧靜念珠',
    emoji: '📿',
    condition: {},
    rewardContent: '📿 寧靜念珠在你指間輕輕滾動，世界慢了下來',
    moodDelta: +0.30, driftDelta: +0.15, rarity: 'warm',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-amulet',
    name: '護身符',
    emoji: '🧿',
    condition: {},
    rewardContent: '🧿 Luna 將護身符放在你手心，「我會保護你的」',
    moodDelta: +0.25, driftDelta: +0.12, rarity: 'warm',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-star',
    name: '一顆碎星',
    emoji: '⭐',
    condition: {},
    rewardContent: '⭐ 夜空中墜下一顆碎星，落入你的日記',
    moodDelta: +0.15, driftDelta: +0.08, rarity: 'gentle',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-petal',
    name: '夜櫻花瓣',
    emoji: '🌸',
    condition: {},
    rewardContent: '🌸 夜櫻花瓣在月潮中飄落，輕柔地拂過你的臉頰',
    moodDelta: +0.12, driftDelta: +0.05, rarity: 'gentle',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-candle',
    name: '月潮燭火',
    emoji: '🕯️',
    condition: {},
    rewardContent: '🕯️ 月潮燭火在你身旁靜靜燃著，溫暖而安穩',
    moodDelta: +0.10, driftDelta: +0.06, rarity: 'gentle',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
  {
    id: 'rule-dust',
    name: '星光塵埃',
    emoji: '✨',
    condition: {},
    rewardContent: '✨ 星光塵埃灑落在你的肩上，像是 Luna 的小秘密',
    moodDelta: +0.08, driftDelta: +0.04, rarity: 'gentle',
    enabled: true, createdAt: 0, updatedAt: 0,
  },
];

export function loadRewardRules(): RewardRule[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: Partial<RewardRule>) => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          name: r.name || '',
          emoji: r.emoji || '✨',
          condition: r.condition || {},
          rewardContent: r.rewardContent || '',
          moodDelta: r.moodDelta ?? 0.1,
          driftDelta: r.driftDelta ?? 0.05,
          rarity: r.rarity || 'gentle',
          enabled: r.enabled !== false,
          createdAt: r.createdAt || Date.now(),
          updatedAt: r.updatedAt || Date.now(),
        }));
      }
    }
  } catch { /* corrupt */ }
  return DEFAULT_RULES;
}

export function saveRewardRules(rules: RewardRule[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rules)); } catch { /* quota */ }
}
