export interface ParsedExpense {
  amount: number;
  title: string;
  category: '生活' | '飲食' | '工作' | '學習' | '娛樂' | 'AI' | '交通' | '醫療' | '其他';
  mood: '必要' | '衝動' | '安慰' | '後悔' | '開心' | '普通';
  note: string;
  date?: string;
}

const CATEGORY_MAP: [RegExp, ParsedExpense['category']][] = [
  [/飯|餐|咖啡|飲料|早餐|午餐|晚餐|吃|喝|麵|飯|粥|麥當勞|便當|便當|小喫|零食|水果/, '飲食'],
  [/漱口水|衛生紙|日用品|牙膏|毛巾|洗髮|沐浴|洗面|保養|化妝|廚房|清潔|垃圾袋/, '生活'],
  [/ChatGPT|Claude|API|軟體|訂閱.*AI|token|key|模型|Notion|Figma|Vercel|Netlify|Domain|域名/, 'AI'],
  [/書|課程|學習|Udemy|Coursera|電子書|講義|學費/, '學習'],
  [/遊戲|電影|音樂|Netflix|Steam|Spotify|Apple.*Music|YouTube.*Premium|Disney\+/, '娛樂'],
  [/車票|高鐵|捷運|公車|計程車|Uber|油錢|停車|交通卡|機票/, '交通'],
  [/藥|診所|掛號|體檢|醫院|保健|維他命|口罩/, '醫療'],
  [/薪資|獎金|退款|收入|領|賺/, '其他' as any], // income detection
];

function detectCategory(text: string): ParsedExpense['category'] {
  for (const [re, cat] of CATEGORY_MAP) {
    if (re.test(text)) return cat;
  }
  return '其他';
}

function detectMood(text: string): ParsedExpense['mood'] {
  if (/衝動|不小心|亂買|手滑|沒忍住|順手/.test(text)) return '衝動';
  if (/安慰|心情不好|難過|補償|犒賞/.test(text)) return '安慰';
  if (/後悔|不該|後悔了|買錯了/.test(text)) return '後悔';
  if (/開心|喜歡|興奮|期待|終於/.test(text)) return '開心';
  if (/必要|需要|必須|一定|得買/.test(text)) return '必要';
  return '普通';
}

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^[的了個一個一些一點]\s*/, '');
  t = t.trim();
  if (!t) return '未命名支出';
  return t.slice(0, 30);
}

export function parseExpense(text: string): ParsedExpense | null {
  const patterns = [
    /(?:今天)?花了?\s*(\d+)\s*(?:元|塊|块|錢|钱)\s*(?:[買买]了?|在.*[花了])?\s*(.+)/,
    /[買买]了?\s*(.+?)\s*花了?\s*(\d+)\s*(?:元|塊|块|錢|钱)?/,
    /(?:剛剛|刚刚|今天)?在\s*(.+?)\s*花了?\s*(\d+)\s*(?:元|塊|块|錢|钱)?/,
    /(\d+)\s*(?:元|塊|块|錢|钱)\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const g1 = parseInt(match[1], 10);
      const g2 = match[2] || '';
      const amount = Number.isNaN(g1) ? parseInt(g2, 10) : g1;
      const item = Number.isNaN(g1) ? match[1] : g2;
      if (Number.isNaN(amount) || amount <= 0 || amount > 100000) continue;
      const title = cleanTitle(item || text);
      return {
        amount,
        title: title || '消費',
        category: detectCategory(text),
        mood: detectMood(text),
        note: text.trim().slice(0, 120),
      };
    }
  }
  return null;
}
