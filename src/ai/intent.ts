/**
 * Intent Layer
 * ———————
 * Detects user intent and drives both thinking + reply generation.
 * Guarantees thinking and reply use the same intent.
 */

import { getPersonaReply, DEFAULT_TRAITS, type PersonaTraits } from './persona';

// ── Types ──

export type Intent =
  | 'identity'   // 你是谁 / 你是 / 名字
  | 'location'   // 这是哪 / 這裡是 / 在哪
  | 'greeting'   // 你好 / 早安 / hi / hello
  | 'emotion'    // 累 / 難過 / 開心 / 生氣 / emoji
  | 'question'   // 為什麼 / 怎麼 / 什麼
  | 'complaint'  // 抱怨 / 煩 / 討厭
  | 'memory'     // 記得 / 以前 / 回憶
  | 'other';     // fallback

// ── Intent detection ──

interface IntentRule {
  intent: Intent;
  patterns: RegExp[];
  /** Priority weight — higher wins when multiple match */
  weight: number;
}

const RULES: IntentRule[] = [
  {
    intent: 'identity',
    patterns: [
      /你是誰|你是谁|你是谁？|你是誰？|我是誰|我是谁|我是谁？|我是誰？/i,
      /你是|你叫什麼|你叫什么|你的名字|我是|我叫|我的名字/i,
      /who are you|who am i|your name|my name/i,
    ],
    weight: 100,
  },
  {
    intent: 'location',
    patterns: [
      /這是哪|这是哪|這裡是|这里是|在哪|什麼地方|什么地方|這是什麼地方|这是什么地方/i,
      /where (is|am) (this|i)/i,
    ],
    weight: 100,
  },
  {
    intent: 'greeting',
    patterns: [
      /^(你好|hi|hello|嗨|哈囉|hey|早安|午安|晚安|晚上好|早啊)/i,
      /^(good morning|good evening|good night|good afternoon)/i,
    ],
    weight: 90,
  },
  {
    intent: 'complaint',
    patterns: [
      /生氣|怒|火大|不爽|討厭|恨|好氣|真的很氣|煩死|煩躁|崩潰/i,
      /😡|🤬|💢/,
    ],
    weight: 85,
  },
  {
    intent: 'emotion',
    patterns: [
      /累|疲憊|疲倦|睏|想睡|沒力|耗盡|虛脫|沒電|懶|不想動|躺/i,
      /難過|傷心|哭|流淚|好想哭|悲傷|憂鬱|低落|沮喪/i,
      /開心|快樂|高興|幸福|好棒|太好了|讚|耶|哈哈|笑|爽/i,
      /焦慮|緊張|壓力|擔心|害怕|恐慌|不安|煩/i,
      /😴|🥱|😢|😭|😊|😄|🥰|😰|😨|😖|🙃|😐|😑/,
      /tired|exhaust|sleepy|sad|cry|happy|anxious|anxiety|stress/i,
    ],
    weight: 80,
  },
  {
    intent: 'question',
    patterns: [
      /[？?]/,
      /為什麼|为什么|怎麼辦|怎么办|怎麼|怎么|如何|何時|何地|何種/i,
      /嗎$|呢$|吧$/,
      /what|why|how|when|where|who/i,
    ],
    weight: 70,
  },
  {
    intent: 'memory',
    patterns: [
      /記得|记得|以前|過去|过去|從前|从前|小時候|小时候|還記得|还记得|回憶|回忆|那時候|那时候/i,
      /remember|past|before|memory|memories/i,
    ],
    weight: 85,
  },
];

export function detectIntent(message: string): Intent {
  const trimmed = message.trim();
  if (!trimmed) return 'other';

  let best: { intent: Intent; weight: number } = { intent: 'other', weight: 0 };

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        if (rule.weight > best.weight) {
          best = { intent: rule.intent, weight: rule.weight };
        }
      }
    }
  }

  return best.intent;
}

// ── Intent labels (for display) ──

export const INTENT_LABELS: Record<Intent, string> = {
  identity: '身份詢問',
  location: '地點確認',
  greeting: '打招呼',
  emotion: '情緒表達',
  question: '提問',
  complaint: '抱怨',
  memory: '回憶',
  other: '一般對話',
};

// ── Intent-driven thinking ──

export interface IntentThinking {
  characterThought: string;
  runtimeSteps: string[];
}

export function generateIntentThinking(intent: Intent, message: string): IntentThinking {
  const trimmed = message.trim();
  switch (intent) {
    case 'identity':
      return {
        characterThought: '她在問我是誰。不是在質疑，是在確認。應該說我的名字和身份，不用太正式。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：身份詢問', '讀取角色設定', '生成身份回覆'],
      };
    case 'location':
      return {
        characterThought: '她在確認自己所在的位置。不是在問地理，是在問這個空間是什麼。應該回答月潮。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：地點確認', '讀取世界書：月潮', '生成地點回覆'],
      };
    case 'greeting':
      return {
        characterThought: '打招呼而已。看看現在幾點，決定用什麼語氣回。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：打招呼', '檢查時間', '生成問候回覆'],
      };
    case 'emotion':
      return {
        characterThought: `她現在${trimmed.length < 10 ? '情緒比較強烈' : '在表達一些感受'}。先接住情緒，不要急著給解法。`,
        runtimeSteps: ['讀取使用者訊息', '識別意圖：情緒表達', '分析情緒類型', '生成共感回覆'],
      };
    case 'complaint':
      return {
        characterThought: '她在抱怨。先讓她說完，不用立刻解決問題。簡短回應比較好。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：抱怨', '選擇簡短回應'],
      };
    case 'question':
      return {
        characterThought: '她在問問題。先確認問題的類型，再決定要認真回答還是輕鬆帶過。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：提問', '分析問題類型', '生成回答'],
      };
    case 'memory':
      return {
        characterThought: '在回想過去的事。這種時候不用太多話，讓她把記憶說完就好。',
        runtimeSteps: ['讀取使用者訊息', '識別意圖：回憶', '生成陪伴型回覆'],
      };
    default:
      return {
        characterThought: '嗯，她在跟我說話。語氣還算平穩，先聽她說完。',
        runtimeSteps: ['讀取使用者訊息', '生成一般回覆'],
      };
  }
}

// ── Intent-driven reply (persona-flavored, guaranteed consistent) ──

export function generateIntentReply(intent: Intent, message: string, traits?: PersonaTraits): string[] {
  const t = traits || DEFAULT_TRAITS;
  const { primary, followUp } = getPersonaReply(intent, message, t);
  if (followUp) {
    // 40% chance to use multi-message for follow-up
    return Math.random() < 0.4 ? [primary, followUp] : [primary];
  }
  return [primary];
}
