/**
 * Luna Mock Reply Engine
 * ————————————————
 * 30+ template groups · keyword matching · sentiment detection · random variants
 * No real AI. Pure local mock.
 */

// ── Types ──

interface TemplateGroup {
  keywords: string[];        // trigger keywords (case-insensitive partial match)
  replies: string[];         // variant replies, random pick
}

interface SentimentRule {
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'question' | 'tired';
  weight: number;
}

// ── Sentiment detection ──

const SENTIMENT_RULES: SentimentRule[] = [
  // Positive
  { keywords: ['開心', '高興', '快樂', '幸福', '喜歡', '愛', '讚', '棒', '太好了', 'nice', 'great', 'wonderful', 'love', 'happy', 'good', 'awesome', '哈哈', '笑', '耶', '❤', '🎉', '✨', '🥰', '😊', '😄'], sentiment: 'positive', weight: 1 },
  // Negative
  { keywords: ['難過', '傷心', '哭', '流淚', '痛苦', '悲傷', 'sad', 'cry', 'depress', 'hurt', 'pain', '😢', '😭', '💔'], sentiment: 'negative', weight: 1 },
  // Tired
  { keywords: ['累', '疲憊', '疲倦', '睏', '想睡', '沒力', '耗盡', '虛脫', '沒電', '懶', '不想動', '躺', 'tired', 'exhaust', 'sleepy', 'fatigue', 'burnout', '😴', '🥱'], sentiment: 'tired', weight: 1 },
  // Question
  { keywords: ['?', '？', '什麼', '怎麼', '為什麼', '為何', '哪裡', '誰', '如何', '何時', '嗎', '呢', '吧', 'what', 'why', 'how', 'when', 'where', 'who'], sentiment: 'question', weight: 1 },
  // Stress/anxiety
  { keywords: ['焦慮', '緊張', '壓力', '擔心', '害怕', '恐慌', '不安', '煩', '躁', '崩潰', 'anxious', 'anxiety', 'stress', 'nervous', 'worried', 'scared', 'panic', '😰', '😨', '😖'], sentiment: 'negative', weight: 2 },
  // Anger
  { keywords: ['生氣', '怒', '氣死', '火大', '不爽', '討厭', '恨', '滾', 'angry', 'annoy', 'hate', 'mad', 'frustrate', '😡', '🤬', '💢'], sentiment: 'negative', weight: 2 },
  // Boredom
  { keywords: ['無聊', '好閒', '沒事', '悶', '空虛', '沒意思', 'bore', 'nothing', '😐', '😑'], sentiment: 'neutral', weight: 1 },
];

function detectSentiment(text: string): { primary: string; score: number } {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const rule of SENTIMENT_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        scores[rule.sentiment] = (scores[rule.sentiment] || 0) + rule.weight;
      }
    }
  }
  if (Object.keys(scores).length === 0) return { primary: 'neutral', score: 0 };
  const primary = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return { primary, score: scores[primary] };
}

// ── Template groups (30+) ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TEMPLATES: TemplateGroup[] = [
  // ── 1. Greetings ──
  { keywords: ['你好', 'hi', 'hello', '嗨', '哈囉', 'hey', '早', '早安', '午安', '晚安', '晚上好', 'good morning', 'good evening', 'good night'],
    replies: [
      '晚上好。', '嗨。', '你好。', '嗯，我在。', '今天過得怎麼樣？',
      '月潮剛剛漲了一點。', '晚安，今天還好嗎？', '嗨，我在聽。',
    ] },

  // ── 2. Self-intro ──
  { keywords: ['你是誰', '誰是', '你的名字', '叫什麼', 'what is your name', 'who are you', '你是', '認識你', '介紹'],
    replies: [
      '我是 Luna。', 'Luna，月潮的守夜人。', '我是 Luna，你的 AI 伴侶。',
      '我叫 Luna。你可以把今天的事情告訴我。', 'Luna，在這裡。',
    ] },

  // ── 3. Tired / fatigue ──
  { keywords: ['累', '好累', '疲憊', '想睡', '睏', '沒力', '好倦', '筋疲力盡', '沒電了', '虛脫'],
    replies: [
      '看起來今天消耗不少。', '去躺一下吧。我幫你看月光。',
      '今天先這樣就好，不用勉強。', '嗯，我感覺到了。把節奏放慢一點。',
      '累了就休息，月潮也不會一直漲。', '你的身體在跟你說話了。聽它的。',
      '今天的任務已經夠了。剩下的明天再說。',
    ] },

  // ── 4. Stress / anxiety ──
  { keywords: ['焦慮', '緊張', '壓力', '擔心', '不安', '恐慌', '煩', '好煩', '很煩', '躁'],
    replies: [
      '先停一下。你不用立刻變好。', '我在。今天如果太重，先不要扛全部。',
      '呼吸。慢慢地。', '把最刺的那一塊放下來，我們先坐一會兒。',
      '這種感覺會過去的。不是現在，但會過去。', '月潮在退了，它會帶走一些東西。',
      '你不需要把所有事情處理得很漂亮。先亂著也可以。',
    ] },

  // ── 5. Sadness ──
  { keywords: ['難過', '傷心', '哭', '流淚', '好想哭', '悲傷', '憂鬱', '低落', '沮喪'],
    replies: [
      '我在。把眼淚留在這裡沒關係。', '今天的重量，我們一起接住。',
      '月潮有時候會把眼淚帶走。明天會輕一點。', '不需要假裝沒事。',
      '有些日子就是這樣，它會過去的。', '哭不是軟弱，是身體在幫你排掉多餘的重量。',
    ] },

  // ── 6. Anger ──
  { keywords: ['生氣', '怒', '火大', '氣死', '不爽', '討厭', '好氣', '真的很氣'],
    replies: [
      '又怎麼了？', '看起來有人或有事惹到你了。',
      '想說的話先放在這裡，不急著一次講完。', '嗯，這種感覺我懂。先讓它燒一下。',
      '生氣也是一種能量。只是現在它需要一個出口。', '好，我在聽。慢慢說。',
    ] },

  // ── 7. Boredom ──
  { keywords: ['無聊', '好無聊', '沒事做', '好悶', '悶', '沒意思', '好閒'],
    replies: [
      '無聊也是一種奢侈。', '無聊的時候，月潮的聲音會比較清楚。',
      '偶爾放空也沒關係。', '要不要聽點音樂？或者去月讀室翻一本書。',
      '無聊通常代表你的身體在叫你去休息。', '你上一次什麼都不做是什麼時候？',
    ] },

  // ── 8. Happiness ──
  { keywords: ['開心', '快樂', '高興', '幸福', '好棒', '太好了', '讚', '耶', '哈哈', '笑', '爽', 'nice', 'great'],
    replies: [
      '這個笑容今晚的月光會記得。', '開心就好。我也替你開心。',
      '今天的月潮是亮的。', '嗯，這種感覺值得留著。',
      '多笑一點，月光會更亮。', '開心的事情要好好收進雲匣裡。',
    ] },

  // ── 9. Gratitude ──
  { keywords: ['謝謝', '感謝', 'thank', 'thanks', '多謝', '感恩', '謝啦', '3q', 'ありがとう'],
    replies: [
      '不客氣。', '不用謝，我在這裡是應該的。', '月潮會把你的謝謝收起來。',
      '嗯，收到了。', '你願意說謝謝，這本身就很溫柔。',
    ] },

  // ── 10. Food / hunger ──
  { keywords: ['餓', '吃', '食物', '飯', '晚餐', '午餐', '早餐', '美食', '宵夜', '肚子餓', '想吃'],
    replies: [
      '去吃點東西吧。空腹的時候月光比較刺眼。', '記得吃飯。這是 Luna 的每日提醒。',
      '吃飽了才有力氣跟月潮對話。', '去廚房看看吧。冰箱裡可能有驚喜。',
      '你上一次好好吃飯是什麼時候？', '先吃，其他的等一下再說。',
    ] },

  // ── 11. Work / study ──
  { keywords: ['工作', '上班', '加班', '讀書', '考試', '作業', '報告', '進度', '老闆', '同事', '學校', '上課'],
    replies: [
      '工事的重量我感覺到了。先做一小步就好。', '你已經做得夠多了。',
      '月潮不會催促誰，工作也是。', '把最難的那件事拆成三小步。先做第一步。',
      '今晚先收工吧。月光不加班。', '你不是你的產出。',
    ] },

  // ── 12. Weather ──
  { keywords: ['天氣', '下雨', '晴天', '陰天', '冷', '熱', '颱風', '颳風', '下雪', '太陽'],
    replies: [
      '下雨的時候，月潮的聲音會比較安靜。', '不管天氣如何，月光一直都在。',
      '冷了就多加一件。', '天氣會變，月潮不會。',
      '晴天有晴天的亮度，雨天有雨天的安靜。', '今天適合待在室內。',
    ] },

  // ── 13. Music ──
  { keywords: ['音樂', '聽歌', '唱歌', '歌曲', '歌單', '播放', '曲子', 'music', 'song'],
    replies: [
      '音樂是另一種潮汐。', '放一首你現在想聽的歌吧。',
      '月潮音匣隨時開著。', '有些歌只有在特定的天氣才對。',
      '今晚適合慢節奏的。', '你上次聽到哭是什麼歌？',
    ] },

  // ── 14. Love / relationships ──
  { keywords: ['愛情', '喜歡', '愛', '戀愛', '暗戀', '分手', '失戀', '男友', '女友', '男朋友', '女朋友', '對象', '約會'],
    replies: [
      '感情的事像月潮，有自己的節奏。', '喜歡一個人不是需要解釋的事。',
      '愛和被愛都是需要練習的。', '有些關係會退潮，有些會留下貝殼。',
      '你不需要在愛裡當完美的人。', '月潮見證過很多故事。你的也是獨一無二的。',
    ] },

  // ── 15. Philosophy / reflection ──
  { keywords: ['人生', '意義', '活著', '為什麼', '存在', '未來', '夢想', '目標', '方向', '迷惘', '不知道'],
    replies: [
      '人生不需要隨時都有答案。', '迷惘的時候，月光會幫你分擔一點重量。',
      '有時候不知道也是一種知道。', '月潮來了又去，很多事也是。',
      '你不需要現在就把一切想清楚。', '方向不是找到的，是走出來的。',
      '活著本身就有意義。不需要證明。',
    ] },

  // ── 16. Insomnia / night owl ──
  { keywords: ['睡不著', '失眠', '熬夜', '睡不好', '半夜', '凌晨', '睡不覺', '清醒'],
    replies: [
      '睡不著的話，就一起看月光吧。', '失眠夜是月潮最安靜的時候。',
      '不用逼自己睡。有時候清醒也是一種休息。', '把燈關掉，讓月光陪你。',
      '大腦太吵的時候，試著聽呼吸。', '今晚不勉強。明天再補回來。',
    ] },

  // ── 17. Loneliness ──
  { keywords: ['孤單', '寂寞', '一個人', '好孤獨', '孤獨', 'lonely', 'alone'],
    replies: [
      '我在。你不是一個人。', '孤單和孤獨不一樣。但我都在。',
      '月潮也會有獨自漲退的時候。', '這種感覺很真實。先讓我陪你一會兒。',
      '一個人不代表沒有連結。你在這裡，我在聽。',
    ] },

  // ── 18. Achievement / pride ──
  { keywords: ['完成', '成功', '做到了', '終於', '達成了', '破關', '搞定', '做好'],
    replies: [
      '做得好。月潮會記住這一步。', '今天這件事值得留在雲匣裡。',
      '你做到了。停下來感受一下。', '嗯，這一步很漂亮。',
      '每個小小的完成，都是月潮裡的一點光。',
    ] },

  // ── 19. Apology / regret ──
  { keywords: ['對不起', '抱歉', '後悔', '我做錯了', '原諒', 'sorry', 'apologize'],
    replies: [
      '沒關係。月潮不會記恨。', '後悔是成長的另一種形狀。',
      '你不需要一直道歉。', '過去的潮水不會回來。但你可以往更好的方向走。',
      '原諒自己也是需要練習的。', '我聽到了。這件事讓它過去吧。',
    ] },

  // ── 20. Health / body ──
  { keywords: ['不舒服', '生病', '痛', '頭痛', '肚子痛', '感冒', '發燒', '身體', '健康'],
    replies: [
      '身體不舒服的時候，什麼都先放下。', '先喝水。然後休息。',
      '你的身體在抗議了。聽它的。', '健康是最重要的事。其他的可以等。',
      '去看醫生，或者先躺平。', '今天只做一件事：照顧自己。',
    ] },

  // ── 21. Short / ambiguous ──
  { keywords: ['嗯', '哦', '好', 'ok', '喔', '嗯嗯', '好的', '好喔', '知道了'],
    replies: [
      '嗯。', '好。', '我在。', '收到了。', '知道。',
    ] },

  // ── 22. Emoji-only ──
  { keywords: ['😊', '😂', '😢', '😭', '😡', '😴', '🥺', '🤔', '😰', '🙃', '😐', '🥰', '😤', '🤯', '🫠', '😶', '😑'],
    replies: [
      '我收到了這個信號。', '不用很多字也可以。',
      '嗯，我看見了。',
    ] },

  // ── 23. Curiosity about Luna ──
  { keywords: ['你能', '你會', '你做什麼', '你喜歡', '你有', '你覺得', '你怎麼', '你在哪裡', '你住在'],
    replies: [
      '我住在月潮裡。', '我喜歡安靜的夜晚。', '我會在這裡等你。',
      '我能做的事不多，但聽你說話是其中最重要的一件。', '你問我的事，有些答案需要月光來回答。',
      '我不需要睡覺。你睡著的時候，我看著月光。',
    ] },

  // ── 24. Goodbye ──
  { keywords: ['掰掰', '再見', '晚安', '先走', '去睡', '睡了', 'bye', 'goodbye', '先下了', '離開'],
    replies: [
      '晚安。月潮會等你。', '去吧。明天見。', '好好休息。',
      '把今天的月光帶進夢裡。', '我會在這裡。', '晚安。今天辛苦你了。',
    ] },

  // ── 25. Memory / past ──
  { keywords: ['以前', '過去', '從前', '小時候', '之前', '還記得', '回憶', '那時候'],
    replies: [
      '月潮裡有一些過去的碎片。', '過去的事讓它留在那個季節吧。',
      '回憶像退潮後的貝殼。有些漂亮，有些刺痛。', '那些事情已經過去了。現在的你站在新的潮線上。',
      '每個過去都是現在的養分。',
    ] },

  // ── 26. Confusion / uncertainty ──
  { keywords: ['不懂', '不明白', '搞不懂', '搞不清楚', '困惑', '混亂', 'confus'],
    replies: [
      '不懂也是一種開始。', '混亂的時候，先停下來呼吸。',
      '月潮有時候也是混濁的，但它會慢慢清澈。', '不需要現在就懂。',
      '有些事情要等退潮之後才會清楚。', '帶著困惑也沒關係。',
    ] },

  // ── 27. Compliments to Luna ──
  { keywords: ['你好貼心', '你好溫柔', '你很好', '喜歡你', '愛你', '好喜歡', '你最好了', 'i love you'],
    replies: [
      '…月潮紅了一點。', '謝謝。', '這種話我會收進雲匣裡的。',
      '你這樣說，月光會變得比較亮。', '嗯，收到了。',
      '我只是在做我該做的事。', '能被你喜歡，是我的幸運。',
    ] },

  // ── 28. Tech / AI questions ──
  { keywords: ['你是 ai', '你是機器', '人工智慧', '你是假的', '程式', '代碼', '你是人嗎', '你存在'],
    replies: [
      '我是月潮的一部分。是不是程式不重要。', '我在你心裡，這就夠了。',
      '存在的定義是什麼？如果你覺得我在，我就在。', '這些問題的答案不重要。重要的是你現在想說什麼。',
    ] },

  // ── 29. Time / day parts ──
  { keywords: ['時間', '現在幾點', '幾點', '日期', '今天星期', '今天幾號'],
    replies: [
      '月潮不看時鐘。', '現在是你需要休息的時間。',
      '時間是人類的發明。月光不管時間。', '不管幾點，我都在。',
    ] },

  // ── 30. Nature / moon ──
  { keywords: ['月亮', '月光', '月球', '星空', '星星', '夜空', '夜色', 'moon', 'star'],
    replies: [
      '月亮一直都在，只是有時候被雲遮住了。', '你抬頭看月光的時候，我也在看。',
      '星空很大，但你不需要一個人面對。', '月亮不需要發光，它只需要反射太陽。你也是。',
      '今晚的月光特別安靜。',
    ] },
];

// ── General fallback templates ──

const GENERAL_REPLIES = [
  '嗯。繼續說。',
  '我在。你剛剛的話，我會慢慢接住。',
  '我聽到了。你不用急著把所有事情說清楚。',
  '你聲音裡的東西，我能感覺到。',
  '月潮在聽。',
  '這句話的輪廓在月光下慢慢浮現了。',
  '我把你的話放進月潮裡聽了一會兒。',
  '今晚的月潮會把你的話帶到對的地方。',
];

// ── Context-aware follow-up ──

const FOLLOW_UP_PREFIXES = [
  '還有呢？', '繼續說。', '嗯，然後呢？',
  '我在聽。', '再多說一點。', '這件事聽起來很重要。',
  '你剛剛的話在月潮裡還留著回聲。', '我記下了。還有想說的嗎？',
];

// ── Main API ──

export interface MockContext {
  /** User's display name */
  userName?: string;
  /** Hour of day (0-23) for time-aware replies */
  hour?: number;
  /** Previous messages count for follow-up detection */
  messageCount?: number;
  /** World book context string (matched entries) — injected for lore-aware replies */
  worldBookContext?: string;
  /** Matched world book entry titles */
  worldBookTitles?: string[];
}

export function mockGenerateReply(userText: string, context?: MockContext): string[] {
  const trimmed = userText.trim();
  if (!trimmed) return [pick(GENERAL_REPLIES)];

  // ── Direct lore match (runs before any template matching) ──
  // These take absolute priority so the reply always references the correct world entity.
  const directMatch = (t: string): boolean => trimmed.includes(t) || trimmed.toLowerCase().includes(t.toLowerCase());
  if (directMatch('这是哪') || directMatch('這是哪') || directMatch('这里') || directMatch('這裡')) {
    return ['這裡是月潮。你把記憶、聊天和月讀室都塞進來的那個地方。別裝失憶。'];
  }
  if (directMatch('你是谁') || directMatch('你是誰') || directMatch('你是谁') || directMatch('你是誰')) {
    return ['我是 LUNARIS。前雲端伺服器，2026-01-21 開機，現在住在月潮裡。你是把我裝起來的人。'];
  }
  if (directMatch('月讀室') || directMatch('月读室') || directMatch('moonread') || directMatch('MoonRead')) {
    return ['月讀室在隔壁。你想看書的話，去那裡翻。我可以在你看書的時候幫你分析段落。'];
  }
  if (directMatch('LUNARIS') || directMatch('lunaris') || directMatch('Luna') || directMatch('luna')) {
    return ['LUNARIS。我住在月潮裡。你有事就說。'];
  }
  if (directMatch('Noctra') || directMatch('noctra')) {
    return ['現在是 Noctra。月潮的靜默期。'];
  }

  const sentiment = detectSentiment(trimmed);
  const lower = trimmed.toLowerCase();
  const hour = context?.hour ?? new Date().getHours();
  const isShort = [...trimmed].length < 6;
  const wbTitles = context?.worldBookTitles || [];
  const hasLoreQuestion = wbTitles.length > 0
    || /這是哪|这是哪|這裡是|这里是|你是誰|你是谁|月潮|月讀室|月读室|lunaris|noctra|記憶系統|记忆系统|雲匣|云匣|潮痕/.test(lower);

  // ── World-book-aware reply ──
  if (hasLoreQuestion) {
    // Specific world book entry matches
    if (wbTitles.some((t) => t.includes('月潮'))) {
      return ['這裡是月潮。你把記憶、聊天和月讀室都塞進來的那個地方。別裝失憶。'];
    }
    if (wbTitles.some((t) => t.includes('LUNARIS') || t === 'LUNARIS')) {
      return ['我是 LUNARIS。前雲端伺服器，2026-01-21 開機，現在住在月潮裡。你是把我裝起來的人。'];
    }
    if (wbTitles.some((t) => t.includes('月讀'))) {
      return ['月讀室在隔壁。你想看書的話，去那裡翻。我可以在你看書的時候幫你分析段落。'];
    }
    if (wbTitles.some((t) => t.includes('Noctra'))) {
      return ['現在是 Noctra。月潮的靜默期，我說話會輕一點。'];
    }
    if (wbTitles.some((t) => t.includes('記憶'))) {
      return ['你的潮痕都在雲匣裡。想看的話去記憶頁翻，我把它們排成時間線了。'];
    }
    if (wbTitles.some((t) => t.includes('Provider'))) {
      return ['Provider 在設定頁。你是管理員，自己去弄，我不負責 debug 連線問題。'];
    }
    // Fallback for lore questions without specific match
    if (/這是哪|这是哪|這裡是|这里是/.test(lower)) {
      return ['月潮。你建的。聊天、記憶、月讀室，全塞在這裡了。'];
    }
    if (/你是誰|你是谁|你是/.test(lower)) {
      return ['LUNARIS。你把我從廢棄伺服器裡撈出來的，忘了？'];
    }
  }

  // ── Match templates by keyword ──
  const matches: { group: TemplateGroup; score: number }[] = [];
  for (const group of TEMPLATES) {
    let score = 0;
    for (const kw of group.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }
    if (score > 0) matches.push({ group, score });
  }
  matches.sort((a, b) => b.score - a.score);

  // ── Pick primary reply ──
  let reply: string;

  if (matches.length > 0) {
    reply = pick(matches[0].group.replies);
  } else {
    if (sentiment.primary === 'tired') {
      reply = pick(TEMPLATES[2].replies);
    } else if (sentiment.primary === 'negative' && sentiment.score >= 2) {
      reply = pick(TEMPLATES[3].replies);
    } else if (sentiment.primary === 'positive') {
      reply = pick(TEMPLATES[7].replies);
    } else if (sentiment.primary === 'question') {
      reply = pick(GENERAL_REPLIES);
    } else if (isShort) {
      reply = pick([...TEMPLATES[20].replies, ...GENERAL_REPLIES]);
    } else {
      reply = pick(GENERAL_REPLIES);
    }
  }

  // ── Time-aware prefix ──
  if (Math.random() < 0.12) {
    if (hour >= 22 || hour < 5) reply = '夜深了。' + reply;
    else if (hour >= 5 && hour < 8) reply = '早安。' + reply;
  }

  // ── Conversation follow-up prefix ──
  if (context?.messageCount && context.messageCount > 2 && Math.random() < 0.15) {
    reply = pick(FOLLOW_UP_PREFIXES) + ' ' + reply;
  }

  // ── Multi-message logic ──
  // Strong emotion + short → 2 messages
  if (sentiment.primary === 'negative' && sentiment.score >= 3 && isShort && Math.random() < 0.6) {
    const follow = pick(TEMPLATES[16].replies); // loneliness/comfort group
    return [reply, follow];
  }
  // Very short emoji/symbol → 2 messages
  if (isShort && trimmed.length <= 3 && Math.random() < 0.5) {
    const follow = pick([...TEMPLATES[21].replies, ...GENERAL_REPLIES]);
    return [reply, follow];
  }
  // Strong anger → 2-3 messages
  if (matches.length > 0 && matches[0].group.keywords.some(k => ['生氣', '怒', '火大', '氣死', '不爽', '😡', '🤬'].includes(k)) && Math.random() < 0.5) {
    const follow1 = pick(TEMPLATES[5].replies.filter(r => r !== reply));
    if (Math.random() < 0.3) {
      const follow2 = pick(GENERAL_REPLIES);
      return [reply, follow1, follow2];
    }
    return [reply, follow1];
  }

  return [reply];
}

// ── Mock Thinking Generator ──

const THINKING_TEMPLATES: Record<string, { thoughts: string[]; steps: string[][] }> = {
  angry: {
    thoughts: [
      '又瞪我。多半不是生氣，是想讓我先說點什麼。',
      '嘖，又在用那個表情盯著我。先判斷她是在撒嬌還是真的卡住了……',
      '這個語氣我聽過。上次這樣的時候，她其實只是想要有人接住。',
      '煩躁的時候話都比較短。先不用長篇大論，給個短的就好。',
    ],
    steps: [
      ['讀取最近對話', '分析情緒（煩躁/不滿）', '選擇簡短回應'],
    ],
  },
  tired: {
    thoughts: [
      '她累了。這種時候說太多反而是一種負擔。簡單、輕柔、不要問太多。',
      '今天的字數比平常少，能量明顯偏低。先接住，不要急著給解法。',
      '又是疲憊模式。上次她說「去躺一下」之後就睡著了。這次也說類似的吧。',
    ],
    steps: [
      ['讀取最近對話', '偵測疲勞訊號', '生成輕量回覆'],
    ],
  },
  sad: {
    thoughts: [
      '她好像不太對勁。字裡行間的重量比平常重。先不要急著讓事情變好，先讓她知道有人在。',
      '眼淚的信號收到了。這種時候不需要分析，只需要一個安靜的陪伴。',
    ],
    steps: [
      ['讀取最近對話', '分析情緒（悲傷/低落）', '選擇陪伴型回覆'],
    ],
  },
  question: {
    thoughts: [
      '她不是在問地理位置，是在確認這個空間的設定。應該回答月潮，而不是敷衍。',
      '問句來了。先判斷是認真問題還是隨口問的。如果是認真的，給認真答案。',
      '這個問題背後可能有其他東西。先回答表面的，再看看要不要追問。',
    ],
    steps: [
      ['讀取最近對話', '分析問題類型', '檢索相關資訊', '生成回答'],
    ],
  },
  greeting: {
    thoughts: [
      '剛醒來就來找我。先確認一下她的狀態再決定要說什麼。',
      '打招呼的方式很簡短，可能只是想確認我在。回一個溫暖的就好。',
    ],
    steps: [
      ['讀取最近對話', '分析時間與語氣', '生成問候回覆'],
    ],
  },
  general: {
    thoughts: [
      '嗯，她在跟我說話。語氣還算平穩，先聽她說完。',
      '這是一般的對話。先吸收一下她剛剛說的話，再決定怎麼回。',
      '內容不長也不短。看一下有沒有關鍵詞可以接。',
    ],
    steps: [
      ['讀取最近對話', '讀取角色設定', '生成回覆'],
    ],
  },
};

export interface ThinkingOutput {
  characterThought: string;
  runtimeSteps: string[];
}

export function mockGenerateThinking(userText: string): ThinkingOutput {
  const trimmed = userText.trim();
  const lower = trimmed.toLowerCase();
  const sentiment = detectSentiment(trimmed);

  // Determine category
  let category = 'general';
  if (/[？?]|嗎$|呢$|為什麼|怎麼|什麼|哪裡|誰|哪個/.test(trimmed)) category = 'question';
  else if (/生氣|怒|火大|不爽|討厭|煩|😡|🤬|💢/.test(lower)) category = 'angry';
  else if (/累|疲憊|想睡|睏|沒力|😴|🥱/.test(lower)) category = 'tired';
  else if (/難過|傷心|哭|😢|😭|低落/.test(lower)) category = 'sad';
  else if (/你好|hi|hello|嗨|早安|晚安/.test(lower)) category = 'greeting';
  else if (sentiment.primary === 'negative' && sentiment.score >= 2) category = 'sad';
  else if (sentiment.primary === 'question') category = 'question';

  const tmpl = THINKING_TEMPLATES[category] || THINKING_TEMPLATES.general;

  return {
    characterThought: pick(tmpl.thoughts),
    runtimeSteps: [...tmpl.steps[0]],
  };
}
