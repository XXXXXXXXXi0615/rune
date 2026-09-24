/**
 * Unified CLAWD asset manifest.
 *
 * Assets scanned via Vite import.meta.glob from src/assets/clawd/.
 * Categories determined by filename conventions + manual overrides.
 * Labels use Chinese descriptions (not raw filenames).
 */
export interface ClawdAsset {
  id: string;
  src: string;
  fileName: string;
  format: 'svg' | 'gif';
  category: ClawdCategory;
  tags: string[];
  label: string;
  supportsMood: boolean;
  supportsReaction: boolean;
}

export type ClawdCategory = 'emotion' | 'working' | 'action' | 'sleep' | 'music' | 'food' | 'seasonal' | 'other';

export interface JournalMoodOption {
  id: string;
  label: string;
  assetId: string;
  tone: 'positive' | 'neutral' | 'low' | 'tense';
}

/* ── Glob scan ── */
const rawModules = import.meta.glob<string>(
  '@/assets/clawd/*.{svg,gif}',
  { eager: true, query: '?url', import: 'default' },
);

/* ── Helper: extract base id from import path ── */
function extractId(path: string): string {
  const file = path.split('/').pop() || '';
  const base = file.replace(/\.(svg|gif)$/i, '');
  return base;
}

/* ── Label map — Chinese-friendly names ── */
const LABEL_MAP: Record<string, string> = {
  'clawd-angry': '生氣',
  'clawd-astronaut': '太空人',
  'clawd-battery-low': '電量不足',
  'clawd-birthday': '生日快樂',
  'clawd-bored': '無聊',
  'clawd-celebrating': '慶祝',
  'clawd-chef': '主廚',
  'clawd-clapping': '鼓掌',
  'clawd-climbing': '攀爬',
  'clawd-coding': '寫程式',
  'clawd-confused': '困惑',
  'clawd-crab-walking': '螃蟹走',
  'clawd-crafting': '製作中',
  'clawd-crafting-1': '製作中',
  'clawd-crying': '哭泣',
  'clawd-detective': '偵探',
  'clawd-dizzy': '頭暈',
  'clawd-dragon-boat': '端午節',
  'clawd-eating': '吃東西',
  'clawd-embarrassed': '尷尬',
  'clawd-exercise': '運動',
  'clawd-facepalm': '傻眼',
  'clawd-fishing': '釣魚',
  'clawd-grumpy': '不爽',
  'clawd-guitar': '彈吉他',
  'clawd-hallucinating': '幻覺',
  'clawd-happy': '開心',
  'clawd-hopeful': '期待',
  'clawd-jealous': '嫉妒',
  'clawd-laughing': '大笑',
  'clawd-listening': '聆聽中',
  'clawd-meditating': '冥想',
  'clawd-notification': '通知',
  'clawd-painting': '畫畫',
  'clawd-peeking': '偷看',
  'clawd-photo': '拍照',
  'clawd-praying': '祈禱',
  'clawd-reading': '閱讀',
  'clawd-running': '跑步',
  'clawd-scared': '害怕',
  'clawd-shipping': '寄送',
  'clawd-shrug': '無奈',
  'clawd-sick': '生病',
  'clawd-singing': '唱歌',
  'clawd-skateboard': '滑板',
  'clawd-sleeping': '睡覺',
  'clawd-thanksgiving': '感恩節',
  'clawd-working-beacon': '發送訊號',
  'clawd-working-carrying': '搬東西',
  'clawd-working-conducting': '指揮',
  'clawd-working-confused': '工作中困惑',
  'clawd-working-rollback': '回溯中',
  'clawd-working-sweeping': '打掃中',
  'clawd-working-tool-calling': '呼叫工具',
  'clawd-working-typing': '打字中',
};

function getLabel(id: string): string {
  return LABEL_MAP[id] || id.replace('clawd-', '').replace(/-/g, ' ');
}

/* ── Auto-categorization by name ── */
function autoCategory(id: string): ClawdCategory {
  if (id.startsWith('clawd-working-')) return 'working';
  if (id.includes('sleeping') || id.includes('tired')) return 'sleep';
  if (id.includes('singing') || id.includes('guitar') || id.includes('listening')) return 'music';
  if (id.includes('sick') || id.includes('scared') || id.includes('confused')
    || id.includes('shrug') || id.includes('crying') || id.includes('angry')
    || id.includes('happy') || id.includes('laughing') || id.includes('bored')
    || id.includes('hopeful') || id.includes('embarrassed') || id.includes('jealous')
    || id.includes('grumpy') || id.includes('dizzy') || id.includes('facepalm')
    || id.includes('celebrating') || id.includes('clapping')) return 'emotion';
  if (id.includes('running') || id.includes('skateboard') || id.includes('shipping')
    || id.includes('carrying') || id.includes('climbing') || id.includes('fishing')
    || id.includes('exercise') || id.includes('crab-walking')) return 'action';
  if (id.includes('birthday') || id.includes('dragon-boat') || id.includes('thanksgiving')) return 'seasonal';
  if (id.includes('eating') || id.includes('chef')) return 'food';
  return 'other';
}

/* ── Manual overrides ── */
const OVERRIDE_CATEGORY: Record<string, ClawdCategory> = {
  'clawd-working-confused': 'working',
  'clawd-working-beacon': 'working',
  'clawd-celebrating': 'emotion',
  'clawd-clapping': 'emotion',
};

/* ── Mood set: curated subset for journal moods ── */
const MOOD_IDS = new Set([
  'clawd-happy',
  'clawd-sleeping',
  'clawd-scared',
  'clawd-confused',
  'clawd-sick',
  'clawd-angry',
  'clawd-bored',
  'clawd-crying',
  'clawd-meditating',
  'clawd-embarrassed',
  'clawd-hopeful',
  'clawd-exercise',
]);

/* ── JournalMoodOption definitions ── */
const MOOD_OPTIONS: JournalMoodOption[] = [
  { id: 'calm', label: '平靜', assetId: 'clawd-meditating', tone: 'neutral' },
  { id: 'happy', label: '開心', assetId: 'clawd-happy', tone: 'positive' },
  { id: 'sleepy', label: '想睡', assetId: 'clawd-sleeping', tone: 'low' },
  { id: 'sad', label: '難過', assetId: 'clawd-crying', tone: 'low' },
  { id: 'scared', label: '害怕', assetId: 'clawd-scared', tone: 'tense' },
  { id: 'confused', label: '困惑', assetId: 'clawd-confused', tone: 'neutral' },
  { id: 'sick', label: '生病', assetId: 'clawd-sick', tone: 'low' },
  { id: 'annoyed', label: '煩躁', assetId: 'clawd-angry', tone: 'tense' },
  { id: 'focused', label: '專注', assetId: 'clawd-coding', tone: 'neutral' },
  { id: 'excited', label: '興奮', assetId: 'clawd-celebrating', tone: 'positive' },
  { id: 'shy', label: '害羞', assetId: 'clawd-embarrassed', tone: 'neutral' },
  { id: 'tired', label: '累了', assetId: 'clawd-bored', tone: 'low' },
];

/* ── Reaction set: companion reactions for journal cards ── */
const REACTION_IDS = new Set([
  'clawd-working-typing',
  'clawd-working-tool-calling',
  'clawd-working-sweeping',
  'clawd-working-rollback',
  'clawd-working-conducting',
  'clawd-working-carrying',
  'clawd-reading',
  'clawd-singing',
  'clawd-sleeping',
  'clawd-working-beacon',
  'clawd-listening',
  'clawd-coding',
  'clawd-notification',
]);

/* ── Build manifest ── */
function buildManifest(): ClawdAsset[] {
  const assets: Map<string, ClawdAsset> = new Map();

  for (const [path, src] of Object.entries(rawModules)) {
    if (!src || typeof src !== 'string') continue;

    const id = extractId(path);
    const fileName = path.split('/').pop() || '';
    const format = fileName.endsWith('.gif') ? 'gif' : 'svg';
    const category = OVERRIDE_CATEGORY[id] || autoCategory(id);

    // Tags derived from filename
    const tags = id.replace('clawd-', '').split('-').filter(Boolean);

    const existing = assets.get(id);
    // Prefer the animated source when SVG and GIF variants share one semantic ID.
    if (existing?.format === 'gif' && format === 'svg') continue;
    assets.set(id, {
      id,
      src,
      fileName,
      format,
      category,
      tags,
      label: getLabel(id),
      supportsMood: MOOD_IDS.has(id),
      supportsReaction: REACTION_IDS.has(id),
    });
  }

  return [...assets.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/* ── Public exports ── */
export const CLAWD_MANIFEST: readonly ClawdAsset[] = buildManifest();
export const CLAWD_ASSET_ALIASES = [
  { sourceFile: 'clawd-reading.svg', preferredFile: 'clawd-reading.gif', assetId: 'clawd-reading' },
] as const;

/* ── Dev integrity check ── */
if (import.meta.env.DEV) {
  const invalid = CLAWD_MANIFEST.filter(
    (asset) => !asset.src || typeof asset.src !== 'string',
  );
  console.log('[CLAWD manifest]', {
    count: CLAWD_MANIFEST.length,
    invalid: invalid.length,
    first: CLAWD_MANIFEST[0],
  });
  if (invalid.length) {
    console.error('[CLAWD invalid assets]', invalid);
  }
}
export const CLAWD_BY_ID: ReadonlyMap<string, ClawdAsset> = new Map(
  CLAWD_MANIFEST.map((a) => [a.id, a]),
);
export const CLAWD_BY_CATEGORY: ReadonlyMap<ClawdCategory, ClawdAsset[]> = (() => {
  const map = new Map<ClawdCategory, ClawdAsset[]>();
  for (const a of CLAWD_MANIFEST) {
    const list = map.get(a.category) || [];
    list.push(a);
    map.set(a.category, list);
  }
  return map;
})();

export const JOURNAL_MOOD_OPTIONS: readonly JournalMoodOption[] = MOOD_OPTIONS;
export const JOURNAL_MOOD_BY_ID: ReadonlyMap<string, JournalMoodOption> = new Map(
  MOOD_OPTIONS.map((m) => [m.id, m]),
);

export const JOURNAL_REACTION_ASSETS: readonly ClawdAsset[] = CLAWD_MANIFEST.filter(
  (a) => a.supportsReaction,
);

/* ── Lookup helpers ── */
export function getClawdAsset(id: string): ClawdAsset | undefined {
  return CLAWD_BY_ID.get(id);
}

export function getClawdAssetsByCategory(category: ClawdCategory): ClawdAsset[] {
  return CLAWD_BY_CATEGORY.get(category) || [];
}

export function getMoodOption(moodId: string): JournalMoodOption | undefined {
  return JOURNAL_MOOD_BY_ID.get(moodId);
}

export function searchClawdAssets(query: string): ClawdAsset[] {
  const q = query.toLowerCase();
  return CLAWD_MANIFEST.filter(
    (a) =>
      a.label.includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q)),
  );
}
