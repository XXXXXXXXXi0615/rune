export type CacheCategoryId =
  | 'network'
  | 'model-metadata'
  | 'weather'
  | 'thumbnails'
  | 'theme-preview'
  | 'chat-runtime'
  | 'offline-shell'
  | 'diagnostics';

export interface CacheEstimate {
  bytes: number | null;
  approximate: boolean;
}

export interface CacheCleaner {
  id: CacheCategoryId;
  label: string;
  description: string;
  safeToClear: true;
  estimateSize(): Promise<CacheEstimate>;
  clear(): Promise<number>;
}

export const PROTECTED_STORAGE = Object.freeze({
  zustand: ['lunartide_data', 'lunartide-chat-runtime', 'lunartide-theme-preset'],
  records: ['Conversations', 'Messages', 'ConversationSummary', 'LongTermMemory', 'Calendar Events', 'Tasks', 'Quests', 'Time Events', 'AI Provider Settings', 'User Preferences', 'Unsaved Drafts'],
  indexedDb: ['lunartide-assets/assets originals', 'lunartide-avatars/blobs', 'lunartide-gacha-assets', 'lunartide-pet-images', 'photo wall originals', 'music library'],
  session: ['lunartide_session', 'lunartide_auth_unlocked', 'API credentials'],
});

export const CACHE_LOCAL_STORAGE_KEYS: Record<Exclude<CacheCategoryId, 'thumbnails' | 'offline-shell'>, readonly string[]> = {
  network: ['lunartide-network-cache'],
  'model-metadata': ['lunartide-model-metadata-cache'],
  weather: ['lunartide-weather-cache'],
  'theme-preview': ['lunartide-theme-preview-cache'],
  'chat-runtime': ['lunartide-token-estimate-cache', 'lunartide-prompt-assembly-cache', 'lunartide-attachment-parse-cache'],
  diagnostics: ['lunartide-diagnostics-cache', 'lunartide-request-diagnostics-cache'],
};

export const CURRENT_APP_SHELL_CACHE = 'lunartide-v2';
export const REGISTERED_OLD_APP_SHELL_CACHES = ['lunartide-v1', 'lunartide-app-shell-v1'] as const;
export const REGISTERED_NETWORK_CACHES = ['lunartide-network-v1'] as const;
export const REGISTERED_THEME_PREVIEW_CACHES = ['lunartide-theme-preview-v1'] as const;

function localStorageCleaner(id: CacheCategoryId, label: string, description: string, keys: readonly string[], cacheNames: readonly string[] = []): CacheCleaner {
  const estimateLocal = () => keys.reduce((sum, key) => {
    const value = localStorage.getItem(key);
    return sum + (value ? new TextEncoder().encode(value).byteLength : 0);
  }, 0);
  const estimateCaches = async () => {
    if (!('caches' in globalThis)) return 0;
    let total = 0;
    for (const name of cacheNames) {
      if (!(await caches.has(name))) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const length = Number(response?.headers.get('content-length'));
        if (Number.isFinite(length)) total += length;
      }
    }
    return total;
  };
  return {
    id, label, description, safeToClear: true,
    async estimateSize() { return { bytes: estimateLocal() + await estimateCaches(), approximate: true }; },
    async clear() {
      const before = estimateLocal() + await estimateCaches();
      keys.forEach((key) => localStorage.removeItem(key));
      if ('caches' in globalThis) await Promise.all(cacheNames.map((name) => caches.delete(name)));
      return before;
    },
  };
}

async function visitDerivedAssets(remove: boolean): Promise<number> {
  if (!('indexedDB' in globalThis)) return 0;
  if (typeof indexedDB.databases === 'function') {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === 'lunartide-assets')) return 0;
  } else {
    // Without a database listing API, avoid opening and accidentally creating an empty formal asset DB.
    return 0;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lunartide-assets', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('assets')) { db.close(); resolve(0); return; }
      const transaction = db.transaction('assets', remove ? 'readwrite' : 'readonly');
      const cursorRequest = transaction.objectStore('assets').openCursor();
      let bytes = 0;
      cursorRequest.onerror = () => reject(cursorRequest.error);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const record = cursor.value as { data?: Blob; kind?: string; isDerived?: boolean; expiresAt?: number };
        const expired = typeof record.expiresAt === 'number' && record.expiresAt <= Date.now();
        const derived = record.isDerived === true && ['thumbnail', 'theme-preview', 'derived'].includes(record.kind || '');
        if (derived || expired) {
          bytes += record.data?.size || 0;
          if (remove) cursor.delete();
        }
        cursor.continue();
      };
      transaction.oncomplete = () => { db.close(); resolve(bytes); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}

const thumbnailCleaner: CacheCleaner = {
  id: 'thumbnails', label: '缩略图', description: '照片与背景的可重建预览图', safeToClear: true,
  async estimateSize() { return { bytes: await visitDerivedAssets(false), approximate: false }; },
  clear: () => visitDerivedAssets(true),
};

export const cacheRegistry: readonly CacheCleaner[] = [
  localStorageCleaner('network', '网络暂存', '可重新下载的网络响应', CACHE_LOCAL_STORAGE_KEYS.network, REGISTERED_NETWORK_CACHES),
  localStorageCleaner('model-metadata', '模型资料', '可重新取得的模型与能力清单', CACHE_LOCAL_STORAGE_KEYS['model-metadata']),
  localStorageCleaner('weather', '天气资料', '过期后可重新取得的天气结果', CACHE_LOCAL_STORAGE_KEYS.weather),
  thumbnailCleaner,
  localStorageCleaner('theme-preview', '主题预览', '可重新产生的主题预览', CACHE_LOCAL_STORAGE_KEYS['theme-preview'], REGISTERED_THEME_PREVIEW_CACHES),
  localStorageCleaner('chat-runtime', '聊天执行暂存', 'Token 估算、附件解析与临时上下文', CACHE_LOCAL_STORAGE_KEYS['chat-runtime']),
  localStorageCleaner('offline-shell', '旧版离线程式', '只移除旧版本 App Shell，保留目前离线版本', [], REGISTERED_OLD_APP_SHELL_CACHES),
  localStorageCleaner('diagnostics', '诊断记录', '本机请求诊断与除错统计', CACHE_LOCAL_STORAGE_KEYS.diagnostics),
];

export function getCacheCleaner(id: CacheCategoryId) {
  return cacheRegistry.find((cleaner) => cleaner.id === id);
}
