// ================================================================
// Storage utilities — single localStorage key: lunartide_data
// Thin wrappers over the Zustand persist layer.
// ================================================================

import type { ActivityLogEntry, AiConnectionConfig, AppData, AuthState, CalendarEvent, ChatContact, ChatPresenceStatus, ChatProject, ChecklistItem, DiaryEntry, ForumPost, ForumReply, HealthRecord, JournalEntry, JournalEntryKind, JournalEntrySource, JournalImageRef, MemoryEntry, MemoryLocationPlace, Message, MCPConnection, PetImageFrame, PetMood, PetMoodImages, SleepReceipt, TodoItem, TimeEvent } from '@/types';
import { ALL_ACTIVITY_LOG_TYPES } from '@/types';
import { canonicalLocationName, createLocationPosition, DEFAULT_MEMORY_LOCATIONS } from '@/utils/memoryLocations';
import { validateThemeConfig, DEFAULT_THEME_CONFIG } from '@/utils/themeConfig';
import { isLocalDateKey, localDateKey } from '@/utils/date';
import { migrateMoonGateAuthUsername } from '@/features/auth/moonGateCopy';
import {
  AGENT_DEFAULT_AVATAR_INITIAL,
  AGENT_DEFAULT_DISPLAY_NAME,
  SYSTEM_AGENT_NAME,
  migratePartnerToAgent,
} from '@/store/agentIdentity';
import { isHolidayRegion } from '@/features/calendar/holiday/types';

export const STORAGE_KEY = 'lunartide_data';
export const AUTH_UNLOCK_SESSION_KEY = 'lunartide_auth_unlocked';

function localDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readSessionUnlock(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    // Primary: lunartide_session; fallback: lunartide_auth_unlocked (legacy)
    const primary = sessionStorage.getItem('lunartide_session') === 'true';
    if (primary) return true;
    return sessionStorage.getItem(AUTH_UNLOCK_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function normalizeAuth(value: unknown): AuthState {
  const candidate = value && typeof value === 'object'
    ? value as Partial<AuthState>
    : {};
  const username = typeof candidate.username === 'string' ? candidate.username : '';
  const passwordHash = typeof candidate.passwordHash === 'string' ? candidate.passwordHash : '';
  const hasCredential = Boolean(username && passwordHash);
  const accessString = typeof candidate.accessString === 'string' && candidate.accessString.length >= 16
    ? candidate.accessString
    : '';
  const legacyOnboarded = candidate.legacyOnboarded === true || (hasCredential && accessString === '');
  return {
    authEnabled: candidate.authEnabled !== false,
    username,
    passwordHash,
    isUnlocked: Boolean(passwordHash && readSessionUnlock()),
    accessString,
    onboardingComplete: hasCredential ? true : candidate.onboardingComplete === true,
    legacyOnboarded,
  };
}

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
const TODO_CATEGORIES: TodoItem['category'][] = ['life', 'work', 'study', 'health', 'lunartide', 'shopping', 'other'];
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
    const normalizedMemory: MemoryEntry = {
      ...memory,
      companionReactionId: typeof memory.companionReactionId === 'string'
        ? memory.companionReactionId
        : undefined,
    };
    const rawName = memory.location?.rawName?.trim() || memory.location?.name?.trim() || '';
    if (!rawName) return normalizedMemory;
    const canonicalName = canonicalLocationName(memory.location?.name || rawName);
    const location = locations.find((item) => item.id === memory.location?.id || item.name === canonicalName);
    return {
      ...normalizedMemory,
      location: {
        ...memory.location,
        id: location?.id || memory.location?.id,
        name: location?.name || canonicalName,
        rawName: rawName !== (location?.name || canonicalName) ? rawName : memory.location?.rawName,
      },
    };
  });
}

function isoDate(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  return new Date().toISOString();
}

function memorySourceToJournalSource(source: MemoryEntry['source']): JournalEntrySource {
  if (source === 'chat' || source === 'focus' || source === 'diet') return source;
  if (source === 'timekeeper' || source === 'todo') return 'calendar';
  return 'migration';
}

export function memoryToJournalEntry(memory: MemoryEntry): JournalEntry {
  const content = memory.content || memory.bodyThoughts || memory.summary || memory.triggerText || memory.scene || '';
  const lifecycle = memory.status === 'fading'
    ? 'fading'
    : memory.status === 'archived' || memory.status === 'trash'
      ? 'archived'
      : 'active';
  return {
    id: `journal-memory-${memory.id}`,
    kind: 'memory',
    author: memory.owner === 'ai' || memory.createdBy === 'ai' ? 'lunaris' : memory.owner === 'shared' ? 'shared' : 'user',
    title: memory.title || memory.scene || undefined,
    content,
    createdAt: isoDate(memory.createdAt),
    updatedAt: isoDate(memory.updatedAt),
    occurredOn: localDateKey(new Date(memory.createdAt)),
    origin: memory.owner === 'ai' || memory.createdBy === 'ai' ? 'system' : 'imported',
    moodId: typeof memory.moodV4 === 'string' ? memory.moodV4 : typeof memory.mood === 'string' ? memory.mood : undefined,
    companionReactionId: typeof memory.companionReactionId === 'string' ? memory.companionReactionId : undefined,
    tags: Array.isArray(memory.tags) ? memory.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    attachments: (memory.images || []).filter((url): url is string => typeof url === 'string').map((url, index) => ({
      id: `${memory.id}-image-${index}`,
      type: 'image' as const,
      url,
    })),
    favorite: memory.favorite === true,
    pinned: memory.pinned === true || memory.status === 'pinned',
    archived: lifecycle === 'archived',
    aiAccess: memory.allowAiRecall === true ? 'reference' : 'private',
    lifecycle,
    source: memorySourceToJournalSource(memory.source),
    legacyId: memory.id,
  };
}

export function diaryToJournalEntry(entry: DiaryEntry): JournalEntry {
  return {
    id: `journal-diary-${entry.id}`,
    kind: entry.author === 'luna' ? 'ai_diary' : entry.author === 'shared' ? 'shared' : 'diary',
    author: entry.author === 'luna' ? 'lunaris' : entry.author,
    title: entry.title || undefined,
    content: entry.content || '',
    createdAt: isoDate(entry.createdAt),
    updatedAt: isoDate(entry.updatedAt),
    occurredOn: isLocalDateKey(entry.date) ? entry.date : localDateKey(new Date(entry.createdAt)),
    origin: entry.author === 'user' ? 'user' : 'system',
    moodId: entry.mood,
    tags: [],
    attachments: [],
    favorite: false,
    pinned: false,
    archived: false,
    aiAccess: entry.author === 'shared' ? 'coauthor' : 'private',
    lifecycle: 'active',
    source: entry.source === 'chat' ? 'chat' : 'migration',
    legacyId: entry.id,
  };
}

function normalizeJournalWorkspaceEntries(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const validKinds: JournalEntryKind[] = ['diary', 'memory', 'ai_diary', 'shared'];
  const seenIds = new Set<string>();
  return value
    .filter((entry): entry is Partial<JournalEntry> => Boolean(entry && typeof entry === 'object'))
    .map((entry): JournalEntry => {
      const kind = validKinds.includes(entry.kind as JournalEntryKind) ? entry.kind as JournalEntryKind : 'diary';
      const author = entry.author === 'lunaris' || entry.author === 'shared' ? entry.author : 'user';
      const aiAccess = entry.aiAccess === 'reference' || entry.aiAccess === 'coauthor' ? entry.aiAccess : 'private';
      const createdAt = isoDate(entry.createdAt);
      const inferredOrigin = entry.author === 'lunaris' || kind === 'ai_diary' || (entry.source && ['focus', 'diet', 'calendar'].includes(entry.source))
        ? 'system'
        : entry.source === 'migration' || kind === 'memory'
          ? 'imported'
          : 'user';
      return {
        id: typeof entry.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
        kind,
        author,
        title: typeof entry.title === 'string' ? entry.title : undefined,
        content: typeof entry.content === 'string' ? entry.content : '',
        createdAt,
        updatedAt: isoDate(entry.updatedAt || createdAt),
        occurredOn: isLocalDateKey(entry.occurredOn) ? entry.occurredOn : localDateKey(new Date(createdAt)),
        origin: entry.origin === 'demo' || entry.origin === 'system' || entry.origin === 'imported' || entry.origin === 'user'
          ? entry.origin
          : inferredOrigin,
        moodId: typeof entry.moodId === 'string' ? entry.moodId : undefined,
        companionReactionId: typeof entry.companionReactionId === 'string' ? entry.companionReactionId : undefined,
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        attachments: Array.isArray(entry.attachments)
          ? entry.attachments.filter((attachment) => attachment && typeof attachment.url === 'string').map((attachment) => ({
              id: typeof attachment.id === 'string' && attachment.id ? attachment.id : crypto.randomUUID(),
              type: attachment.type === 'file' ? 'file' as const : 'image' as const,
              url: attachment.url,
              name: typeof attachment.name === 'string' ? attachment.name : undefined,
            }))
          : [],
        favorite: entry.favorite === true,
        pinned: entry.pinned === true,
        isLiked: entry.isLiked === true,
        pinnedAt: typeof entry.pinnedAt === 'number' && Number.isFinite(entry.pinnedAt)
          ? entry.pinnedAt
          : entry.pinned === true ? new Date(createdAt).getTime() : null,
        bumpedAt: typeof entry.bumpedAt === 'number' && Number.isFinite(entry.bumpedAt) ? entry.bumpedAt : null,
        lastActivityAt: typeof entry.lastActivityAt === 'number' && Number.isFinite(entry.lastActivityAt) ? entry.lastActivityAt : undefined,
        commentsLockedAt: typeof entry.commentsLockedAt === 'number' && Number.isFinite(entry.commentsLockedAt) ? entry.commentsLockedAt : null,
        viewCount: typeof entry.viewCount === 'number' && Number.isFinite(entry.viewCount) ? Math.max(0, Math.floor(entry.viewCount)) : 0,
        subscribed: entry.subscribed === true,
        mentions: Array.isArray(entry.mentions) ? entry.mentions.filter((mention) => mention && typeof mention.identityId === 'string' && typeof mention.handleSnapshot === 'string' && typeof mention.displayNameSnapshot === 'string') : undefined,
        comments: Array.isArray(entry.comments) ? entry.comments.filter((comment) => comment && typeof comment.id === 'string' && typeof comment.content === 'string').map((comment) => ({
          id:comment.id,
          postId:typeof comment.postId === 'string' ? comment.postId : (typeof entry.id === 'string' ? entry.id : ''),
          parentId:typeof comment.parentId === 'string' ? comment.parentId : undefined,
          rootCommentId:typeof comment.rootCommentId === 'string' ? comment.rootCommentId : undefined,
          authorId:typeof comment.authorId === 'string' ? comment.authorId : 'user',
          content:comment.content,
          createdAt:typeof comment.createdAt === 'number' ? comment.createdAt : Date.parse(createdAt),
          updatedAt:typeof comment.updatedAt === 'number' ? comment.updatedAt : undefined,
          deletedAt:typeof comment.deletedAt === 'number' ? comment.deletedAt : undefined,
          votes:Array.isArray(comment.votes) ? comment.votes.filter((vote) => vote && typeof vote.actorId === 'string' && (vote.value === 1 || vote.value === -1)).map((vote) => ({actorId:vote.actorId,value:vote.value as -1|1,updatedAt:typeof vote.updatedAt === 'number' ? vote.updatedAt : Date.now()})) : [],
          quote: comment.quote && typeof comment.quote === 'object' && typeof comment.quote.commentId === 'string'
            ? { commentId: comment.quote.commentId, authorId: typeof comment.quote.authorId === 'string' ? comment.quote.authorId : 'unknown', excerpt: typeof comment.quote.excerpt === 'string' ? comment.quote.excerpt.slice(0, 200) : '' }
            : undefined,
          mentions: Array.isArray(comment.mentions) ? comment.mentions.filter((mention) => mention && typeof mention.identityId === 'string' && typeof mention.handleSnapshot === 'string' && typeof mention.displayNameSnapshot === 'string') : undefined,
        })) : [],
        archived: entry.archived === true,
        aiAccess,
        access: entry.access === 'private' || (entry.visibility as unknown) === 'private' ? 'private' : 'normal',
        visibility: entry.visibility && typeof entry.visibility === 'object'
          ? {
              hiddenFromOverview: entry.visibility.hiddenFromOverview === true,
              hiddenAt: typeof entry.visibility.hiddenAt === 'number' ? entry.visibility.hiddenAt : undefined,
            }
          : undefined,
        lifecycle: entry.lifecycle === 'fading' || entry.lifecycle === 'archived' ? entry.lifecycle : 'active',
        source: entry.source,
        legacyId: typeof entry.legacyId === 'string' ? entry.legacyId : undefined,
        segments: Array.isArray(entry.segments) ? entry.segments : undefined,
        captureMode: entry.captureMode === 'vent' || entry.captureMode === 'dialogue' || entry.captureMode === 'fragment'
          ? entry.captureMode
          : undefined,
        imageRefs: Array.isArray(entry.imageRefs)
          ? entry.imageRefs
              .filter((ref): ref is JournalImageRef =>
                Boolean(ref && typeof ref === 'object' && typeof (ref as JournalImageRef).photoId === 'string' && (ref as JournalImageRef).photoId))
              .map((ref, index) => ({
                photoId: ref.photoId,
                order: Number.isFinite(ref.order) ? Number(ref.order) : index,
                caption: typeof ref.caption === 'string' ? ref.caption : undefined,
              }))
          : undefined,
        checklistItems: Array.isArray(entry.checklistItems)
          ? entry.checklistItems
              .filter((item): item is ChecklistItem =>
                Boolean(item && typeof item === 'object' && typeof item.id === 'string' && item.id))
              .map((item) => ({
                id: item.id,
                text: typeof item.text === 'string' ? item.text : '',
                done: item.done === true,
                completedAt: typeof item.completedAt === 'string' ? item.completedAt : undefined,
              }))
          : undefined,
      };
    })
    .filter((entry) => {
      if (seenIds.has(entry.id)) {
        if (import.meta.env.DEV) console.warn('[journal normalize] dropped duplicate entry id', entry.id);
        return false;
      }
      seenIds.add(entry.id);
      return true;
    });
}

function mergeLegacyJournalEntries(
  existing: JournalEntry[],
  memories: MemoryEntry[],
  diaries: DiaryEntry[],
): JournalEntry[] {
  const byLegacyId = new Set(existing.map((entry) => entry.legacyId).filter(Boolean));
  const additions = [
    ...diaries.filter((entry) => !byLegacyId.has(entry.id)).map(diaryToJournalEntry),
    ...memories.filter((entry) => !byLegacyId.has(entry.id)).map(memoryToJournalEntry),
  ];
  return [...existing, ...additions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
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

function normalizeSleepReceipts(value: unknown): SleepReceipt[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((receipt) => receipt && typeof receipt === 'object')
    .map((receipt) => {
      const item = receipt as Partial<SleepReceipt>;
      const now = Date.now();
      const createdAt = Number(item.createdAt);
      const updatedAt = Number(item.updatedAt);
      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        type: 'sleep_receipt' as const,
        date: typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().slice(0, 10),
        totalSleep: Number.isFinite(item.totalSleep) ? Number(item.totalSleep) : 420,
        remMinutes: Number.isFinite(item.remMinutes) ? Number(item.remMinutes) : 90,
        coreMinutes: Number.isFinite(item.coreMinutes) ? Number(item.coreMinutes) : 260,
        deepMinutes: Number.isFinite(item.deepMinutes) ? Number(item.deepMinutes) : 70,
        awakeMinutes: Number.isFinite(item.awakeMinutes) ? Number(item.awakeMinutes) : 10,
        sleepScore: Number.isFinite(item.sleepScore) ? Number(item.sleepScore) : 60,
        lunarisComment: typeof item.lunarisComment === 'string' && item.lunarisComment
          ? item.lunarisComment
          : '今天的睡眠已經記錄在月潮裡了。',
        viewed: item.viewed === false ? false : true,
        memoryEntryId: typeof item.memoryEntryId === 'string' ? item.memoryEntryId : undefined,
        savedToSecondBrainAt: Number.isFinite(item.savedToSecondBrainAt) ? Number(item.savedToSecondBrainAt) : undefined,
        createdAt: Number.isFinite(createdAt) ? createdAt : now,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : now,
      };
    });
}

export function normalizeMcpConnections(raw: unknown[]): MCPConnection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item: any) => typeof item?.id === 'string')
    .map((item: any) => ({
      id: String(item.id),
      name: typeof item.name === 'string' ? item.name : '',
      type: typeof item.type === 'string' ? item.type : '',
      enabled: item.enabled === true,
      transport: item.transport === 'sse' ? 'sse' : 'streamable-http',
      serverUrl: typeof item.serverUrl === 'string' ? item.serverUrl : '',
      headers: typeof item.headers === 'object' && item.headers !== null ? { ...item.headers } : undefined,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }));
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
      name: AGENT_DEFAULT_DISPLAY_NAME,
      avatar: 'partner',
      status: 'online',
      lastMessage: '',
      unreadCount: 0,
      updatedAt: now - 1,
      route: '/chat',
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
  const validStatuses: ChatPresenceStatus[] = ['online', 'invisible', 'busy', 'syncing', 'offline', 'local', 'quiet', 'disabled', 'unlinked'];
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
  const validTypes: readonly string[] = ALL_ACTIVITY_LOG_TYPES;
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

  const todos = value
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
      const ticketNumber = Number(item.ticketNumber);

      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        ticketNumber: Number.isInteger(ticketNumber) && ticketNumber > 0 ? ticketNumber : 0,
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

  const usedNumbers = new Set<number>();
  for (const todo of todos) {
    if (todo.ticketNumber > 0 && !usedNumbers.has(todo.ticketNumber)) {
      usedNumbers.add(todo.ticketNumber);
    } else {
      todo.ticketNumber = 0;
    }
  }

  let nextNumber = 1;
  const missingNumbers = todos
    .filter((todo) => todo.ticketNumber === 0)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const todo of missingNumbers) {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    todo.ticketNumber = nextNumber;
    usedNumbers.add(nextNumber);
    nextNumber += 1;
  }

  return todos;
}

function normalizeTimeEvents(value: unknown): TimeEvent[] {
  if (!Array.isArray(value)) return [];
  const validTypes: TimeEvent['type'][] = ['countdown', 'anniversary', 'birthday', 'project', 'personal', 'renewal', 'memory', 'system'];
  const validRepeats: TimeEvent['repeat'][] = ['none', 'yearly', 'monthly'];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const rawDate = typeof item.date === 'string' && item.date
        ? item.date
        : typeof item.targetDate === 'string' && item.targetDate
          ? item.targetDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const type = validTypes.includes(item.type as TimeEvent['type'])
        ? item.type as TimeEvent['type']
        : 'countdown';
      const repeat = validRepeats.includes(item.repeat as TimeEvent['repeat'])
        ? item.repeat as TimeEvent['repeat']
        : 'none';
      const note = typeof item.note === 'string'
        ? item.note
        : typeof item.description === 'string'
          ? item.description
          : undefined;
      const pinned = item.pinned === true || item.isPinned === true;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        title: typeof item.title === 'string' ? item.title : '',
        date: rawDate,
        time: typeof item.time === 'string' && item.time ? item.time : undefined,
        type,
        repeat,
        icon: typeof item.icon === 'string' && item.icon ? item.icon : 'moon',
        note,
        pinned,
        reminderEnabled: item.reminderEnabled === true,
        targetDate: rawDate,
        description: note,
        linkedId: typeof item.linkedId === 'string' ? item.linkedId : undefined,
        linkedType: typeof item.linkedType === 'string' ? item.linkedType as TimeEvent['linkedType'] : undefined,
        isPinned: pinned,
        createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
        updatedAt: typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : new Date().toISOString(),
      };
    });
}

function migrateTimeEventsToCalendarEntries(events: readonly TimeEvent[], existing: readonly CalendarEvent[]): CalendarEvent[] {
  const existingIds = new Set(existing.map((entry) => entry.id));
  const migrated = events
    .filter((event) => !existingIds.has(event.id))
    .map((event): CalendarEvent => ({
      id: event.id,
      type: 'event',
      date: event.date || event.targetDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      title: event.title,
      completed: false,
      description: event.note || event.description || '',
      note: event.note || event.description || undefined,
      isAllDay: !event.time,
      startTime: event.time,
      category: event.type,
      eventType: event.type,
      repeat: event.repeat,
      pinned: event.pinned || event.isPinned === true,
      reminderEnabled: event.reminderEnabled,
      author: 'user',
      precision: event.time ? 'minute' : 'day',
      revision: 1,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    }));
  return [...existing, ...migrated];
}

// --------------- default factory ---------------

export function createDefaultStore(): AppData {
  return {
    auth: {
      authEnabled: true,
      username: '',
      passwordHash: '',
      isUnlocked: false,
      accessString: '',
      onboardingComplete: false,
      legacyOnboarded: false,
    },
    moonGateAuthVersion: 0,
    theme: 'dark',
    accentColor: 'coral',
    themeConfig: { accent: '', backgroundPreset: 'default', glassIntensity: 'medium', radius: 'soft', bubbleStyle: 'glass', fontScale: 1 },
    language: 'zh-TW' as const,
    holidayRegion: null,
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
    calendarNotes: [],
    calendarChanges: [],
    calendarPermissions: { read: true, create: false, update: false, delete: false, comment: true },
    momentsAgentPermissions: { momentsRead: false, momentsWrite: false, momentsInteract: false },
    lastSeenCalendarRevision: 0,
    calendarDayElements: [],
    calendarDayRevisions: [],
    calendarDaySnapshots: [],
    todos: [],
    todoTicketSequence: 0,
    countdowns: [],
    journalEntries: [],
    locations: DEFAULT_MEMORY_LOCATIONS.map((location) => ({ ...location })),
    memoryEntries: [],
    healthRecords: [],
    sleepReceipts: [],
    diaryEntries: [],
    journalWorkspaceEntries: [],
    journalSchemaVersion: 0,
    forumPosts: [],
    forumReplies: [],
    forumNotifications: [],
    timelineEvents: [],
    launcherIcons: {},
    launcherOrder: ['chat', 'journal', 'calendar', 'music', 'settings'],
    hiddenLauncherApps: [],
    dashboardLayout: ['daily_briefing', 'lunaris', 'health_score', 'sleep', 'life_score', 'tide', 'insights', 'mood_timeline', 'heatmap', 'weekly', 'timekeeper', 'todos', 'timeline'],
    hiddenWidgets: ['sync'],
    aiConfig: {
      enabled: false,
      mode: 'proxy',
      provider: 'openai',
      model: '',
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
    conversations: [],
    chatProjects: [],
    activeConversationId: null,
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
      name: SYSTEM_AGENT_NAME,
      displayName: AGENT_DEFAULT_DISPLAY_NAME,
      status: '月潮連線中',
      bio: '你的月潮智能體夥伴。',
      personalityNote: '',
      avatarInitial: AGENT_DEFAULT_AVATAR_INITIAL,
      avatarColor: 'char',
      characterVoice: {
        enabled: false,
        voiceName: '柔和陪伴聲',
        speed: 1,
        autoPlayMode: 'never',
        autoPlay: false,
      },
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
      worldBookMigrationVersion: 0,
    },
    customStickers: [],
    stickerPacks: [],
    dailyTarot: { date: '', spread: 'single', cards: [], createdAt: 0 },
    tarotHistory: [],
    agentTools: [],
    rewardRules: [],
    agentRuntimeLogs: [],
    providers: [],
    mcpConnections: [],
    aiRoles: {
      chat: { providerId: '', model: '', temperature: 0.7, maxTokens: 4096, contextWindow: 20, streaming: true, thinkingUi: false },
      vision: { providerId: '', model: '', temperature: 0.7, maxTokens: 4096, contextWindow: 20, streaming: true, thinkingUi: false },
      embedding: { providerId: '', model: '', temperature: 0.7, maxTokens: 4096, contextWindow: 20, streaming: true, thinkingUi: false },
      speech: { providerId: '', model: '', temperature: 0.7, maxTokens: 4096, contextWindow: 20, streaming: true, thinkingUi: false },
    },
    focusConfig: { focusMinutes: 25, breakMinutes: 5, targetRounds: 0, selectedPreset: 'flow' },
    focusSessionLog: [],
    focusMinutes: 0,
    focusSessions: 0,
    allowClawdInChat: false,
    chatSettings: { continuousMessages: true, burstDelay: 4000 },
    subscriptions: [],
    ledgerEntries: [],
    paymentSources: [],
    ledgerAccounts: [],
    ledgerBudgets: [],
    moneyTransactions: [],
    moonDewLedger: [],
    ledgerDomain: 'money',
    ledgerMigrationVersion: 0,
    tideCheckIn: {
      checkIns: [],
      pointLedger: [],
      currentStreak: 0,
      longestStreak: 0,
      missedCountThisMonth: 0,
      makeupTickets: 0,
      penaltyEnabled: false,
    },
    timeEvents: [],
    forumMigrationVersion: 0,
    forumCleanupVersion: 0,
    hasSeenSettingsIntro: false,
    enableForumAiReplies: false,
    todayMood: null,
    displayFont: '',
    bodyFont: '',
    fontSize: 16,
    syncStatus: 'local' as const,
    customFonts: [],
    cacheRetentionDays: 30,
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

/** Remove known test/seed messages from persisted data */
function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.filter((msg): msg is Message => {
    if (!msg || typeof msg !== 'object') return false;
    const m = msg as Record<string, unknown>;
    if (m.type !== 'text') return true;
    const content = typeof m.content === 'string' ? m.content.trim() : '';
    // Remove messages with bare "1", "11", "111" or "1111" — known test content
    if (content === '1' || content === '11' || content === '111' || content === '1111') return false;
    return true;
  });
}

function normalizeChatProjects(value: unknown): ChatProject[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const project = candidate as Partial<ChatProject>;
    const id = typeof project.id === 'string' ? project.id.trim() : '';
    const name = typeof project.name === 'string' ? project.name.trim() : '';
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    const createdAt = typeof project.createdAt === 'number' && Number.isFinite(project.createdAt) ? project.createdAt : 0;
    const updatedAt = typeof project.updatedAt === 'number' && Number.isFinite(project.updatedAt) ? project.updatedAt : createdAt;
    return [{ id, name, createdAt, updatedAt, ...(project.archived === true ? { archived: true } : {}) }];
  });
}

export function normalizeStore(partial: Partial<AppData> | null | undefined): AppData {
  const defaults = createDefaultStore();
  if (!partial) return defaults;

  // Shallow-merge top-level keys; deep-merge profile / water / music / aiConfig / aiConnection
  const merged: AppData = { ...defaults, ...partial };
  merged.holidayRegion = isHolidayRegion(partial.holidayRegion) ? partial.holidayRegion : null;
  merged.auth = normalizeAuth(partial.auth);
  merged.aiPrompting = {
    ...defaults.aiPrompting,
    ...(partial.aiPrompting || {}),
    worldBookEntries: Array.isArray(partial.aiPrompting?.worldBookEntries) ? partial.aiPrompting.worldBookEntries : [],
    worldBookMigrationVersion: typeof partial.aiPrompting?.worldBookMigrationVersion === 'number' ? partial.aiPrompting.worldBookMigrationVersion : 0,
  };
  merged.messages = normalizeMessages(partial.messages);
  merged.chatProjects = normalizeChatProjects(partial.chatProjects);

  // ── Moon Gate auth migration ──
  // Versioned, idempotent 111° → 111 persisted name migration.
  {
    const storedVersion = typeof partial.moonGateAuthVersion === 'number' ? partial.moonGateAuthVersion : 0;
    const result = migrateMoonGateAuthUsername(merged.auth.username, storedVersion);
    if (result.migrated) {
      merged.auth.username = result.username;
    }
    merged.moonGateAuthVersion = result.version;
  }
  merged.mcpConnections = normalizeMcpConnections(partial.mcpConnections as unknown[]);
  delete (merged as AppData & { locationCapsules?: unknown }).locationCapsules;

  // ── Conversation migration ──
  // If conversations array is missing/empty but legacy messages exist, migrate.
  if (!Array.isArray(partial.conversations) || partial.conversations.length === 0) {
    if (merged.messages.length > 0) {
      const now = Date.now();
      const migrated = {
        id: 'default',
        title: '與 Luna 的對話',
        messages: merged.messages,
        createdAt: merged.messages[0]?.time ? new Date(merged.messages[0].time).getTime() : now,
        updatedAt: merged.messages[merged.messages.length - 1]?.time
          ? new Date(merged.messages[merged.messages.length - 1].time).getTime()
          : now,
        autoTitle: true,
      };
      merged.conversations = [migrated];
      merged.activeConversationId = 'default';
    } else {
      merged.conversations = [];
      merged.activeConversationId = null;
    }
  } else {
    // Normalize conversation shape
    merged.conversations = partial.conversations.map((c) => ({
      ...c,
      id: typeof c.id === 'string' ? c.id : crypto.randomUUID(),
      title: typeof c.title === 'string' ? c.title : '未命名對話',
      messages: normalizeMessages(c.messages),
      createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      pinned: c.pinned === true,
      archived: c.archived === true,
      autoTitle: c.autoTitle !== false,
      kind: c.kind === 'group' || c.type === 'group' ? 'group' : 'direct',
      type: c.kind === 'group' || c.type === 'group' ? 'group' : 'direct',
      participants: (c.kind === 'group' || c.type === 'group') && Array.isArray(c.participants)
        ? c.participants.filter((participant) => participant && typeof participant.id === 'string' && typeof participant.name === 'string')
        : undefined,
      participantIds: (c.kind === 'group' || c.type === 'group') && Array.isArray(c.participantIds)
        ? c.participantIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      replyPolicy: (c.kind === 'group' || c.type === 'group') && ['mention', 'smart', 'roundtable', 'director'].includes(c.replyPolicy || '')
        ? c.replyPolicy
        : (c.kind === 'group' || c.type === 'group') && (c.replyPolicy as string) === 'free' ? 'smart'
        : (c.kind === 'group' || c.type === 'group') && (c.replyPolicy as string) === 'sequential' ? 'roundtable'
        : (c.kind === 'group' || c.type === 'group') && (c.replyPolicy as string) === 'manual' ? 'director'
        : c.kind === 'group' || c.type === 'group' ? 'mention' : undefined,
      muted: c.muted === true,
      savedToContacts: c.savedToContacts === true,
      manualSpeakerSwitchingEnabled: (c.kind === 'group' || c.type === 'group')
        ? c.manualSpeakerSwitchingEnabled !== false
        : undefined,
      currentPerspectiveParticipantId: (c.kind === 'group' || c.type === 'group') && typeof c.currentPerspectiveParticipantId === 'string'
        ? c.currentPerspectiveParticipantId
        : undefined,
      groupParticipants: Array.isArray(c.groupParticipants)
        ? c.groupParticipants
          .filter((gp) => gp && typeof gp.identityId === 'string')
          .map((gp) => ({
            ...gp,
            aiParticipationMode: gp.aiParticipationMode === 'off'
              || gp.aiParticipationMode === 'mention-only'
              || gp.aiParticipationMode === 'automatic'
              ? gp.aiParticipationMode
              : gp.replyPolicy === 'director'
                ? 'off'
                : gp.replyPolicy === 'mention'
                  ? 'mention-only'
                  : 'automatic',
          }))
        : undefined,
      groupRelationships: Array.isArray(c.groupRelationships)
        ? c.groupRelationships
          .filter((r) => r && typeof r.id === 'string' && typeof r.fromParticipantId === 'string' && typeof r.toParticipantId === 'string' && r.fromParticipantId.trim() !== '' && r.toParticipantId.trim() !== '' && r.fromParticipantId !== r.toParticipantId)
          .map((r) => ({
            id: r.id,
            fromParticipantId: r.fromParticipantId,
            toParticipantId: r.toParticipantId,
            kind: ['close', 'friend', 'family', 'rival', 'protective', 'dependent', 'formal', 'custom'].includes(r.kind) ? r.kind : 'custom',
            customLabel: typeof r.customLabel === 'string' ? r.customLabel : undefined,
            note: typeof r.note === 'string' ? r.note : undefined,
            createdAt: typeof r.createdAt === 'number' ? r.createdAt : 1,
            updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 1,
          }))
        : undefined,
    }));
    if (typeof partial.activeConversationId !== 'string'
      || !merged.conversations.some((c) => c.id === partial.activeConversationId)) {
      merged.activeConversationId = merged.conversations[0]?.id ?? null;
    }
  }

  if (partial.profile) {
    merged.profile = { ...defaults.profile, ...partial.profile };
    // ── Signature migration (idempotent) ──
    // 簽名 replaces the 個人簡介(status) editor field. Custom legacy status lines carry
    // over; the schema-default placeholder does NOT (legacy → empty string).
    if (typeof merged.profile.signature !== 'string') {
      const legacyStatus = typeof merged.profile.status === 'string' ? merged.profile.status : '';
      merged.profile.signature = legacyStatus && legacyStatus !== '月潮同步中' ? legacyStatus : '';
    }
  }
  if (partial.partner) {
    merged.partner = migratePartnerToAgent({ ...defaults.partner, ...partial.partner });
    // ── displayName backfill migration (idempotent) ──
    if (!merged.partner.displayName || !merged.partner.displayName.trim()) {
      merged.partner.displayName = merged.partner.name?.trim() || AGENT_DEFAULT_DISPLAY_NAME;
    }
    // ── Partner signature migration (idempotent) ──
    // Custom legacy status lines carry over; the schema-default placeholder does NOT
    // (legacy partner → empty string). Signature is NOT derived from persona/prompt.
    if (typeof merged.partner.signature !== 'string') {
      const legacyStatus = typeof merged.partner.status === 'string' ? merged.partner.status : '';
      merged.partner.signature = legacyStatus && legacyStatus !== '月潮連線中' ? legacyStatus : '';
    }
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
  if (partial.chatSettings) {
    merged.chatSettings = {
      ...defaults.chatSettings,
      ...partial.chatSettings,
    };
  }
  if (partial.themeConfig) {
    merged.themeConfig = validateThemeConfig(partial.themeConfig) ?? DEFAULT_THEME_CONFIG;
  }
  merged.diaryEntries = Array.isArray(partial.diaryEntries)
    ? partial.diaryEntries.map((entry) => ({
        ...entry,
        visibility: entry.visibility ?? (entry.lock?.enabled ? 'locked' : 'normal'),
      }))
    : [];
  /* Forum migration — one-time, gated by version flag */
  merged.forumPosts = Array.isArray(partial.forumPosts) ? partial.forumPosts : [];
  merged.forumReplies = Array.isArray(partial.forumReplies) ? partial.forumReplies : [];
  merged.forumMigrationVersion = typeof partial.forumMigrationVersion === 'number' ? partial.forumMigrationVersion : 0;
  if (merged.forumMigrationVersion < 1) {
    const defaultLunaQuiet = '今天很安靜。月潮沒有催促誰，只是慢慢退去，又慢慢回來。我也在這裡，替這份安靜留一盞小燈。';
    /* Remove any Luna default quiet posts already in forumPosts */
    merged.forumPosts = merged.forumPosts.filter((p) => p.content !== defaultLunaQuiet);
    /* Migrate only user-authored diary entries; skip Luna entries to avoid fake seeded posts */
    const migrated: ForumPost[] = (merged.diaryEntries || [])
      .filter((entry) => entry.author === 'user')
      .map((entry) => ({
        id: `fp-${entry.id}`,
        author: 'user' as const,
        content: entry.content,
        status: entry.visibility === 'sealed' ? 'scheduled' : entry.visibility === 'locked' ? 'locked' : 'normal',
        scheduledOpenAt: entry.lock?.unlockAt,
        linkedMemoryId: entry.source === 'memory' ? entry.id : undefined,
        likes: [],
        bookmarks: [],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      }));
    if (migrated.length > 0) {
      merged.forumPosts = [...migrated, ...merged.forumPosts];
    }
    merged.forumMigrationVersion = 1;
  }
  /* Forum duplicate cleanup — one-time */
  merged.forumCleanupVersion = typeof partial.forumCleanupVersion === 'number' ? partial.forumCleanupVersion : 0;
  if (merged.forumCleanupVersion < 1) {
    const seen = new Map<string, ForumReply[]>();
    for (const reply of merged.forumReplies) {
      if (reply.author !== 'luna') continue;
      const key = `${reply.postId}::${reply.parentReplyId ?? ''}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(reply);
    }
    const toRemove = new Set<string>();
    for (const [, replies] of seen) {
      if (replies.length <= 1) continue;
      /* Keep the latest (max createdAt); remove all older */
      replies.sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 0; i < replies.length - 1; i++) toRemove.add(replies[i].id);
    }
    if (toRemove.size > 0) {
      merged.forumReplies = merged.forumReplies.filter((r) => !toRemove.has(r.id));
    }
    merged.forumCleanupVersion = 1;
  }
  const legacyLocationCapsules = (partial as Partial<AppData> & { locationCapsules?: unknown }).locationCapsules;
  merged.locations = normalizeLocations(partial.locations, legacyLocationCapsules, partial.memoryEntries);
  merged.memoryEntries = normalizeMemoryEntries(partial.memoryEntries, merged.locations);
  const existingJournalEntries = normalizeJournalWorkspaceEntries(partial.journalWorkspaceEntries);
  const previousJournalSchemaVersion = partial.journalSchemaVersion || 0;
  const needsJournalMigration = previousJournalSchemaVersion < 1;
  merged.journalWorkspaceEntries = mergeLegacyJournalEntries(
    existingJournalEntries,
    merged.memoryEntries || [],
    merged.diaryEntries || [],
  );
  if (previousJournalSchemaVersion < 2) {
    merged.journalWorkspaceEntries = merged.journalWorkspaceEntries.filter((entry) => entry.origin !== 'demo');
  }
  merged.journalSchemaVersion = 3;
  if (needsJournalMigration) {
    merged.journalMigrationStats = {
      migratedAt: new Date().toISOString(),
      memoryBefore: merged.memoryEntries.length,
      diaryBefore: merged.diaryEntries.length,
      journalAfter: merged.journalWorkspaceEntries.length,
    };
    console.info('[lunartide] Journal migration', merged.journalMigrationStats);
  } else if (partial.journalMigrationStats) {
    merged.journalMigrationStats = partial.journalMigrationStats;
  }
  merged.healthRecords = normalizeHealthRecords(partial.healthRecords);
  merged.sleepReceipts = normalizeSleepReceipts(partial.sleepReceipts);
  merged.todos = normalizeTodos(partial.todos);
  merged.tideCheckIn = {
    ...defaults.tideCheckIn,
    ...(partial.tideCheckIn || {}),
    checkIns: Array.isArray(partial.tideCheckIn?.checkIns)
      ? partial.tideCheckIn.checkIns.filter((item) => item && typeof item === 'object').map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          date: typeof item.date === 'string' ? item.date : localDateString(Date.now()),
          mood: typeof item.mood === 'string' ? item.mood : undefined,
          note: typeof item.note === 'string' ? item.note : undefined,
          pointsEarned: typeof item.pointsEarned === 'number' ? item.pointsEarned : 0,
          streakDay: typeof item.streakDay === 'number' ? item.streakDay : 1,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        }))
      : [],
    pointLedger: Array.isArray(partial.tideCheckIn?.pointLedger)
      ? partial.tideCheckIn.pointLedger.filter((item) => item && typeof item === 'object').map((item) => ({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          type: item.type === 'spend' || item.type === 'penalty' || item.type === 'adjust' ? item.type : 'earn',
          amount: typeof item.amount === 'number' ? item.amount : 0,
          reason: typeof item.reason === 'string' ? item.reason : '潮汐點調整',
          source: item.source === 'streak' || item.source === 'gacha' || item.source === 'makeup' || item.source === 'manual' ? item.source : 'checkin',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        }))
      : [],
    currentStreak: typeof partial.tideCheckIn?.currentStreak === 'number' ? partial.tideCheckIn.currentStreak : 0,
    longestStreak: typeof partial.tideCheckIn?.longestStreak === 'number' ? partial.tideCheckIn.longestStreak : 0,
    missedCountThisMonth: typeof partial.tideCheckIn?.missedCountThisMonth === 'number' ? partial.tideCheckIn.missedCountThisMonth : 0,
    lastCheckInDate: typeof partial.tideCheckIn?.lastCheckInDate === 'string' ? partial.tideCheckIn.lastCheckInDate : undefined,
    dismissedCheckInPromptDate: typeof partial.tideCheckIn?.dismissedCheckInPromptDate === 'string' ? partial.tideCheckIn.dismissedCheckInPromptDate : undefined,
    makeupTickets: typeof partial.tideCheckIn?.makeupTickets === 'number' ? partial.tideCheckIn.makeupTickets : 0,
    penaltyEnabled: partial.tideCheckIn?.penaltyEnabled === true,
  };
  const storedTodoSequence = Number(partial.todoTicketSequence);
  merged.todoTicketSequence = Math.max(
    Number.isInteger(storedTodoSequence) && storedTodoSequence > 0 ? storedTodoSequence : 0,
    ...merged.todos.map((todo) => todo.ticketNumber),
  );
  merged.chatContacts = normalizeChatContacts(partial.chatContacts);
  merged.activityLogs = normalizeActivityLogs(partial.activityLogs);
  merged.focusConfig = partial.focusConfig
    ? { ...defaults.focusConfig, ...partial.focusConfig }
    : defaults.focusConfig;
  merged.focusSessionLog = Array.isArray(partial.focusSessionLog) ? partial.focusSessionLog : [];
  const legacyTimeEvents = normalizeTimeEvents(partial.timeEvents);
  merged.customEvents = migrateTimeEventsToCalendarEntries(legacyTimeEvents, Array.isArray(merged.customEvents) ? merged.customEvents : []);
  // Legacy time entities are absorbed into the canonical CalendarEntry collection.
  merged.timeEvents = [];
  merged.dashboardLayout = Array.isArray(partial.dashboardLayout) ? partial.dashboardLayout : defaults.dashboardLayout;
  if (!merged.dashboardLayout.includes('timekeeper')) {
    const weeklyIndex = merged.dashboardLayout.indexOf('weekly');
    const insertAt = weeklyIndex >= 0 ? weeklyIndex + 1 : merged.dashboardLayout.length;
    merged.dashboardLayout = [
      ...merged.dashboardLayout.slice(0, insertAt),
      'timekeeper',
      ...merged.dashboardLayout.slice(insertAt),
    ];
  }

  /* ── Dual Ledger Migration (Moon Ledger Phase 1) ── */
  merged.moneyTransactions = Array.isArray(partial.moneyTransactions)
    ? partial.moneyTransactions
    : [];
  merged.moonDewLedger = Array.isArray(partial.moonDewLedger)
    ? partial.moonDewLedger
    : [];
  merged.ledgerDomain = partial.ledgerDomain === 'moon_dew' ? 'moon_dew' : 'money';
  const ledgerMigrationVersion = typeof partial.ledgerMigrationVersion === 'number' ? partial.ledgerMigrationVersion : 0;
  const needsLedgerMigration = ledgerMigrationVersion < 1 && (
    (Array.isArray(partial.ledgerEntries) && partial.ledgerEntries.length > 0)
    || (Array.isArray(partial.tideCheckIn?.pointLedger) && partial.tideCheckIn.pointLedger.length > 0)
  );
  if (needsLedgerMigration) {
    const now = new Date().toISOString();
    // 1) ledgerEntries → moneyTransactions
    if (Array.isArray(partial.ledgerEntries) && partial.ledgerEntries.length > 0 && merged.moneyTransactions.length === 0) {
      const migratedMoney: import('@/types').MoneyTransaction[] = partial.ledgerEntries
        .filter((e) => e && typeof e === 'object')
        .map((e) => {
          const type = e.type === 'income' ? 'income' : 'expense';
          const amountMinor = typeof e.amount === 'number' && Number.isFinite(e.amount)
            ? Math.max(0, Math.round(e.amount * 100))
            : 0;
          return {
            id: typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(),
            type,
            amountMinor,
            currency: typeof e.currency === 'string' ? e.currency : 'TWD',
            accountId: typeof e.paymentSourceId === 'string' ? e.paymentSourceId : 'default',
            categoryId: typeof e.category === 'string' ? e.category : '其他',
            source: e.source === 'chat' ? 'chat' : 'manual',
            title: typeof e.title === 'string' ? e.title : undefined,
            note: typeof e.note === 'string' ? e.note : undefined,
            occurredAt: typeof e.date === 'string' ? `${e.date}T00:00:00+08:00` : now,
            createdAt: typeof e.createdAt === 'number' ? new Date(e.createdAt).toISOString() : now,
            updatedAt: typeof e.updatedAt === 'number' ? new Date(e.updatedAt).toISOString() : undefined,
          };
        });
      merged.moneyTransactions = migratedMoney;
    }
    // 2) tideCheckIn.pointLedger → moonDewLedger
    if (Array.isArray(partial.tideCheckIn?.pointLedger) && partial.tideCheckIn.pointLedger.length > 0 && merged.moonDewLedger.length === 0) {
      const migratedDew: import('@/types').MoonDewLedgerEntry[] = partial.tideCheckIn.pointLedger
        .filter((e) => e && typeof e === 'object')
        .map((e) => {
          const rawAmount = typeof e.amount === 'number' ? e.amount : 0;
          const amount = e.type === 'spend' || e.type === 'penalty' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
          const source: import('@/types').MoonDewSource = e.source === 'checkin' ? 'daily_checkin'
            : e.source === 'streak' ? 'daily_checkin'
            : e.source === 'gacha' ? 'playroom'
            : e.source === 'makeup' ? 'manual_adjustment'
            : e.source === 'manual' ? 'manual_adjustment'
            : 'migration';
          return {
            id: typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(),
            amount,
            source,
            reasonCode: 'migration:legacy-point-ledger',
            title: typeof e.reason === 'string' ? e.reason : '舊版潮汐點遷移',
            idempotencyKey: `migration:legacy-moon-dew-v1:${typeof e.id === 'string' ? e.id : crypto.randomUUID()}`,
            createdAt: typeof e.createdAt === 'string' ? e.createdAt : now,
          };
        });
      merged.moonDewLedger = migratedDew;
    }
    merged.ledgerMigrationVersion = 1;
  }

  // MoonDiet is retired. Legacy fields may still be present in the persisted
  // object, but they are intentionally not hydrated back into production state.
  const retiredDietKeys = ['mealEntries', 'dietReceipts', 'dietSettings', 'cookingLogs', 'recipes'] as const;
  for (const key of retiredDietKeys) delete (merged as unknown as Record<string, unknown>)[key];

  return merged;
}
