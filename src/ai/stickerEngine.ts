import happySrc from '@/assets/lunaris/clawd-happy.gif.gif';
import idleSrc from '@/assets/lunaris/clawd-idle.gif.gif';
import readingSrc from '@/assets/lunaris/clawd-idle-reading.gif.gif';
import thinkingSrc from '@/assets/lunaris/clawd-thinking.gif.gif';
import sleepingSrc from '@/assets/lunaris/clawd-sleeping.gif.gif';
import errorSrc from '@/assets/lunaris/clawd-error.gif.gif';
import sweepingSrc from '@/assets/lunaris/clawd-sweeping.gif.gif';
import carryingSrc from '@/assets/lunaris/clawd-carrying.gif.gif';
import jugglingSrc from '@/assets/lunaris/clawd-juggling.gif.gif';
import typingSrc from '@/assets/lunaris/clawd-typing.gif.gif';
import buildingSrc from '@/assets/lunaris/clawd-building.gif.gif';
import musicSrc from '@/assets/lunaris/clawd-headphones-groove.gif.gif';
import notificationSrc from '@/assets/lunaris/clawd-notification.gif.gif';

export interface StickerPoolItem {
  id: string;
  name: string;
  url: string;
  tags: string[];
}

export const LUNARIS_STICKER_POOL: StickerPoolItem[] = [
  { id: 'luna-happy',     name: '開心', url: happySrc,       tags: ['happy', 'joy', 'celebrate', 'warm'] },
  { id: 'luna-idle',      name: '閒置', url: idleSrc,        tags: ['idle', 'neutral', 'calm'] },
  { id: 'luna-reading',   name: '閱讀', url: readingSrc,     tags: ['reading', 'study', 'focus', 'calm'] },
  { id: 'luna-thinking',  name: '思考', url: thinkingSrc,    tags: ['thinking', 'ponder', 'analyze'] },
  { id: 'luna-sleeping',  name: '睡覺', url: sleepingSrc,    tags: ['sleeping', 'rest', 'tired', 'peace'] },
  { id: 'luna-error',     name: '錯誤', url: errorSrc,       tags: ['sad', 'error', 'fail', 'regret', 'upset'] },
  { id: 'luna-sweeping',  name: '打掃', url: sweepingSrc,    tags: ['sweeping', 'clean', 'organize'] },
  { id: 'luna-carrying',  name: '搬運', url: carryingSrc,    tags: ['carrying', 'bring', 'deliver'] },
  { id: 'luna-juggling',  name: '雜耍', url: jugglingSrc,    tags: ['juggling', 'play', 'fun', 'celebrate'] },
  { id: 'luna-typing',    name: '打字', url: typingSrc,       tags: ['typing', 'write', 'work'] },
  { id: 'luna-building',  name: '建造', url: buildingSrc,    tags: ['building', 'create', 'make', 'work'] },
  { id: 'luna-music',     name: '音樂', url: musicSrc,       tags: ['music', 'listen', 'relax', 'calm'] },
  { id: 'luna-notif',     name: '通知', url: notificationSrc, tags: ['notification', 'remind', 'alert'] },
];

const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy:        ['開心', '高興', '幸福', '快樂', '笑', '棒', '讚', '太好了', '開心呢', '嘻嘻', '哈哈', '喜歡', '愛', '感動', '溫暖', 'warm'],
  sad:          ['傷心', '難過', '悲傷', '哭', '可惜', '遺憾', '失望', '遺憾', '嗚', '唉', '無奈', '對不起', '抱歉', '抱歉呢'],
  sleeping:     ['睡覺', '晚安', '休息', '疲倦', '累', '睏', '想睡', '打哈欠', '早點休息', '好睏'],
  reading:      ['讀', '看書', '閱讀', '學習', 'study', 'learn'],
  thinking:     ['想', '思考', '猜', '或許', '嗯...', '嗯。', '讓我想想', '考慮', '推測'],
  sweeping:     ['打掃', '清理', '整理', '收拾', 'clean', 'tidy'],
  carrying:     ['搬', '帶', '拿', '送', 'bring', 'carry', '送來'],
  juggling:     ['玩', '表演', '有趣', '玩耍', '遊戲', '好有趣', '好玩'],
  typing:       ['寫', '打', '記錄', '記事', '筆記', 'write'],
  building:     ['建造', '做', '製作', '建立', '創建', '設計', 'create', 'build', 'make'],
  music:        ['音樂', '聽', '歌', '旋律', '節奏', 'music', 'song', 'listen'],
  notification: ['通知', '提醒', '記得', '別忘了', '提醒你', '注意'],
  idle:         ['無聊', '發呆', '空閒', '沒事', 'boring', '沒事做'],
  celebrate:    ['恭喜', '慶祝', '祝賀', '太好了', '成功', '達成', '完成', 'celebrate'],
};

export function detectEmotion(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return emotion;
      }
    }
  }
  return null;
}

export function selectStickerByEmotion(emotion: string): StickerPoolItem | null {
  const matches = LUNARIS_STICKER_POOL.filter((s) => s.tags.includes(emotion));
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

export function selectStickerForResponse(text: string): StickerPoolItem | null {
  const emotion = detectEmotion(text);
  if (!emotion) return null;
  return selectStickerByEmotion(emotion);
}
