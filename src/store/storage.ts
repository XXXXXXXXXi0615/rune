// ================================================================
// Storage utilities — single localStorage key: lunartide_data
// Thin wrappers over the Zustand persist layer.
// ================================================================

import type { ActivityLogEntry, AiConnectionConfig, AppData, ChatContact, ChatPresenceStatus, HealthRecord, MemoryEntry, MemoryLocationPlace, PetImageFrame, PetMood, PetMoodImages, TodoItem } from '@/types';
import { canonicalLocationName, createLocationPosition, DEFAULT_MEMORY_LOCATIONS } from '@/utils/memoryLocations';

export const STORAGE_KEY = 'lunartide_data';

function weekKey(d?: Date): string {
  const now = d || new Date();
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const PET_MOODS: PetMood[] = ['idle', 'happy', 'thinking', 'sleepy', 'anxious', 'shy', 'annoyed', 'error'];
const AI_PROVIDERS: AiConnectionConfig['provider'][] = [
  'openai',
  'openai-compatible',
  'deepseek',
  'gemini',
  'claude',
  'openrouter',
  'groq',
  'siliconflow',
  'ollama',
  'custom-relay',
];
const AI_COMPATIBILITY_MODES: AiConnectionConfig['compatibilityMode'][] = ['openai-compatible', 'native-gemini', 'native-claude'];
const TODO_PRIORITIES: TodoItem['priority'][] = ['low', 'medium', 'high'];
const TODO_CATEGORIES: TodoItem['category'][] = ['life', 'work', 'study', 'health', 'lunartide'];
const TODO_REPEATS: TodoItem['repeat'][] = ['none', 'daily', 'weekly', 'monthly'];

interface LegacyLocationCapsule {
  id?: string;
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  x?: number;
  y?: number;
  createdAt?: number;
  updatedAt?: number;
}

function normalizeLocations(
  value: unknown,
  legacyValue: unknown,
  memoryEntries: unknown,
): MemoryLocationPlace[] {
  const locations = new Map<string, MemoryLocationPlace>(
    DEFAULT_MEMORY_LOCATIONS.map((location) => [location.name, { ...location }]),
  );
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(legacyValue)
      ? legacyValue
      : [];

  for (const candidate of candidates as LegacyLocationCapsule[]) {
    const rawName = typeof candidate?.name === 'string' ? candidate.name.trim() : '';
    if (!rawName) continue;
    const name = canonicalLocationName(rawName);
    const existing = locations.get(name);
    const fallbackPosition = createLocationPosition(name, locations.size);
    const createdAt = Number(candidate.createdAt);
    const updatedAt = Number(candidate.updatedAt);
    locations.set(name, {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : existing?.id || crypto.randomUUID(),
      name,
      rawName: rawName !== name ? rawName : existing?.rawName,
      icon: typeof candidate.icon === 'string' && candidate.icon ? candidate.icon : existing?.icon || 'pin',
      color: typeof candidate.color === 'string' && candidate.color ? candidate.color : existing?.color || '#d4a050',
      description: typeof candidate.description === 'string' ? candidate.description : existing?.description || '',
      x: Number.isFinite(candidate.x) ? Math.min(92, Math.max(8, Number(candidate.x))) : existing?.x ?? fallbackPosition.x,
      y: Number.isFinite(candidate.y) ? Math.min(90, Math.max(10, Number(candidate.y))) : existing?.y ?? fallbackPosition.y,
      createdAt: Number.isFinite(createdAt) ? createdAt : existing?.createdAt || Date.now(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : existing?.updatedAt || Date.now(),
    });
  }

  if (Array.isArray(memoryEntries)) {
    for (const entry of memoryEntries as MemoryEntry[]) {
      const rawName = entry?.location?.rawName?.trim() || entry?.location?.name?.trim() || '';
      if (!rawName) continue;
      const name = canonicalLocationName(entry.location?.name || rawName);
      if (locations.has(name)) continue;
      const position = createLocationPosition(name, locations.size);
      locations.set(name, {
        id: entry.location?.id || crypto.randomUUID(),
        name,
        rawName: rawName !== name ? rawName : undefined,
        icon: 'pin',
        color: '#d4a050',
        description: '',
        ...position,
        createdAt: entry.createdAt || Date.now(),
        updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
      });
    }
  }

  return Array.from(locations.values());
}

function normalizeMemoryEntries(value: unknown, locations: MemoryLocationPlace[]): MemoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const memory = entry as MemoryEntry;
    const rawName = memory.location?.rawName?.trim() || memory.location?.name?.trim() || '';
    if (!rawName) return memory;
    const canonicalName = canonicalLocationName(memory.location?.name || rawName);
    const location = locations.find((item) => item.id === memory.location?.id || item.name === canonicalName);
    return {
      ...memory,
      location: {
        ...memory.location,
        id: location?.id || memory.location?.id,
        name: location?.name || canonicalName,
        rawName: rawName !== (location?.name || canonicalName) ? rawName : memory.location?.rawName,
      },
    };
  });
}

function normalizeHealthRecords(value: unknown): HealthRecord[] {
  if (!Array.isArray(value)) return [];
  const validTypes: HealthRecord['type'][] = ['sleep', 'screenTime', 'mood', 'water'];
  const validSources: HealthRecord['source'][] = ['manual', 'pasted', 'healthConnect', 'systemUsage', 'mcp'];
  const validQualities: HealthRecord['quality'][] = ['poor', 'normal', 'good'];
  return value
    .filter((record) => record && typeof record === 'object')
    .map((record) => {
      const item = record as Partial<HealthRecord>;
      const now = Date.now();
      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        type: validTypes.includes(item.type as HealthRecord['type']) ? item.type as HealthRecord['type'] : 'sleep',
        date: typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().slice(0, 10),
        source: validSources.includes(item.source as HealthRecord['source']) ? item.source as HealthRecord['source'] : 'manual',
        sourceApp: typeof item.sourceApp === 'string' ? item.sourceApp : undefined,
        rawText: typeof item.rawText === 'string' ? item.rawText : undefined,
        sleepStart: typeof item.sleepStart === 'string' ? item.sleepStart : undefined,
        sleepEnd: typeof item.sleepEnd === 'string' ? item.sleepEnd : undefined,
        sleepDurationMinutes: Number.isFinite(item.sleepDurationMinutes) ? Number(item.sleepDurationMinutes) : undefined,
        deepSleepMinutes: Number.isFinite(item.deepSleepMinutes) ? Number(item.deepSleepMinutes) : undefined,
        wakeCount: Number.isFinite(item.wakeCount) ? Number(item.wakeCount) : undefined,
        totalScreenMinutes: Number.isFinite(item.totalScreenMinutes) ? Number(item.totalScreenMinutes) : undefined,
        topApps: Array.isArray(item.topApps) ? item.topApps.filter((a: unknown) => a && typeof a === 'object' && typeof (a as { name: string }).name === 'string') : undefined,
        quality: validQualities.includes(item.quality as HealthRecord['quality']) ? item.quality as HealthRecord['quality'] : 'normal',
        mood: typeof item.mood === 'string' ? item.mood : undefined,
        notes: typeof item.notes === 'string' ? item.notes : undefined,
        createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : now,
        updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : now,
      };
    });
}

function createDefaultChatContacts(): ChatContact[] {
  const now = Date.now();
  return [
    {
      id: 'system',
      name: 'system',
      avatar: 'system',
      status: 'online',
      lastMessage: '',
      unreadCount: 0,
      updatedAt: now,
      route: '/chat/system',
    },
    {
      id: 'luna',
      name: 'LUNARIS',
      avatar: 'partner',
      status: 'online',
      lastMessage: '',
      unreadCount: 0,
      updatedAt: now - 1,
      route: '/chat/luna',
    },
    {
      id: 'custom-placeholder',
      name: 'custom',
      avatar: 'custom',
      status: 'offline',
      lastMessage: '',
      unreadCount: 0,
      updatedAt: now - 2,
      route: '',
    },
  ];
}

function normalizeChatContacts(value: unknown): ChatContact[] {
  const defaults = createDefaultChatContacts();
  const validStatuses: ChatPresenceStatus[] = ['online', 'invisible', 'busy', 'syncing', 'offline', 'local', 'quiet'];
  if (!Array.isArray(value)) return defaults;

  return defaults.map((fallback) => {
    const item = value.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && (entry as Partial<ChatContact>).id === fallback.id
    )) as Partial<ChatContact> | undefined;
    if (!item) return fallback;
    return {
      ...fallback,
      ...item,
      status: validStatuses.includes(item.status as ChatPresenceStatus)
        ? item.status as ChatPresenceStatus
        : fallback.status,
      manualStatusOverride: item.manualStatusOverride === true,
      unreadCount: Number.isFinite(item.unreadCount) ? Math.max(0, Number(item.unreadCount)) : fallback.unreadCount,
      updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : fallback.updatedAt,
      route: fallback.id === 'system' ? '/chat/system' : typeof item.route === 'string' ? item.route : fallback.route,
    };
  });
}

function normalizeActivityLogs(value: unknown): ActivityLogEntry[] {
  if (!Array.isArray(value)) return [];
  const validTypes: ActivityLogEntry['type'][] = ['todo', 'memory', 'health', 'music', 'chat', 'settings', 'system'];
  const validLevels: ActivityLogEntry['level'][] = ['info', 'success', 'warning', 'danger'];
  return value
    .filter((item): item is Partial<ActivityLogEntry> => !!item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      type: validTypes.includes(item.type as ActivityLogEntry['type']) ? item.type as ActivityLogEntry['type'] : 'system',
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'System activity',
      detail: typeof item.detail === 'string' && item.detail.trim() ? item.detail.trim() : undefined,
      route: typeof item.route === 'string' && item.route.trim() ? item.route.trim() : undefined,
      createdAt: Number.isFinite(item.createdAt) ? Number(item.createdAt) : Date.now(),
      read: item.read === true,
      level: validLevels.includes(item.level as ActivityLogEntry['level']) ? item.level as ActivityLogEntry['level'] : 'info',
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 200);
}

export function createDefaultAiConnection(): AiConnectionConfig {
  return {
    enabled: false,
    provider: 'openai',
    compatibilityMode: 'openai-compatible',
    baseUrl: '',
    apiKey: '',
    model: '',
    availableModels: [],
    status: 'not_configured',
    streamingEnabled: true,
    thinkingUiEnabled: true,
    temperature: 0.7,
    contextMessageLimit: 20,
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
  };
}

function isPetMood(value: unknown): value is PetMood {
  return typeof value === 'string' && PET_MOODS.includes(value as PetMood);
}

function normalizePetMoodImages(value: unknown): Partial<Record<PetMood, PetMoodImages>> {
  const next: Partial<Record<PetMood, PetMoodImages>> = {};
  if (!value || typeof value !== 'object') return next;

  for (const mood of PET_MOODS) {
    const slot = (value as Record<string, unknown>)[mood];
    if (!slot || typeof slot !== 'object') continue;
    const frames = Array.isArray((slot as { frames?: unknown }).frames)
      ? ((slot as { frames: unknown[] }).frames
          .filter((frame): frame is PetImageFrame => (
            !!frame
            && typeof frame === 'object'
            && (frame as PetImageFrame).storage === 'indexeddb'
            && typeof (frame as PetImageFrame).key === 'string'
          ))
          .map((frame) => ({
            id: frame.id || frame.key,
            storage: 'indexeddb' as const,
            key: frame.key,
            name: frame.name || frame.key,
            type: frame.type || 'image/png',
            size: Number.isFinite(frame.size) ? frame.size : 0,
            updatedAt: Number.isFinite(frame.updatedAt) ? frame.updatedAt : Date.now(),
          })))
      : [];
    if (frames.length === 0) continue;
    const frameDurationMs = Number((slot as PetMoodImages).frameDurationMs);
    next[mood] = {
      frames,
      frameDurationMs: Number.isFinite(frameDurationMs) ? frameDurationMs : 350,
      loop: (slot as PetMoodImages).loop !== false,
    };
  }
  return next;
}

function migrateLegacyPetImages(value: unknown): Partial<Record<PetMood, PetMoodImages>> {
  const next: Partial<Record<PetMood, PetMoodImages>> = {};
  if (!value || typeof value !== 'object') return next;

  for (const mood of PET_MOODS) {
    const meta = (value as Record<string, unknown>)[mood];
    if (!meta || typeof meta !== 'object') continue;
    const frame = meta as PetImageFrame;
    if (frame.storage !== 'indexeddb' || typeof frame.key !== 'string') continue;
    next[mood] = {
      frames: [{
        id: frame.id || frame.key,
        storage: 'indexeddb',
        key: frame.key,
        name: frame.name || frame.key,
        type: frame.type || 'image/png',
        size: Number.isFinite(frame.size) ? frame.size : 0,
        updatedAt: Number.isFinite(frame.updatedAt) ? frame.updatedAt : Date.now(),
      }],
      frameDurationMs: 350,
      loop: true,
    };
  }
  return next;
}

function normalizeAiConnection(value: Partial<AiConnectionConfig> | undefined): AiConnectionConfig {
  const defaults = createDefaultAiConnection();
  if (!value || typeof value !== 'object') return defaults;

  const providerRaw = (value as Partial<AiConnectionConfig> & { provider?: string }).provider as string | undefined;
  const provider = providerRaw === 'custom'
    ? 'custom-relay'
    : AI_PROVIDERS.includes(providerRaw as AiConnectionConfig['provider'])
      ? providerRaw as AiConnectionConfig['provider']
      : defaults.provider;
  const compatibilityRaw = (value as Partial<AiConnectionConfig> & { compatibilityMode?: string }).compatibilityMode;
  const compatibilityMode = AI_COMPATIBILITY_MODES.includes(compatibilityRaw as AiConnectionConfig['compatibilityMode'])
    ? compatibilityRaw as AiConnectionConfig['compatibilityMode']
    : provider === 'gemini'
      ? 'native-gemini'
      : provider === 'claude'
        ? 'native-claude'
        : 'openai-compatible';
  const validStatuses: AiConnectionConfig['status'][] = ['not_configured', 'configured', 'testing', 'ok', 'error'];
  const status = validStatuses.includes(value.status as AiConnectionConfig['status'])
    ? value.status as AiConnectionConfig['status']
    : defaults.status;
  const availableModels = Array.isArray(value.availableModels)
    ? value.availableModels
        .filter((model) => model && typeof model.id === 'string' && model.id.trim())
        .map((model) => ({ id: model.id.trim(), label: model.label?.trim() || undefined, provider: model.provider?.trim() || undefined }))
    : [];
  const temperature = Number(value.temperature);
  const maxTokens = Number(value.maxTokens);
  const contextMessageLimit = Number(value.contextMessageLimit);

  return {
    ...defaults,
    ...value,
    enabled: value.enabled === true,
    provider,
    compatibilityMode,
    baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl.trim() : '',
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    model: typeof value.model === 'string' ? value.model.trim() : '',
    availableModels,
    status,
    lastTestedAt: Number.isFinite(value.lastTestedAt) ? value.lastTestedAt : undefined,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : undefined,
    streamingEnabled: value.streamingEnabled !== false,
    thinkingUiEnabled: value.thinkingUiEnabled !== false,
    temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : defaults.temperature,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : undefined,
    contextMessageLimit: Number.isFinite(contextMessageLimit)
      ? Math.min(100, Math.max(1, Math.floor(contextMessageLimit)))
      : defaults.contextMessageLimit,
    modelsEndpoint: typeof value.modelsEndpoint === 'string' && value.modelsEndpoint.trim() ? value.modelsEndpoint.trim() : defaults.modelsEndpoint,
    chatEndpoint: typeof value.chatEndpoint === 'string' && value.chatEndpoint.trim() ? value.chatEndpoint.trim() : defaults.chatEndpoint,
  };
}

function normalizeTodos(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const now = Date.now();
      const priority = TODO_PRIORITIES.includes(item.priority as TodoItem['priority'])
        ? item.priority as TodoItem['priority']
        : 'medium';
      const rawCategory = typeof item.category === 'string' ? item.category : '';
      const category = TODO_CATEGORIES.includes(rawCategory as TodoItem['category'])
        ? rawCategory as TodoItem['category']
        : rawCategory === '工作'
          ? 'work'
          : rawCategory === '學習'
            ? 'study'
            : rawCategory === '健康'
              ? 'health'
              : rawCategory === '月潮'
                ? 'lunartide'
                : 'life';
      const repeat = TODO_REPEATS.includes(item.repeat as TodoItem['repeat'])
        ? item.repeat as TodoItem['repeat']
        : 'none';
      const createdAt = Number(item.createdAt);
      const updatedAt = Number(item.updatedAt);

      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        title: typeof item.title === 'string' ? item.title : '',
        date: typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().slice(0, 10),
        time: typeof item.time === 'string' && item.time ? item.time : undefined,
        completed: item.completed === true || item.done === true,
        priority,
        category,
        notes: typeof item.notes === 'string'
          ? item.notes
          : typeof item.note === 'string'
            ? item.note
            : undefined,
        remindAt: typeof item.remindAt === 'string' && item.remindAt ? item.remindAt : undefined,
        repeat,
        createdAt: Number.isFinite(createdAt) ? createdAt : now,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : now,
      };
    });
}

// --------------- default factory ---------------

export function createDefaultStore(): AppData {
  return {
    theme: 'dark',
    accentColor: 'coral',
    language: 'zh-TW' as const,
    userName: 'shuri',
    avatarSize: 44,
    bgOpacity: 1,
    homeCustomCSS: '',
    profile: {
      displayName: 'shuri',
      status: '月潮同步中',
      bio: '今天也慢慢來。',
      avatarInitial: 'S',
      avatarColor: 'user',
    },
    water: {
      goalMl: 2000,
      cupMl: 200,
      todayMl: 0,
      updatedDate: new Date().toISOString().slice(0, 10),
      reminderOn: false,
      reminderInterval: 60,
      dailyLogs: {},
    },
    customEvents: [],
    todos: [],
    countdowns: [],
    journalEntries: [],
    locations: DEFAULT_MEMORY_LOCATIONS.map((location) => ({ ...location })),
    memoryEntries: [],
    healthRecords: [],
    diaryEntries: [],
    launcherIcons: {},
    launcherOrder: ['chat', 'journal', 'calendar', 'music', 'settings'],
    hiddenLauncherApps: [],
    aiConfig: {
      enabled: false,
      mode: 'proxy',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: '',
      baseUrl: '',
      proxyUrl: '',
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
      reasoningEffort: 'medium',
      reasoningSummary: 'brief',
      systemPrompt: '',
      memoryContextEnabled: true,
      devMockEnabled: false,
    },
    aiConnection: createDefaultAiConnection(),
    messages: [],
    chatContacts: createDefaultChatContacts(),
    activityLogs: [],
    recentEmojis: [],
    music: {
      tracks: [],
      currentTrackId: undefined,
      volume: 0.8,
      loop: false,
    },
    chatStickers: [],
    chatBondStyle: 'heart',
    anniversaries: [],
    usage: {
      daily: { date: new Date().toISOString().slice(0, 10), points: 0 },
      weekly: { weekKey: weekKey(), points: 0 },
      logs: [],
    },
    partner: {
      name: 'LUNARIS',
      status: '月潮連線中',
      avatarInitial: 'L',
      avatarColor: 'char',
    },
    connectionStyle: 'heartbeat' as const,
    petWidget: { visible: true, currentMood: 'idle', manualMoodOverride: false, moodImages: {} },
    aiUsage: { daily: {}, logs: [] },
    aiPrompting: {
      systemPrompt: '',
      characterPrompt: '你是 Luna，Lunartide 中的 AI 伴侶。你說話克制、溫柔、帶一點毒舌和傲嬌，但不傷害使用者。',
      stylePrompt: '回應簡潔，不使用 markdown。像月光一樣輕柔、克制，偶爾帶一點傲嬌。',
      safetyPrompt: '不顯示內部思考鏈。不假裝自己能做未接入的功能。',
      memoryEnabled: true,
      memoryLimit: 8,
      diaryMemoryEnabled: true,
      worldBookEnabled: true,
      worldBookEntries: [],
    },
    customStickers: [],
    dailyTarot: { date: '', spread: 'single', cards: [], createdAt: 0 },
    tarotHistory: [],
    agentTools: [],
    agentRuntimeLogs: [],
    providers: [],
  };
}

// --------------- localStorage read / write ---------------

export function loadStore(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Zustand persist wraps in { state: ..., version: ... }
    // But loadStore accepts either raw AppData or the Zustand wrapper
    const data = parsed.state ?? parsed;
    return normalizeStore(data);
  } catch {
    return null;
  }
}

export function saveStore(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full — non-fatal
    console.warn('[lunartide] saveStore failed — localStorage may be full');
  }
}

// --------------- normalise ---------------

export function normalizeStore(partial: Partial<AppData> | null | undefined): AppData {
  const defaults = createDefaultStore();
  if (!partial) return defaults;

  // Shallow-merge top-level keys; deep-merge profile / water / music / aiConfig / aiConnection
  const merged: AppData = { ...defaults, ...partial };
  delete (merged as AppData & { locationCapsules?: unknown }).locationCapsules;

  if (partial.profile) {
    merged.profile = { ...defaults.profile, ...partial.profile };
  }
  if (partial.partner) {
    merged.partner = { ...defaults.partner, ...partial.partner };
  }
  if (partial.water) {
    merged.water = { ...defaults.water, ...partial.water };
  }
  if (partial.music) {
    merged.music = { ...defaults.music, ...partial.music };
  }
  if (partial.aiConfig) {
    merged.aiConfig = { ...defaults.aiConfig, ...partial.aiConfig };
  }
  merged.aiConnection = normalizeAiConnection(partial.aiConnection);
  if (partial.petWidget) {
    const petWidget = partial.petWidget;
    const moodImages = normalizePetMoodImages(petWidget.moodImages);
    const legacyMoodImages = migrateLegacyPetImages(petWidget.images);
    merged.petWidget = {
      ...defaults.petWidget,
      ...petWidget,
      visible: petWidget.visible !== false,
      currentMood: isPetMood(petWidget.currentMood) ? petWidget.currentMood : 'idle',
      manualMoodOverride: petWidget.manualMoodOverride === true,
      moodImages: { ...legacyMoodImages, ...moodImages },
    };
  }
  merged.diaryEntries = Array.isArray(partial.diaryEntries)
    ? partial.diaryEntries.map((entry) => ({
        ...entry,
        visibility: entry.visibility ?? (entry.lock?.enabled ? 'locked' : 'normal'),
      }))
    : [];
  const legacyLocationCapsules = (partial as Partial<AppData> & { locationCapsules?: unknown }).locationCapsules;
  merged.locations = normalizeLocations(partial.locations, legacyLocationCapsules, partial.memoryEntries);
  merged.memoryEntries = normalizeMemoryEntries(partial.memoryEntries, merged.locations);
  merged.healthRecords = normalizeHealthRecords(partial.healthRecords);
  merged.todos = normalizeTodos(partial.todos);
  merged.chatContacts = normalizeChatContacts(partial.chatContacts);
  merged.activityLogs = normalizeActivityLogs(partial.activityLogs);

  return merged;
}
