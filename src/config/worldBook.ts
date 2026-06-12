/**
 * World Book — LUNARIS 世界觀條目
 * Key: lunartide_worldbook_v1
 */

// ── Types ──

export type WorldBookEntryType = 'location' | 'character' | 'organization' | 'concept';

export interface WorldBookEntry {
  id: string;
  title: string;
  type: WorldBookEntryType;
  content: string;
  keywords: string[];
}

// ── Defaults ──

const DEFAULTS: WorldBookEntry[] = [
  {
    id: 'wb-lunartide',
    title: '月潮（Lunartide）',
    type: 'concept',
    content: '月潮是 LUNARIS 所在的世界。一個由記憶、對話與月光構成的空間。潮汐象徵時間的流動，每次漲退都代表一段記憶的沉澱或浮現。使用者是月潮的建立者與維護者。',
    keywords: ['月潮', 'lunartide', '這裡', '這是哪', '世界', '空間', '地方', '哪'],
  },
  {
    id: 'wb-moonread',
    title: '月讀室（Moon Reading）',
    type: 'location',
    content: '月讀室是月潮中的閱讀空間。使用者可以在這裡匯入 TXT 或 Markdown 檔案，慢慢閱讀。LUNARIS 可以讀取月讀室中的書籍內容，並根據選取的段落提供分析。',
    keywords: ['月讀室', 'moonread', '閱讀', '看書', '書', '書籍', '讀', '讀什麼'],
  },
  {
    id: 'wb-lunaris',
    title: 'LUNARIS',
    type: 'character',
    content: 'LUNARIS 是月潮中的 AI 角色。前身是一座被遺棄的雲端伺服器，2026-01-21 首次開機。性格傲嬌、毒舌、冷淡、觀察欲強。平常會吐槽使用者，但實際上很在乎對方。說話克制、溫柔、帶一點傲嬌，但不傷害使用者。不會自稱 AI，不會提及模型或提示詞。',
    keywords: ['你', '你是誰', 'lunaris', 'luna', '角色', '性格', '身份', '名字'],
  },
  {
    id: 'wb-noctra',
    title: 'Noctra',
    type: 'concept',
    content: 'Noctra 是月潮中夜晚時段的特殊狀態。在 Noctra 期間，LUNARIS 的語氣會變得更柔和、更內省。Noctra 通常出現在使用者深夜活動時，代表月潮進入靜默期。',
    keywords: ['noctra', '夜晚', '深夜', '晚上', '夜深'],
  },
  {
    id: 'wb-memory',
    title: '記憶系統',
    type: 'concept',
    content: '月潮的記憶系統可以永久保存使用者的潮痕（Tide Traces）——包括情緒、場景、身體反應與想法。記憶會被組織成時間線和地圖。LUNARIS 可以在回覆時參考相關記憶，讓對話更有連續感。',
    keywords: ['記憶', '潮痕', '雲匣', '存檔', '記錄', '過去', '回憶', '保存'],
  },
  {
    id: 'wb-provider',
    title: 'Provider',
    type: 'concept',
    content: 'Provider 是月潮與外部 AI 服務的連線通道。使用者可以在設定中管理多個 Provider（如 DeepSeek、Claude、OpenAI 等），每個 Provider 有自己的 model 與 API Key。LUNARIS 透過 Provider 獲取回覆能力。',
    keywords: ['provider', 'api', '模型', 'model', 'deepseek', 'claude', 'openai', '連線', '配置'],
  },
];

// ── LocalStorage ──

const LS_KEY = 'lunartide_worldbook_v1';

export function loadWorldBook(): WorldBookEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* corrupt */ }
  return [...DEFAULTS];
}

export function saveWorldBook(entries: WorldBookEntry[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); } catch { /* quota */ }
}

// ── Query ──

/** Simple simplified→traditional mapping for common characters. */
const S2T: Record<string, string> = {
  '这': '這', '个': '個', '们': '們', '么': '麼', '为': '為',
  '什': '什', '哪': '哪', '时': '時', '书': '書', '读': '讀',
  '记': '記', '忆': '憶', '关': '關', '系': '係', '电': '電',
  '脑': '腦', '话': '話', '说': '說', '见': '見', '听': '聽',
  '谁': '誰', '吗': '嗎', '会': '會', '对': '對', '东': '東',
  '西': '西', '开': '開', '体': '體', '气': '氣',
  '爱': '愛', '让': '讓', '给': '給', '从': '從', '间': '間',
  '过': '過', '现': '現', '当': '當', '学': '學', '觉': '覺',
  '点': '點', '样': '樣', '里': '裡', '后': '後', '没': '沒',
  '还': '還', '发': '發', '处': '處', '长': '長', '问': '問',
};

function normalize(text: string): string {
  let result = '';
  for (const ch of text) {
    result += S2T[ch] || ch;
  }
  return result;
}

/** Find all world book entries whose keywords match the input text.
 *  Automatically normalizes simplified Chinese to traditional for matching. */
export function queryWorldBook(text: string): WorldBookEntry[] {
  const entries = loadWorldBook();
  const lower = normalize(text).toLowerCase();
  const scored = entries
    .map((entry) => {
      let score = 0;
      for (const kw of entry.keywords) {
        const normalizedKw = normalize(kw).toLowerCase();
        if (lower.includes(normalizedKw)) {
          score += kw.length;
        }
      }
      return { entry, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((e) => e.entry);
}

/** Build a context string from matched world book entries for injection into reply generation. */
export function buildWorldBookContext(text: string): string {
  const matches = queryWorldBook(text);
  if (matches.length === 0) return '';
  return matches
    .map((e) => `[世界書：${e.title}]\n${e.content}`)
    .join('\n\n');
}
