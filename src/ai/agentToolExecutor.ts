/* ═══════════════════════════════════════════════════════
   agentToolExecutor.ts — AgentTool Runtime Executor

   Executes built-in AgentTool types when the AI requests
   them via tool calls.

   Usage:
     import { executeAgentTool, agentToolToDefinition } from '@/ai/agentToolExecutor';

     const result = await executeAgentTool(tool, { q: 'hello' });
   ═══════════════════════════════════════════════════════ */

import type { AgentTool, AgentToolType } from '@/types';
import { useAppStore } from '@/store/useAppStore';

/* ── MoonRead tool ── */

async function executeMoonRead(_tool: AgentTool, args: Record<string, unknown>): Promise<string> {
  const query = (args.query || args.q || args.search || '') as string;

  if (query) {
    return `月讀室搜尋：「${query}」— Luna 可以從記憶庫中搜尋相關書籍內容。請前往月讀室匯入書籍後再試。`;
  }

  return '月讀室是 Lunartide 的閱讀空間，可以匯入書籍和文件。目前尚未載入書籍。';
}

/* ── Memory tool ── */

async function executeMemory(_tool: AgentTool, args: Record<string, unknown>): Promise<string> {
  const store = useAppStore.getState();
  const query = (args.query || args.q || args.search || '') as string;
  const limit = Math.min((args.limit || args.max || 5) as number, 20);

  const entries = store.memoryEntries || [];
  const locations = store.locations || [];
  const diaries = store.diaryEntries || [];

  if (!query) {
    return `記憶庫概況：${entries.length} 則記憶 · ${locations.length} 個地點 · ${diaries.length} 篇日記。請提供搜尋關鍵字。`;
  }

  const q = query.toLowerCase();
  const matches = entries
    .filter((e) => {
      const scene = (e.scene || '').toLowerCase();
      const trigger = (e.triggerText || '').toLowerCase();
      const body = (e.bodyThoughts || '').toLowerCase();
      const summary = (e.summary || '').toLowerCase();
      const locationName = (e.location?.name || '').toLowerCase();
      return scene.includes(q) || trigger.includes(q) || body.includes(q) || summary.includes(q) || locationName.includes(q);
    })
    .slice(0, limit);

  if (matches.length === 0) {
    return `記憶庫中沒有找到與 "${query}" 相關的記憶。`;
  }

  const lines = matches.map((e, i) => {
    const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '未知';
    const location = e.location?.name ? `${e.location.name}` : '';
    const summary = e.summary || e.scene?.slice(0, 60) || '';
    return `${i + 1}. ${date}${location ? ` @ ${location}` : ''} — ${summary}`;
  });

  return `找到 ${matches.length} 則記憶：\n${lines.join('\n')}`;
}

/* ── Web Search tool ── */

async function executeWebSearch(tool: AgentTool, args: Record<string, unknown>): Promise<string> {
  const query = (args.query || args.q || args.search || '') as string;
  if (!query) return '請提供搜尋關鍵字（q 或 query）。';

  if (tool.endpoint) {
    try {
      const url = tool.endpoint.replace(/\{query\}/g, encodeURIComponent(query));
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...(tool.headers || {}),
        },
      });
      if (res.ok) {
        const text = await res.text();
        return text.slice(0, 3000);
      }
      return `搜尋請求失敗：HTTP ${res.status}`;
    } catch (err) {
      return `搜尋端點無法連線：${err instanceof Error ? err.message : 'Network error'}`;
    }
  }

  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(ddgUrl, { headers: { 'User-Agent': 'Lunartide/1.0' } });
    if (!res.ok) return `搜尋失敗：HTTP ${res.status}`;

    const html = await res.text();
    const snippets: string[] = [];
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>((?:.|\n)*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = snippetRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text) snippets.push(text);
      if (snippets.length >= 5) break;
    }

    if (snippets.length > 0) {
      return `搜尋「${query}」（DuckDuckGo）：\n${snippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    }
    return `搜尋完成，但無法解析結果。`;
  } catch {
    return 'Web Search 目前不可用。請在能力中心設定自訂搜尋端點。';
  }
}

/* ── File Reader tool ── */

async function executeFileReader(_tool: AgentTool, args: Record<string, unknown>): Promise<string> {
  const store = useAppStore.getState();
  const fileName = (args.fileName || args.name || '') as string;

  const recentFiles = (store.messages || [])
    .filter((m) => m.type === 'file' || m.type === 'image')
    .slice(-10)
    .map((m) => {
      const name = ((m as { fileName?: string }).fileName || (m as { name?: string }).name || (m as { id: string }).id) as string;
      return `${name} (${(m as { type: string }).type})`;
    });

  if (fileName) {
    const match = recentFiles.filter((f) => f.toLowerCase().includes(fileName.toLowerCase()));
    if (match.length > 0) {
      return `找到 ${match.length} 個檔案：\n${match.join('\n')}\n\n（瀏覽器無法直接讀取檔案內容，Luna 只能看到已分享到對話中的圖片與附件資訊。）`;
    }
    return `未找到名稱包含「${fileName}」的檔案。`;
  }

  if (recentFiles.length > 0) {
    return `最近對話中的檔案：\n${recentFiles.join('\n')}`;
  }
  return '目前沒有可讀取的檔案。傳送檔案到對話中即可。';
}

/* ── Custom HTTP tool ── */

async function executeCustomHttp(tool: AgentTool, args: Record<string, unknown>): Promise<string> {
  if (!tool.endpoint) {
    return 'Custom HTTP 未設定端點。請在能力中心設定 endpoint URL。';
  }

  try {
    const res = await fetch(tool.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tool.headers || {}),
      },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return `HTTP ${res.status}: ${errText.slice(0, 500) || res.statusText}`;
    }

    const text = await res.text();
    return text.slice(0, 5000);
  } catch (err) {
    return `Custom HTTP 請求失敗：${err instanceof Error ? err.message : 'Network error'}`;
  }
}

/* ── Type dispatch ── */

const EXECUTORS: Record<AgentToolType, (tool: AgentTool, args: Record<string, unknown>) => Promise<string>> = {
  moonread: executeMoonRead,
  memory: executeMemory,
  web_search: executeWebSearch,
  file_reader: executeFileReader,
  custom_http: executeCustomHttp,
};

export async function executeAgentTool(
  tool: AgentTool,
  args: Record<string, unknown>,
): Promise<string> {
  const executor = EXECUTORS[tool.type];
  if (!executor) {
    return `Tool type "${tool.type}" is not supported.`;
  }
  try {
    return await executor(tool, args);
  } catch (err) {
    return `Tool "${tool.name}" failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

export function agentToolToDefinition(tool: AgentTool): {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
} {
  const params: Record<string, unknown> = {
    type: 'object',
    properties: {},
    required: [],
  };

  switch (tool.type) {
    case 'moonread':
    case 'memory':
    case 'web_search':
      (params.properties as Record<string, unknown>).query = {
        type: 'string',
        description: '搜尋關鍵字',
      };
      break;
    case 'file_reader':
      (params.properties as Record<string, unknown>).fileName = {
        type: 'string',
        description: '檔案名稱',
      };
      break;
    case 'custom_http':
      (params.properties as Record<string, unknown>).body = {
        type: 'object',
        description: '要傳送的 JSON 主體',
      };
      break;
  }

  return {
    type: 'function',
    function: {
      name: `lunartide_${tool.id.replace(/-/g, '_')}`,
      description: tool.description || tool.name,
      parameters: params,
    },
  };
}
