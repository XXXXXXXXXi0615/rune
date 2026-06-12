import type { AgentTool } from '@/types';

const LS_KEY = 'lunartide_agent_tools_v1';

export const DEFAULT_TOOLS: AgentTool[] = [
  {
    id: 'tool-moonread',
    name: '月讀室',
    type: 'moonread',
    enabled: true,
    description: '讀取月讀室已匯入的書籍內容與當前閱讀段落',
    endpoint: '',
    headers: {},
    allowedPresets: ['moonread', 'luna'],
    requireConfirmation: false,
  },
  {
    id: 'tool-memory',
    name: '記憶搜尋',
    type: 'memory',
    enabled: true,
    description: '搜尋使用者過去記錄的記憶、地點與情緒',
    endpoint: '',
    headers: {},
    allowedPresets: ['luna', 'chat'],
    requireConfirmation: false,
  },
  {
    id: 'tool-websearch',
    name: 'Web Search',
    type: 'web_search',
    enabled: false,
    description: '搜尋網頁內容（需配置後端代理）',
    endpoint: '',
    headers: {},
    allowedPresets: ['luna'],
    requireConfirmation: true,
  },
  {
    id: 'tool-file',
    name: 'File Reader',
    type: 'file_reader',
    enabled: false,
    description: '讀取使用者上傳的檔案內容',
    endpoint: '',
    headers: {},
    allowedPresets: ['luna'],
    requireConfirmation: true,
  },
  {
    id: 'tool-custom',
    name: 'Custom HTTP',
    type: 'custom_http',
    enabled: false,
    description: '自訂 HTTP 端點，用於擴展外部服務',
    endpoint: '',
    headers: {},
    allowedPresets: ['luna'],
    requireConfirmation: true,
  },
];

export function loadTools(): AgentTool[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Merge with defaults so new tools appear
        const merged = DEFAULT_TOOLS.map((d) => {
          const saved = parsed.find((t: AgentTool) => t.id === d.id);
          return saved ? { ...d, ...saved } : d;
        });
        return merged;
      }
    }
  } catch { /* corrupt */ }
  return DEFAULT_TOOLS;
}

export function saveTools(tools: AgentTool[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tools)); } catch { /* quota */ }
}
