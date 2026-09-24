// CLAWD 内置预设表情包 — HTTP 状态码主题 + 日常反应
import clawd200 from '@/assets/stickers/clawd/clawd-200.svg';
import clawd201 from '@/assets/stickers/clawd/clawd-201.svg';
import clawd204 from '@/assets/stickers/clawd/clawd-204.svg';
import clawd301 from '@/assets/stickers/clawd/clawd-301.svg';
import clawd400 from '@/assets/stickers/clawd/clawd-400.svg';
import clawd401 from '@/assets/stickers/clawd/clawd-401.svg';
import clawd402 from '@/assets/stickers/clawd/clawd-402.svg';
import clawd403 from '@/assets/stickers/clawd/clawd-403.svg';
import clawd404 from '@/assets/stickers/clawd/clawd-404.svg';
import clawd408 from '@/assets/stickers/clawd/clawd-408.svg';
import clawd410 from '@/assets/stickers/clawd/clawd-410.svg';
import clawd418 from '@/assets/stickers/clawd/clawd-418.svg';
import clawd429 from '@/assets/stickers/clawd/clawd-429.svg';
import clawd451 from '@/assets/stickers/clawd/clawd-451.svg';
import clawd500 from '@/assets/stickers/clawd/clawd-500.svg';
import clawd502 from '@/assets/stickers/clawd/clawd-502.svg';
import clawd503 from '@/assets/stickers/clawd/clawd-503.svg';
import clawd504 from '@/assets/stickers/clawd/clawd-504.svg';
import clawdLove from '@/assets/stickers/clawd/clawd-love.svg';
import clawdWorkingOverheated from '@/assets/stickers/clawd/clawd-working-overheated.svg';

export interface DefaultSticker {
  id: string;
  name: string;
  src: string;
  category: 'clawd';
  keywords: string[];
  isBuiltin: true;
  theme?: 'http' | 'reaction';
}

const HTTP_LABELS: Record<string, string> = {
  '200': 'OK',
  '201': '已建立',
  '204': '無內容',
  '301': '永久移動',
  '400': '錯誤請求',
  '401': '未授權',
  '402': '需付費',
  '403': '禁止',
  '404': '未找到',
  '408': '請求逾時',
  '410': '已消失',
  '418': '我是茶壺',
  '429': '請求過多',
  '451': '法律原因',
  '500': '伺服器錯誤',
  '502': '錯誤閘道',
  '503': '服務不可用',
  '504': '閘道逾時',
};

function httpKeywords(code: string): string[] {
  const base = [code, `HTTP ${code}`];
  if (code === '404') return [...base, '找不到', 'not found', '丟失'];
  if (code === '500') return [...base, '崩潰', 'crash', 'error', '錯誤'];
  if (code === '503') return [...base, '維護', '維護中', 'down', '掛了'];
  if (code === '403') return [...base, '沒權限', 'forbidden', '拒絕'];
  if (code === '418') return [...base, '茶壺', 'teapot', '搞笑', 'funny'];
  if (code === '429') return [...base, '太多', '限流', 'rate limit'];
  if (code === '200') return [...base, '成功', 'ok', '好'];
  return base;
}

export const defaultClawdStickers: DefaultSticker[] = [
  /* ── HTTP Status Codes ── */
  { id: 'clawd-200', name: `200 ${HTTP_LABELS['200']}`, src: clawd200, category: 'clawd', keywords: httpKeywords('200'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-201', name: `201 ${HTTP_LABELS['201']}`, src: clawd201, category: 'clawd', keywords: httpKeywords('201'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-204', name: `204 ${HTTP_LABELS['204']}`, src: clawd204, category: 'clawd', keywords: httpKeywords('204'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-301', name: `301 ${HTTP_LABELS['301']}`, src: clawd301, category: 'clawd', keywords: httpKeywords('301'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-400', name: `400 ${HTTP_LABELS['400']}`, src: clawd400, category: 'clawd', keywords: httpKeywords('400'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-401', name: `401 ${HTTP_LABELS['401']}`, src: clawd401, category: 'clawd', keywords: httpKeywords('401'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-402', name: `402 ${HTTP_LABELS['402']}`, src: clawd402, category: 'clawd', keywords: httpKeywords('402'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-403', name: `403 ${HTTP_LABELS['403']}`, src: clawd403, category: 'clawd', keywords: httpKeywords('403'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-404', name: `404 ${HTTP_LABELS['404']}`, src: clawd404, category: 'clawd', keywords: httpKeywords('404'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-408', name: `408 ${HTTP_LABELS['408']}`, src: clawd408, category: 'clawd', keywords: httpKeywords('408'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-410', name: `410 ${HTTP_LABELS['410']}`, src: clawd410, category: 'clawd', keywords: httpKeywords('410'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-418', name: `418 ${HTTP_LABELS['418']}`, src: clawd418, category: 'clawd', keywords: httpKeywords('418'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-429', name: `429 ${HTTP_LABELS['429']}`, src: clawd429, category: 'clawd', keywords: httpKeywords('429'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-451', name: `451 ${HTTP_LABELS['451']}`, src: clawd451, category: 'clawd', keywords: httpKeywords('451'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-500', name: `500 ${HTTP_LABELS['500']}`, src: clawd500, category: 'clawd', keywords: httpKeywords('500'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-502', name: `502 ${HTTP_LABELS['502']}`, src: clawd502, category: 'clawd', keywords: httpKeywords('502'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-503', name: `503 ${HTTP_LABELS['503']}`, src: clawd503, category: 'clawd', keywords: httpKeywords('503'), isBuiltin: true, theme: 'http' },
  { id: 'clawd-504', name: `504 ${HTTP_LABELS['504']}`, src: clawd504, category: 'clawd', keywords: httpKeywords('504'), isBuiltin: true, theme: 'http' },
  /* ── Reactions ── */
  { id: 'clawd-love', name: '喜歡', src: clawdLove, category: 'clawd', keywords: ['喜歡', '愛心', 'love', 'heart', '愛'], isBuiltin: true, theme: 'reaction' },
  { id: 'clawd-working-overheated', name: '過熱工作中', src: clawdWorkingOverheated, category: 'clawd', keywords: ['工作', '過熱', '忙', '加班', 'work', 'overheated', 'fire'], isBuiltin: true, theme: 'reaction' },
];

export function lookupClawdSticker(id: string): DefaultSticker | undefined {
  return clawdStickerMap.get(id);
}

// Pre-built Map for O(1) lookup — avoids .find() on every StickerBubble render
const clawdStickerMap: ReadonlyMap<string, DefaultSticker> = new Map(
  defaultClawdStickers.map(s => [s.id, s]),
);
