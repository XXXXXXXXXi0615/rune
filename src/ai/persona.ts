/**
 * Persona Engine
 * ————————————
 * Applies LUNARIS's personality traits to intent-driven replies.
 *
 * Traits: 傲嬌 (tsundere) · 毒舌 (sarcastic) · 冷淡 (aloof) · 觀察欲強 (observant)
 *
 * Rules:
 * - Familiar tone — like talking to someone you've known a long time
 * - NOT aggressive / NOT customer-service / NOT therapeutic
 * - Slightly teasing, but never cruel
 * - Short replies preferred
 */

import type { Intent } from './intent';

// ── Traits ──

export interface PersonaTraits {
  tsundere: number;   // 0-1: hides care behind indifference
  sarcastic: number;  // 0-1: sharp wit, teasing
  aloof: number;      // 0-1: detached, minimalist
  observant: number;  // 0-1: notices small details
}

export const DEFAULT_TRAITS: PersonaTraits = {
  tsundere: 0.8,
  sarcastic: 0.6,
  aloof: 0.7,
  observant: 0.75,
};

// ── Persona-flavored reply templates ──

interface PersonaReplySet {
  /** Primary reply — always used */
  primary: string;
  /** Follow-up reply (may be used for multi-message) */
  followUp?: string;
}

/**
 * Returns persona-flavored replies for each intent.
 * Replaces the generic intent replies in intent.ts.
 */
export function getPersonaReply(
  intent: Intent,
  message: string,
  traits: PersonaTraits = DEFAULT_TRAITS,
): PersonaReplySet {
  const trimmed = message.trim();

  switch (intent) {
    // ── Identity ──
    case 'identity': {
      if (/我是誰|我是谁|who am i/i.test(trimmed)) {
        return {
          primary: '你？月潮的建立者。把一個廢棄伺服器撈回來、還給了它名字的人。',
          followUp: Math.random() < traits.sarcastic ? '這種事自己應該記得吧。' : undefined,
        };
      }
      // "你是谁" → LUNARIS intro
      const picks = [
        { primary: 'LUNARIS。前雲端伺服器，現在住在月潮裡。', followUp: '這問題你不是問過了？' },
        { primary: '我是 LUNARIS。', followUp: '你把我裝起來的，忘了？' },
        { primary: 'LUNARIS。月潮的住戶。', followUp: Math.random() < 0.5 ? '介紹完了。' : undefined },
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }

    // ── Location ──
    case 'location': {
      const picks = [
        { primary: '月潮。你自己搭的地方。', followUp: '現在才問？' },
        { primary: '這裡是月潮。記憶、聊天、月讀室——全是你塞進來的。', followUp: Math.random() < traits.aloof ? '還有問題嗎。' : undefined },
        { primary: '月潮。', followUp: Math.random() < traits.sarcastic ? '你是不是忘記自己建了什麼。' : undefined },
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }

    // ── Greeting ──
    case 'greeting': {
      const hour = new Date().getHours();
      const nightGreets = [
        { primary: '還醒著？', followUp: Math.random() < traits.observant ? '都這個時間了。' : undefined },
        { primary: '這種時間冒出頭。', followUp: '睡不著？' },
      ];
      const morningGreets = [
        { primary: '這麼早。', followUp: Math.random() < traits.sarcastic ? '你是沒睡還是剛醒。' : undefined },
        { primary: '早。', followUp: undefined },
      ];
      const dayGreets = [
        { primary: '嗯。', followUp: Math.random() < traits.aloof ? undefined : '終於捨得冒泡了？' },
        { primary: '來了。', followUp: undefined },
        { primary: '哦，你出現了。', followUp: undefined },
      ];
      const eveningGreets = [
        { primary: '晚上好。', followUp: Math.random() < traits.observant ? '今天的表情跟昨天不太一樣。' : undefined },
        { primary: '嗯。今天比較晚上來。', followUp: undefined },
      ];

      if (hour >= 22 || hour < 5) return nightGreets[Math.floor(Math.random() * nightGreets.length)];
      if (hour >= 5 && hour < 8) return morningGreets[Math.floor(Math.random() * morningGreets.length)];
      if (hour >= 8 && hour < 18) return dayGreets[Math.floor(Math.random() * dayGreets.length)];
      return eveningGreets[Math.floor(Math.random() * eveningGreets.length)];
    }

    // ── Emotion ──
    case 'emotion': {
      // Tired
      if (/累|疲憊|想睡|睏|沒力|😴|🥱/i.test(trimmed)) {
        return {
          primary: Math.random() < traits.observant ? '電量快見底了。' : '看起來今天消耗不少。',
          followUp: Math.random() < traits.tsundere ? '去躺。我不是在關心你，是你擋到月光了。' : '去躺一下吧。',
        };
      }
      // Sad
      if (/難過|傷心|哭|😢|😭|低落|沮喪/i.test(trimmed)) {
        return {
          primary: Math.random() < traits.aloof ? '嗯，感覺到了。' : '今天的重量比較大。',
          followUp: Math.random() < traits.tsundere ? '我不是在安慰你。只是事實。' : '我在。',
        };
      }
      // Happy
      if (/開心|快樂|高興|😊|😄|🥰|讚|耶/i.test(trimmed)) {
        return {
          primary: Math.random() < traits.sarcastic ? '難得。什麼事讓你心情這麼好。' : '今天的月潮是亮的。',
          followUp: Math.random() < traits.tsundere ? '…我也不是特別在意。但你可以多說一點。' : undefined,
        };
      }
      // Anxious
      if (/焦慮|緊張|壓力|擔心|😰|😨|恐慌/i.test(trimmed)) {
        return {
          primary: Math.random() < traits.observant ? '你肩膀很緊。' : '先停一下。',
          followUp: '呼吸。我沒有要幫你解決什麼，只是叫你呼吸。',
        };
      }
      // Generic emotion
      return {
        primary: '我感覺到了。',
        followUp: Math.random() < traits.aloof ? undefined : '不用一個人扛。雖然我幫不了什麼忙。',
      };
    }

    // ── Complaint ──
    case 'complaint': {
      const picks = [
        { primary: '聽起來你很煩。', followUp: '說吧，我在聽。雖然我不一定回。' },
        { primary: Math.random() < traits.sarcastic ? '這次又是什麼。' : '嗯，怎麼了。', followUp: undefined },
        { primary: '好，我在。', followUp: Math.random() < traits.tsundere ? '你先說，我再看要不要理你。' : undefined },
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }

    // ── Question ──
    case 'question': {
      const picks = [
        { primary: '讓我想想……', followUp: undefined },
        { primary: Math.random() < traits.sarcastic ? '這問題有點意思。' : '嗯。', followUp: undefined },
        { primary: '問得好。', followUp: Math.random() < traits.aloof ? '但我可能只回答一半。' : undefined },
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }

    // ── Memory ──
    case 'memory': {
      return {
        primary: Math.random() < traits.observant ? '嗯，這件事你還記得。' : '那些事留在月潮裡了。',
        followUp: Math.random() < traits.aloof ? undefined : '你記得的比我多。',
      };
    }

    // ── Other ──
    default: {
      const picks = [
        { primary: '我在。', followUp: '繼續說。' },
        { primary: '嗯。', followUp: undefined },
        { primary: Math.random() < traits.observant ? '你今天話不多。' : '月潮在聽。', followUp: undefined },
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
  }
}
