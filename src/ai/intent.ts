/**
 * Intent Classifier
 * —————————————————
 * Detects user intent from message text.
 * Used by memory summary layer for category detection.
 */

export type Intent =
  | 'identity'
  | 'location'
  | 'greeting'
  | 'emotion'
  | 'question'
  | 'complaint'
  | 'memory'
  | 'other';

interface IntentRule {
  intent: Intent;
  patterns: RegExp[];
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
