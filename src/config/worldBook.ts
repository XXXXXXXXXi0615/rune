/** Read-only compatibility adapter over the canonical AppStore Worldbook owner. */
import type { WorldBookEntry } from '@/types';
import { useAppStore } from '@/store/useAppStore';

export type { WorldBookEntry } from '@/types';

const S2T: Record<string, string> = {
  '这': '這', '个': '個', '们': '們', '么': '麼', '为': '為', '时': '時', '书': '書', '读': '讀',
  '记': '記', '忆': '憶', '关': '關', '系': '係', '电': '電', '脑': '腦', '话': '話', '说': '說',
  '见': '見', '听': '聽', '谁': '誰', '吗': '嗎', '会': '會', '对': '對', '东': '東', '开': '開',
  '体': '體', '气': '氣', '爱': '愛', '让': '讓', '给': '給', '从': '從', '间': '間', '过': '過',
  '现': '現', '当': '當', '学': '學', '觉': '覺', '点': '點', '样': '樣', '里': '裡', '后': '後',
  '没': '沒', '还': '還', '发': '發', '处': '處', '长': '長', '问': '問',
};

function normalize(text: string): string {
  return [...text].map((character) => S2T[character] || character).join('');
}

export function queryWorldBook(text: string): WorldBookEntry[] {
  const entries = useAppStore.getState().aiPrompting.worldBookEntries;
  const lower = normalize(text).toLowerCase();
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({ entry, score: entry.keywords.reduce((score, keyword) => (
      lower.includes(normalize(keyword).toLowerCase()) ? score + keyword.length : score
    ), 0) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.entry.priority - left.entry.priority)
    .map(({ entry }) => entry);
}

export function buildWorldBookContext(text: string): string {
  return queryWorldBook(text).map((entry) => `[世界書：${entry.title}]\n${entry.content}`).join('\n\n');
}
