import { useAppStore } from '@/store/useAppStore';

export const INSPIRATION_STORAGE_KEY = 'lunartide_inspiration_items';
export const INSPIRATION_UPDATED_EVENT = 'lunartide:inspiration-updated';

export type InspirationType = 'prompt' | 'worldbook' | 'character' | 'kaomoji' | 'json' | 'csv' | 'markdown' | 'vault';
export type KaomojiCategory = '開心' | '傷心' | '撒嬌' | '生氣' | '驚訝' | '貓貓' | '摸魚' | '常用';

/* ── Templates ── */
export interface InspirationTemplate {
  id: string;
  type: InspirationType;
  title: string;
  description: string;
  content: string;
  tags: string[];
}

export const TEMPLATES: InspirationTemplate[] = [
  /* Worldbook */
  {
    id: 'tpl-worldbook',
    type: 'worldbook',
    title: '世界觀模板',
    description: '建立一個新世界的基礎設定（世界名稱、規則、角色、備註）',
    tags: ['worldbook', 'template'],
    content: [
      '## 世界名稱',
      '',
      '（為你的世界命名 — 它叫什麼？）',
      '',
      '## 世界設定',
      '',
      '（這個世界的核心規則是什麼？它與現實有什麼不同？）',
      '',
      '## 核心規則',
      '',
      '（力量體系、魔法規則、物理法則…列出最重要的幾條）',
      '',
      '## 主要角色',
      '',
      '（誰住在這裡？他們之間的關係是什麼？）',
      '',
      '## 備註',
      '',
      '（其他你想要記住的細節）',
    ].join('\n'),
  },
  /* Character Card */
  {
    id: 'tpl-character',
    type: 'character',
    title: '角色卡模板',
    description: '建立一個角色的完整檔案（名稱、身份、性格、外貌、背景、行為模式）',
    tags: ['character', 'template'],
    content: [
      '## 名稱',
      '',
      '（角色的名字 — 也可以加上暱稱或稱號）',
      '',
      '## 年齡 / 性別',
      '',
      '（角色的基本人口資訊）',
      '',
      '## 身份',
      '',
      '（角色的職業、社會地位、在世界中的角色定位）',
      '',
      '## 性格',
      '',
      '（內向 / 外向？冷靜 / 熱情？用 3-5 個形容詞描述）',
      '',
      '## 外貌',
      '',
      '（髮色、瞳色、身高、穿著風格、特殊標記）',
      '',
      '## 背景故事',
      '',
      '（角色的過去、重要事件、轉折點）',
      '',
      '## 行為模式',
      '',
      '（角色的習慣、口頭禪、決策方式、人際關係風格）',
    ].join('\n'),
  },
  /* System Prompt */
  {
    id: 'tpl-prompt',
    type: 'prompt',
    title: '系統提示模板',
    description: '建立一個 AI 系統提示（角色設定、行為規則、回應風格）',
    tags: ['prompt', 'template'],
    content: [
      '## 角色設定',
      '',
      '（你是誰？你的身份和定位是什麼？）',
      '',
      '## 行為規則',
      '',
      '（你應該做什麼？不應該做什麼？列出明確的行為邊界）',
      '',
      '## 回應風格',
      '',
      '（語氣：正式 / 輕鬆 / 溫柔？回應長度：簡短 / 中等 / 長篇？）',
      '',
      '## 知識範圍',
      '',
      '（你擅長什麼領域？有什麼知識限制？）',
      '',
      '## 特殊指令',
      '',
      '（任何其他需要記住的規則或偏好）',
    ].join('\n'),
  },
];

export interface VaultCredential {
  serviceName: string;
  url: string;
  loginId: string;
  passwordEncoded: string;
}

export interface InspirationItem {
  id: string;
  title: string;
  type: InspirationType;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  vault?: VaultCredential;
}

export const TYPE_LABELS: Record<InspirationType, string> = {
  prompt: 'Prompt',
  worldbook: '世界書',
  character: '角色卡',
  kaomoji: '顏文字',
  json: 'JSON',
  csv: 'CSV',
  markdown: 'Markdown',
  vault: 'Vault',
};

export const TYPE_COLORS: Record<InspirationType, string> = {
  prompt: 'var(--accent)',
  worldbook: 'var(--amber)',
  character: 'var(--journal)',
  kaomoji: '#c48aa8',
  json: 'var(--teal)',
  csv: '#7aa2f7',
  markdown: '#b48ead',
  vault: '#f2bb68',
};

export const TYPE_OPTIONS: { value: InspirationType; label: string }[] = [
  { value: 'prompt', label: 'Prompt' },
  { value: 'worldbook', label: '世界書' },
  { value: 'character', label: '角色卡' },
  { value: 'kaomoji', label: '顏文字' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'vault', label: 'Vault' },
];

export const KAOMOJI_CATEGORIES: KaomojiCategory[] = [
  '開心',
  '傷心',
  '撒嬌',
  '生氣',
  '驚訝',
  '貓貓',
  '摸魚',
  '常用',
];

const CLASSIFICATION_RULES: { type: InspirationType; terms: string[] }[] = [
  { type: 'worldbook', terms: ['世界書', 'worldbook', 'lorebook'] },
  { type: 'character', terms: ['角色卡', 'character', 'persona'] },
  { type: 'json', terms: ['json', '{', '}'] },
  { type: 'csv', terms: ['csv', ','] },
  { type: 'markdown', terms: ['markdown', '# ', '## ', '- '] },
  { type: 'vault', terms: ['password', '密碼', '密码', 'login', 'credential'] },
  { type: 'prompt', terms: ['system', 'user', 'assistant', 'prompt'] },
];

const TAG_RULES: { label: string; terms: string[] }[] = [
  { label: 'timekeeper', terms: ['timekeeper'] },
  { label: 'debug', terms: ['debug', 'bug', '白屏'] },
  { label: 'ui', terms: ['ui', 'ux', '介面'] },
  { label: 'react', terms: ['react', 'tsx', 'component'] },
  { label: 'css', terms: ['css', 'layout'] },
  { label: 'provider', terms: ['provider', 'api', 'key'] },
];

const KAOMOJI_CATEGORY_RULES: Array<{
  category: KaomojiCategory;
  pattern: RegExp;
}> = [
  { category: '貓貓', pattern: /(?:貓|猫|ฅ|ᓚ|ↀ|=.+?=|\^.+?\^)/iu },
  { category: '傷心', pattern: /(?:哭|傷心|难过|難過|╥|ಥ|︿|；|T_T|Q_Q|இ)/iu },
  { category: '生氣', pattern: /(?:生氣|生气|怒|╬|凸|益|ಠ|皿|̀)/iu },
  { category: '驚訝', pattern: /(?:驚|惊|嚇|吓|°|□|Д|口|⊙|O_O)/iu },
  { category: '撒嬌', pattern: /(?:撒嬌|撒娇|૮|₍|ᵕ|づ|つ|˶|ω)/iu },
  { category: '摸魚', pattern: /(?:摸魚|摸鱼|躺|懶|懒|zzz|Zzz|￣|﹃|_\(:3)/iu },
  { category: '開心', pattern: /(?:開心|开心|笑|happy|ᵔ|▽|✧|๑|＾|≧)/iu },
];

const KAOMOJI_SIGNAL_PATTERN = /[｡ﾟ･・ωᴗᵔᵕ•́̀︿╥﹏๑✧૮₍₎ა╯°□Дಠ益≧▽´｀ノヽづつฅᓚↀ╬皿]/u;
const KAOMOJI_WRAPPER_PATTERN = /(?:[（(][^()\n]{1,60}[）)]|૮[^\n]{0,12}₍[^\n]{1,60}₎[^\n]{0,12}ა|ฅ[^\n]{1,60}ฅ)/u;

const UNTITLED_LABELS: Record<InspirationType, string> = {
  prompt: '未命名 Prompt',
  worldbook: '未命名世界書',
  character: '未命名角色卡',
  kaomoji: '顏文字收藏',
  json: '未命名 JSON',
  csv: '未命名 CSV',
  markdown: '未命名 Markdown',
  vault: '未命名 Vault',
};

export interface InspirationDraft {
  type: InspirationType;
  title: string;
  tags: string[];
}

export function isKaomojiContent(content: string): boolean {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0 || lines.length > 12) return false;

  return lines.every((line) => {
    if (line.length > 80 || !KAOMOJI_SIGNAL_PATTERN.test(line)) return false;
    return KAOMOJI_WRAPPER_PATTERN.test(line) || /[｡ﾟ･・✧♡♥☆★]/u.test(line);
  });
}

export function detectKaomojiCategory(content: string): KaomojiCategory {
  return KAOMOJI_CATEGORY_RULES.find(rule => rule.pattern.test(content))?.category ?? '常用';
}

export function classifyInspirationContent(content: string): InspirationType {
  if (isKaomojiContent(content)) return 'kaomoji';
  if (looksLikeJson(content)) return 'json';
  if (looksLikeCsv(content)) return 'csv';
  if (looksLikeMarkdown(content)) return 'markdown';
  const normalized = content.toLowerCase();
  return CLASSIFICATION_RULES.find(rule =>
    rule.terms.some(term => normalized.includes(term.toLowerCase())),
  )?.type ?? 'prompt';
}

export function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function looksLikeCsv(content: string): boolean {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.slice(0, 4).every(line => line.includes(',')) && !looksLikeJson(content);
}

export function looksLikeMarkdown(content: string): boolean {
  return /^(#{1,6}\s+|[-*]\s+|\d+[.)]\s+|>\s+)/m.test(content) || /\*\*[^*]+\*\*/.test(content);
}

export function generateInspirationTitle(content: string, type: InspirationType): string {
  if (type === 'kaomoji') return UNTITLED_LABELS.kaomoji;
  const firstLine = content
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:#{1,6}|[-*+]|\d+[.)])\s*/, '').trim())
    .find(Boolean);

  if (!firstLine) return UNTITLED_LABELS[type];
  const meaningfulCharacters = firstLine.match(/[\p{L}\p{N}\p{Script=Han}]/gu)?.length ?? 0;
  if (meaningfulCharacters < 3) return UNTITLED_LABELS[type];
  return firstLine.slice(0, 24).trim();
}

export function generateInspirationTags(content: string, type: InspirationType): string[] {
  if (type === 'kaomoji') return [detectKaomojiCategory(content)];
  const normalized = content.toLowerCase();
  const tags: string[] = [];

  for (const rule of TAG_RULES) {
    if (rule.terms.some(term => normalized.includes(term.toLowerCase()))) tags.push(rule.label);
  }

  return Array.from(new Set(tags)).slice(0, 5);
}

export function createInspirationDraft(content: string): InspirationDraft {
  const type = classifyInspirationContent(content);
  return {
    type,
    title: generateInspirationTitle(content, type),
    tags: generateInspirationTags(content, type),
  };
}

export function loadInspirationItems(): InspirationItem[] {
  try {
    const raw = localStorage.getItem(INSPIRATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeInspirationItem).filter(Boolean) as InspirationItem[] : [];
  } catch { return []; }
}

function normalizeInspirationItem(item: Partial<InspirationItem> & { type?: string } | null): InspirationItem | null {
  if (!item || !item.id || !item.title || !item.createdAt || !item.updatedAt) return null;
  const legacyType = String(item.type || 'prompt');
  const type: InspirationType = legacyType === 'skill' || legacyType === 'agent'
    ? 'prompt'
    : TYPE_OPTIONS.some(option => option.value === legacyType)
      ? legacyType as InspirationType
      : 'prompt';
  return {
    id: item.id,
    title: item.title,
    type,
    content: item.content || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    pinned: Boolean(item.pinned),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastUsedAt: item.lastUsedAt,
    vault: item.vault,
  };
}

export function saveInspirationItems(items: InspirationItem[]) {
  const oldItems = loadInspirationItems();
  const oldIds = new Set(oldItems.map(i => i.id));

  localStorage.setItem(INSPIRATION_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(INSPIRATION_UPDATED_EVENT));

  /* Activity log for newly created inspirations */
  for (const item of items) {
    if (!oldIds.has(item.id)) {
      try {
        useAppStore.getState().addActivityLog({
          type: 'inspiration',
          title: 'inspiration_saved',
          detail: item.title.slice(0, 20),
          route: '/inspiration',
          level: 'info',
        });
      } catch { /* store may not be initialized yet */ }
    }
  }
}

export function createInspirationItem(data: {
  type: InspirationType;
  title: string;
  content: string;
  tags: string[];
  pinned?: boolean;
  vault?: VaultCredential;
}): InspirationItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: data.title,
    type: data.type,
    content: data.content,
    tags: data.tags,
    pinned: data.pinned ?? false,
    createdAt: now,
    updatedAt: now,
    vault: data.vault,
  };
}

export function updateInspirationItem(
  items: InspirationItem[],
  id: string,
  patch: Partial<Pick<InspirationItem, 'title' | 'type' | 'content' | 'tags' | 'pinned' | 'vault'>>,
): InspirationItem[] {
  const now = new Date().toISOString();
  return items.map(item =>
    item.id === id ? { ...item, ...patch, updatedAt: now } : item,
  );
}

export function deleteInspirationItem(items: InspirationItem[], id: string): InspirationItem[] {
  return items.filter(item => item.id !== id);
}

export function togglePinInspirationItem(items: InspirationItem[], id: string): InspirationItem[] {
  const now = new Date().toISOString();
  return items.map(item =>
    item.id === id ? { ...item, pinned: !item.pinned, updatedAt: now } : item,
  );
}

export function markInspirationCopied(items: InspirationItem[], id: string): InspirationItem[] {
  const now = new Date().toISOString();
  return items.map(item =>
    item.id === id ? { ...item, lastUsedAt: now, updatedAt: now } : item,
  );
}

export function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 個月前`;
}
