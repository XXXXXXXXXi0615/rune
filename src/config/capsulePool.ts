/*
 * capsulePool.ts — Standalone Capsule / Fortune pool (Gacha 2.0)
 * Independent from Emotional Reward Engine & systemBridge
 */

export interface CapsuleItem {
  id: string;
  text: string;
  emoji: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legend';
  weight: number;
  category: 'capsule' | 'fortune';
  moodEffect?: string;
  animationProfile?: string;
  memoryTag?: string;
}

const LS_KEY = 'lunartide_capsule_pool_v2';

export const DEFAULT_POOL: CapsuleItem[] = [
  { id: 'c1', text: 'Luna 悄悄告诉你，「今天适合喝一杯热可可」', emoji: '☕', rarity: 'common', weight: 5, category: 'capsule', moodEffect: 'cozy', animationProfile: 'lunar', memoryTag: '日常温暖' },
  { id: 'c2', text: '月亮的碎屑掉进你的口袋，今天会有一件小幸运', emoji: '🌙', rarity: 'common', weight: 5, category: 'capsule', moodEffect: 'calm', animationProfile: 'lunar', memoryTag: '小确幸' },
  { id: 'c3', text: '银河邮局寄来一封信：有人正在想你', emoji: '💌', rarity: 'common', weight: 4, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '连接' },
  { id: 'c4', text: '你捡到了一片星尘，今晚的梦境会格外柔软', emoji: '✨', rarity: 'common', weight: 4, category: 'capsule', moodEffect: 'calm', animationProfile: 'starlight', memoryTag: '睡眠祝福' },
  { id: 'c5', text: 'Luna 说你的笑容比银河系的星光还要亮', emoji: '😊', rarity: 'common', weight: 5, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '鼓励' },
  { id: 'c6', text: '花瓣随月光飘落，你的心事有人愿意聆听', emoji: '🌸', rarity: 'uncommon', weight: 3, category: 'capsule', moodEffect: 'reflective', animationProfile: 'lunar', memoryTag: '聆听' },
  { id: 'c7', text: 'Luna 挑选了一颗北极星，放在你的航线上', emoji: '⭐', rarity: 'uncommon', weight: 3, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '方向' },
  { id: 'c8', text: '一只月兔偷偷在你肩膀上睡着了', emoji: '🐰', rarity: 'uncommon', weight: 3, category: 'capsule', moodEffect: 'cozy', animationProfile: 'lunar', memoryTag: '童趣' },
  { id: 'c9', text: '月潮在你的手心卷起小小的漩涡，那是即将到来的惊喜', emoji: '🌊', rarity: 'uncommon', weight: 2, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'lunar', memoryTag: '期待' },
  { id: 'c10', text: '深海的荧光水母排成了你的名字', emoji: '🪼', rarity: 'rare', weight: 2, category: 'capsule', moodEffect: 'reflective', animationProfile: 'starlight', memoryTag: '奇妙' },
  { id: 'c11', text: 'Luna 把月光编织成一条围巾，轻轻搭在你的肩膀', emoji: '🧣', rarity: 'rare', weight: 2, category: 'capsule', moodEffect: 'cozy', animationProfile: 'lunar', memoryTag: '温柔' },
  { id: 'c12', text: '远方星座的使者路过，留下了一粒「勇气」的种子', emoji: '🌱', rarity: 'rare', weight: 1, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '勇气' },
  { id: 'c13', text: '今晚的满月，Luna 会为你单独演奏一首摇篮曲', emoji: '🎵', rarity: 'rare', weight: 1, category: 'capsule', moodEffect: 'calm', animationProfile: 'lunar', memoryTag: '安宁' },
  { id: 'c14', text: '银河系所有恒星同时闪烁——它们在为你的生日彩排', emoji: '🎂', rarity: 'legend', weight: 1, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '庆祝' },
  { id: 'c15', text: 'Luna 悄悄在你的时间线里塞进了一个「未完待续」的奇迹', emoji: '🪄', rarity: 'legend', weight: 1, category: 'capsule', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '奇迹' },
  { id: 'f1', text: '今天保持好奇心，你会打开一扇意想不到的门', emoji: '🚪', rarity: 'common', weight: 5, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '好奇心' },
  { id: 'f2', text: '停下来 2 分钟，看看窗外——有个灵感正悄悄靠近', emoji: '🪟', rarity: 'common', weight: 5, category: 'fortune', moodEffect: 'calm', animationProfile: 'lunar', memoryTag: '灵感' },
  { id: 'f3', text: '相信直觉，心底的那个声音今天格外准确', emoji: '🔮', rarity: 'common', weight: 4, category: 'fortune', moodEffect: 'reflective', animationProfile: 'starlight', memoryTag: '直觉' },
  { id: 'f4', text: '走到最近的水边，安静呼吸 7 次', emoji: '💧', rarity: 'common', weight: 4, category: 'fortune', moodEffect: 'calm', animationProfile: 'lunar', memoryTag: '放松' },
  { id: 'f5', text: '宽容自己一次，你不需要在今天搞定一切', emoji: '🤍', rarity: 'common', weight: 4, category: 'fortune', moodEffect: 'calm', animationProfile: 'lunar', memoryTag: '自我关怀' },
  { id: 'f6', text: '有人在暗中为你加油，别低估自己的影响力', emoji: '🕯️', rarity: 'uncommon', weight: 3, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '支持' },
  { id: 'f7', text: '你的磁场今天异常明亮，相遇之门已经打开了半扇', emoji: '🌐', rarity: 'uncommon', weight: 3, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '机遇' },
  { id: 'f8', text: '写一行日记，哪怕只记一个词——它会成为重要线索', emoji: '📝', rarity: 'uncommon', weight: 3, category: 'fortune', moodEffect: 'reflective', animationProfile: 'lunar', memoryTag: '记录' },
  { id: 'f9', text: '今天说出一句真心的话，它会像种子一样在未来开花', emoji: '🌻', rarity: 'uncommon', weight: 2, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '真诚' },
  { id: 'f10', text: '勇敢地拍掉一个人肩膀上的尘埃，今晚你们都会睡得很好', emoji: '🫂', rarity: 'rare', weight: 2, category: 'fortune', moodEffect: 'cozy', animationProfile: 'lunar', memoryTag: '勇气' },
  { id: 'f11', text: '月潮说你今天掌握着三个人的运势——哪怕你自己还不知道', emoji: '🌗', rarity: 'rare', weight: 1, category: 'fortune', moodEffect: 'reflective', animationProfile: 'starlight', memoryTag: '力量' },
  { id: 'f12', text: '你正在加速靠近某个「守约站点」，请保持航向', emoji: '🧭', rarity: 'rare', weight: 1, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '方向' },
  { id: 'f13', text: 'Luna在月石上看见你的星轨——今天会遇到一个重要的人', emoji: '💫', rarity: 'rare', weight: 1, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '相遇' },
  { id: 'f14', text: '星光落满了你的稿纸，空白处正在孕育一件传世之作', emoji: '📜', rarity: 'legend', weight: 1, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'golden', memoryTag: '创造' },
  { id: 'f15', text: '月潮预报：未知的风正在带来一个大胆的转机', emoji: '🌬️', rarity: 'legend', weight: 1, category: 'fortune', moodEffect: 'uplifting', animationProfile: 'starlight', memoryTag: '转机' },
];

export function loadPool(): CapsuleItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [...DEFAULT_POOL];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_POOL];
    return parsed;
  } catch {
    return [...DEFAULT_POOL];
  }
}

export function savePool(pool: CapsuleItem[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(pool));
  } catch { /* quota exceeded */ }
}

export function resetPool(): CapsuleItem[] {
  savePool(DEFAULT_POOL);
  return [...DEFAULT_POOL];
}

export function addCapsuleItem(item: CapsuleItem): CapsuleItem[] {
  const pool = loadPool();
  pool.push(item);
  savePool(pool);
  return pool;
}

export function removeCapsuleItem(id: string): CapsuleItem[] {
  const pool = loadPool().filter(i => i.id !== id);
  savePool(pool);
  return pool;
}

export function updateCapsuleItem(id: string, patch: Partial<CapsuleItem>): CapsuleItem[] {
  const pool = loadPool().map(i => i.id === id ? { ...i, ...patch } : i);
  savePool(pool);
  return pool;
}
