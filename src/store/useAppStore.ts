import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ForumMention } from '@/types';
import type { AppData, UsageData, BaseMessage, TextMessage, ImageMessage, FileMessage, StickerMessage, Message, Conversation, ConversationSummary, MemoryEntry, DiaryEntry, ForumPost, ForumReply, ForumNotification, TodoItem, CountdownItem, MusicTrack, MemoryLocationPlace, HealthRecord, JournalEntry, ChatPresenceStatus, ActivityLogEntry, FocusConfig, FocusSessionEntry, ThemeConfig, CalendarEvent, TodayMood, SleepReceipt, TimelineEvent, SyncStatus, CustomFontEntry, StickerPack, StickerPackItem, TideCheckIn, TidePointLedger, ChatParticipant, GroupParticipant, GroupReplyPolicy, SenderSnapshot, VoiceMessagePayload, AvatarImageMeta, CharacterVoiceProfile, GroupAiParticipationMode, GroupRelationship, GroupRelationshipKind, WorldBookEntry } from '@/types';
import { deleteAsset, deleteAssets } from '@/store/assets';
import { useToastStore } from '@/store/useToastStore';
import {
  AGENT_DEFAULT_AVATAR_INITIAL,
  AGENT_DEFAULT_DISPLAY_NAME,
  DEFAULT_AGENT_ID,
  SYSTEM_AGENT_NAME,
  type AgentId,
  type AgentProfile,
} from '@/store/agentIdentity';

const VALID_FORUM_IDENTITY_IDS = new Set(['user', 'lunaris']);
function newMentionNotifications(input: { postId: string; sourceId: string; authorId: string; content: string; mentions?: ForumMention[]; previous?: ForumMention[]; existing: ForumNotification[] }): ForumNotification[] {
  const previous = new Set((input.previous ?? []).map((mention) => mention.identityId));
  const seen = new Set<string>();
  const additions: ForumNotification[] = [];
  for (const mention of input.mentions ?? []) {
    if (seen.has(mention.identityId) || previous.has(mention.identityId) || mention.identityId === input.authorId || !VALID_FORUM_IDENTITY_IDS.has(mention.identityId)) continue;
    seen.add(mention.identityId);
    if (input.existing.some((notification) => notification.type === 'mention' && notification.postId === input.postId && notification.replyId === input.sourceId)) continue;
    additions.push({ id:crypto.randomUUID(), type:'mention', postId:input.postId, replyId:input.sourceId, fromAuthor:input.authorId === 'lunaris' ? 'luna' : 'user', contentPreview:input.content.slice(0,60), read:false, createdAt:Date.now() });
  }
  return additions;
}
import { AUTH_UNLOCK_SESSION_KEY, STORAGE_KEY, createDefaultStore, diaryToJournalEntry, memoryToJournalEntry, normalizeStore } from '@/store/storage';
import { DEFAULT_THEME_CONFIG } from '@/utils/themeConfig';
import { t } from '@/i18n';
import { lookupClawdSticker } from '@/data/defaultClawdStickers';
import { sendChatMessage } from '@/ai/client';
import { buildUserSnapshot, buildCharacterSnapshot } from '@/features/characters/characterRuntimeContext';
import { buildSystemPrompt } from '@/ai/prompts';
import { generateConversationSummary } from '@/ai/convMemory';
import { buildMemoryContext } from '@/ai/memoryContext';
import { retrieveRelevantMemories } from '@/ai/retrieveMemories';
import { selectStickerForResponse } from '@/ai/stickerEngine';
import type { RetrievalResult } from '@/ai/retrieveMemories';
import type { ChatMessage } from '@/ai/types';
import { loadTools, saveTools } from '@/config/agentTools';
import { loadRewardRules, saveRewardRules } from '@/config/rewardRules';
import { toLocalDateString } from '@/utils/date';
function canMemoryEnterAiContext(): boolean { return true; }
import { generateMemorySummary, detectMemoryCategory } from '@/ai/memorySummary';
import { loadSleepRecords } from '@/utils/sleepStorage';
import { hasMoonDewKey, settleFocusSession, buildPlayroomMoonDewEntry, MOON_DEW_RULES, todayEarnedBySource, todayLostBySource, CAP_RULES, buildDailyCheckinMoonDew } from '@/utils/moonDewEngine';
import { computeSleepScore, computeLunarisComment, sleepReceiptMemoryBody } from '@/utils/sleepReceipt';
import { usePresenceStore } from '@/store/usePresenceStore';
import { resolveSenderSnapshot } from '@/utils/messageIdentity';
import { useIdentityStore } from '@/store/useIdentityStore';
import { getEffectiveGroupParticipant, getEffectiveGroupParticipants, legacyReplyPolicyFromGroupAiMode, resolveSafeGroupSpeaker } from '@/features/groupChat/participants';
import { resolveConversationPerspective } from '@/features/groupChat/perspective';
import { LEGACY_WORLDBOOK_STORAGE_KEY, WORLDBOOK_MIGRATION_VERSION, migrateLegacyWorldBookEntries, parseLegacyWorldBook } from '@/features/worldbook/worldBookOwnership';
import type { HolidayRegion } from '@/features/calendar/holiday/types';

let _abortController: AbortController | null = null;

function incrementCalendarDayRevisions(state: AppData, dateKeys: string[]) {
  const revisions = [...(state.calendarDayRevisions || [])];
  for (const dateKey of [...new Set(dateKeys.filter(Boolean))]) {
    const index = revisions.findIndex((item) => item.dateKey === dateKey);
    if (index < 0) revisions.push({ dateKey, contentRevision: 1 });
    else revisions[index] = { ...revisions[index], contentRevision: revisions[index].contentRevision + 1 };
  }
  return revisions;
}

/** Generate a short title from the first user message text. */
function generateConvTitle(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return '新對話';
  // Take first meaningful line or truncate
  const firstLine = cleaned.split('\n')[0].trim();
  const maxLen = 20;
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen - 1) + '…';
}

function createEmptyConversation(now = Date.now()): Conversation {
  return {
    id: crypto.randomUUID(),
    title: '新對話',
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    autoTitle: true,
    kind: 'direct',
    type: 'direct',
  };
}

function usageDelta(u: UsageData, pts: number, reason: string): { usage: UsageData } {
  const today = new Date().toISOString().slice(0, 10);
  const n = new Date();
  const y = n.getFullYear();
  const j1 = new Date(y, 0, 1);
  const w = Math.ceil(((n.getTime() - j1.getTime()) / 86400000 + j1.getDay() + 1) / 7);
  const wk = `${y}-W${String(w).padStart(2, '0')}`;

  const daily = u.daily.date === today
    ? { date: today, points: u.daily.points + pts }
    : { date: today, points: pts };
  const weekly = u.weekly.weekKey === wk
    ? { weekKey: wk, points: u.weekly.points + pts }
    : { weekKey: wk, points: pts };

  const logEntry = { id: crypto.randomUUID(), ts: Date.now(), points: pts, reason };
  const logs = [...(u.logs || []), logEntry].slice(-100);

  return { usage: { daily, weekly, logs } };
}

function makeActivityLog(
  type: ActivityLogEntry['type'],
  title: string,
  opts?: { detail?: string; route?: string; level?: ActivityLogEntry['level'] },
): ActivityLogEntry {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    detail: opts?.detail,
    route: opts?.route,
    createdAt: Date.now(),
    read: false,
    level: opts?.level || 'info',
  };
}

/** Advance billing date for a subscription based on its cycle. */
function advanceBillingDate(sub: { billingCycle?: string; customCycleDays?: number; nextBillingDate?: string; renewalDate?: string }): string | undefined {
  const baseStr = sub.nextBillingDate || sub.renewalDate;
  if (!baseStr) return undefined;
  const base = new Date(baseStr + 'T00:00:00');
  if (isNaN(base.getTime())) return undefined;
  const cycle = sub.billingCycle || 'monthly';
  const days = sub.customCycleDays || 0;
  switch (cycle) {
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
    case 'quarterly': base.setMonth(base.getMonth() + 3); break;
    case 'yearly': base.setFullYear(base.getFullYear() + 1); break;
    case 'custom': if (days > 0) base.setDate(base.getDate() + days); break;
    default: break;
  }
  return base.toISOString().slice(0, 10);
}

function localDateString(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function daysBetweenLocal(from: string, to: string): number {
  const start = parseLocalDate(from).getTime();
  const end = parseLocalDate(to).getTime();
  return Math.round((end - start) / 86400000);
}

function calculateCurrentStreakFrom(checkIns: TideCheckIn[], today = localDateString(Date.now())): number {
  const dates = new Set((checkIns || []).map((item) => item.date));
  if (!dates.has(today)) {
    const yesterday = new Date(parseLocalDate(today).getTime() - 86400000);
    const yesterdayStr = localDateString(yesterday.getTime());
    if (!dates.has(yesterdayStr)) return 0;
    today = yesterdayStr;
  }
  let streak = 0;
  let cursor = parseLocalDate(today);
  while (dates.has(localDateString(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function calculateMissedDaysThisMonth(checkIns: TideCheckIn[], timestamp = Date.now()): number {
  const now = new Date(timestamp);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const checkedDates = new Set((checkIns || []).map((item) => item.date));
  const firstCheckInThisMonth = [...checkedDates]
    .filter((date) => {
      const d = parseLocalDate(date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .sort()[0];
  if (!firstCheckInThisMonth) return 0;
  let missed = 0;
  for (let cursor = parseLocalDate(firstCheckInThisMonth); cursor < today; cursor = new Date(cursor.getTime() + 86400000)) {
    if (cursor < monthStart) continue;
    if (!checkedDates.has(localDateString(cursor.getTime()))) missed += 1;
  }
  return missed;
}

/** Append a message to the active conversation (and legacy messages[] for back-compat). */
function appendToActive(
  s: AppData,
  msg: Message,
  extra: Record<string, unknown>,
): Partial<AppData> {
  // ── Phase 1.1: Inject immutable sender snapshot on every new message ──
  if (!msg.messageSnapshot) {
    if (msg.sender === 'me') {
      const snapshot = buildUserSnapshot();
      if (snapshot) { msg.messageSnapshot = snapshot; msg.senderId = snapshot.senderId; }
    } else if (msg.sender === 'assistant') {
      const conv = s.conversations?.find((c) => c.id === s.activeConversationId);
      const charId = conv?.characterIds?.[0];
      const snapshot = buildCharacterSnapshot(charId);
      if (snapshot) { msg.messageSnapshot = snapshot; msg.senderId = snapshot.senderId; msg.characterVersion = snapshot.characterVersion; }
    }
  }
  // ───────────────────────────────────────────────────────────────

  const now = Date.now();
  const activeId = s.activeConversationId;
  const hasConversations = Array.isArray(s.conversations) && s.conversations.length > 0;

  // If no active conversation exists yet, create one on the fly
  if (!activeId || !hasConversations) {
    const newId = msg.id + '-conv' /* fallback unique-ish */;
    const initialTitle =
      msg.sender === 'me' && msg.type === 'text'
        ? generateConvTitle(msg.content)
        : '新對話';
    const conv: Conversation = {
      id: 'default',
      title: initialTitle,
      messages: [msg],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      autoTitle: true,
    };
    return {
      conversations: [conv],
      activeConversationId: 'default',
      messages: [...(s.messages || []), msg],
      ...extra,
    };
  }

  const conversations = s.conversations.map((c) => {
    if (c.id !== activeId) return c;
    const updatedMsgs = [...c.messages, msg];
    const title =
      c.autoTitle !== false && c.messages.length === 0 && msg.sender === 'me' && msg.type === 'text'
        ? generateConvTitle(msg.content)
        : c.title;
    const lastMessageAt = now;
    const isActive = c.id === activeId;
    const unread = msg.sender !== 'me' && !isActive ? (c.unread || 0) + 1 : c.unread || 0;
    const prevCheckpoint = Math.floor(c.messages.length / 20);
    const newCheckpoint = Math.floor(updatedMsgs.length / 20);
    const summary = newCheckpoint > prevCheckpoint
      ? generateConversationSummary(updatedMsgs)
      : c.summary;
    return { ...c, messages: updatedMsgs, title, updatedAt: now, lastMessageAt, unread, summary };
  });
  return {
    conversations,
    messages: [...(s.messages || []), msg],
    ...extra,
  };
}

type GroupSenderMetadata = Partial<Pick<BaseMessage, 'sender' | 'senderParticipantId' | 'senderDisplayNameSnapshot' | 'senderAvatarSnapshot' | 'senderSnapshot' | 'controlSource' | 'deliveryStatus' | 'roundId'>>;

function activeGroupSenderMetadata(s: AppData): GroupSenderMetadata {
  const conversation = s.conversations.find((item) => item.id === s.activeConversationId);
  if (conversation?.kind !== 'group') return {};
  const identities = useIdentityStore.getState().identities;
  const speaker = resolveSafeGroupSpeaker(conversation, identities);
  const senderParticipantId = speaker?.identityId;
  if (!speaker || !senderParticipantId) return {};
  const isNarrator = senderParticipantId === 'narrator';
  const roundId = crypto.randomUUID();

  if (conversation.groupParticipants) {
    const identity = speaker.identity;
    const displayName = speaker.displayName;
    const avatarInitial = displayName.charAt(0);
    return {
      sender: identity?.kind === 'user' ? 'me' : 'assistant',
      senderParticipantId,
      senderDisplayNameSnapshot: displayName,
      senderAvatarSnapshot: avatarInitial,
      senderSnapshot: resolveSenderSnapshot(conversation, identity, senderParticipantId),
      controlSource: isNarrator ? 'system' : 'user',
      deliveryStatus: 'sent',
      roundId,
    };
  }

  const participant = conversation.participants?.find((item) => item.id === senderParticipantId);
  return {
    sender: participant?.isSelf ? 'me' : 'assistant',
    senderParticipantId,
    senderDisplayNameSnapshot: participant?.groupNickname || participant?.name || (isNarrator ? '旁白' : '未知成員'),
    senderAvatarSnapshot: participant?.avatarUrl || participant?.avatarInitial || (isNarrator ? 'N' : '?'),
    controlSource: isNarrator ? 'system' : 'user',
    deliveryStatus: 'sent',
    roundId,
  };
}

/** Append multiple messages to the active conversation. */
function appendToActiveMessages(s: AppData, msgs: Message[]): Partial<AppData> {
  const now = Date.now();
  const activeId = s.activeConversationId;
  const hasConversations = Array.isArray(s.conversations) && s.conversations.length > 0;

  if (!activeId || !hasConversations) {
    const firstText = msgs.find((m): m is TextMessage => m.sender === 'me' && m.type === 'text');
    const conv: Conversation = {
      id: 'default',
      title: firstText ? generateConvTitle(firstText.content) : '新對話',
      messages: [...msgs],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      autoTitle: true,
    };
    return {
      conversations: [conv],
      activeConversationId: 'default',
      messages: [...(s.messages || []), ...msgs],
    };
  }

  const conversations = s.conversations.map((c) => {
    if (c.id !== activeId) return c;
    const updatedMsgs = [...c.messages, ...msgs];
    const firstText = msgs.find((m): m is TextMessage => m.sender === 'me' && m.type === 'text');
    const title =
      c.autoTitle !== false && c.messages.length === 0 && firstText
        ? generateConvTitle(firstText.content)
        : c.title;
    const lastMessageAt = now;
    const isActive = c.id === activeId;
    const receivedCount = msgs.filter((m) => m.sender !== 'me').length;
    const unread = receivedCount > 0 && !isActive ? (c.unread || 0) + receivedCount : c.unread || 0;
    const prevCheckpoint = Math.floor(c.messages.length / 20);
    const newCheckpoint = Math.floor(updatedMsgs.length / 20);
    const summary = newCheckpoint > prevCheckpoint
      ? generateConversationSummary(updatedMsgs)
      : c.summary;
    return { ...c, messages: updatedMsgs, title, updatedAt: now, lastMessageAt, unread, summary };
  });
  return {
    conversations,
    messages: [...(s.messages || []), ...msgs],
  };
}

/** Remove a message from whichever conversation contains it. */
function removeFromConversations(s: AppData, id: string): Partial<AppData> {
  const conversations = s.conversations.map((c) =>
    c.messages.some((m) => m.id === id)
      ? { ...c, messages: c.messages.filter((m) => m.id !== id), updatedAt: Date.now() }
      : c,
  );
  return {
    conversations,
    messages: (s.messages || []).filter((m) => m.id !== id),
  };
}

/** Patch a message inside whichever conversation contains it. */
function patchInConversations(
  s: AppData,
  id: string,
  patchFn: (m: Message) => Message,
): Partial<AppData> {
  const conversations = s.conversations.map((c) =>
    c.messages.some((m) => m.id === id)
      ? {
          ...c,
          messages: c.messages.map((m) => (m.id === id ? patchFn(m) : m)),
          updatedAt: Date.now(),
        }
      : c,
  );
  return {
    conversations,
    messages: (s.messages || []).map((m) => (m.id === id ? patchFn(m) : m)),
  };
}

function journalToMemoryEntry(entry: JournalEntry, memoryId: string): MemoryEntry {
  const createdAt = Number.isNaN(Date.parse(entry.createdAt)) ? Date.now() : Date.parse(entry.createdAt);
  const updatedAt = Number.isNaN(Date.parse(entry.updatedAt)) ? Date.now() : Date.parse(entry.updatedAt);
  const imageAttachments = entry.attachments.filter((attachment) => attachment.type === 'image').map((attachment) => attachment.url);
  return {
    id: memoryId,
    title: entry.title,
    content: entry.content,
    owner: entry.author === 'lunaris' ? 'ai' : entry.author === 'shared' ? 'shared' : 'user',
    createdBy: entry.author === 'lunaris' ? 'ai' : 'user',
    source: entry.source === 'chat' || entry.source === 'focus' || entry.source === 'diet' ? entry.source : 'manual',
    type: entry.kind === 'memory' ? 'journal-memory' : 'journal-entry',
    status: entry.archived ? 'archived' : entry.pinned ? 'pinned' : entry.lifecycle === 'fading' ? 'fading' : 'active',
    allowAiRecall: entry.aiAccess === 'reference' || entry.aiAccess === 'coauthor',
    scene: entry.title || entry.content.slice(0, 30),
    triggerText: '',
    bodyThoughts: entry.content,
    anxietyLevel: 0,
    nextStep: '',
    summary: entry.content.slice(0, 120),
    images: imageAttachments.length > 0 ? imageAttachments : undefined,
    mood: entry.moodId,
    moodV4: entry.moodId as MemoryEntry['moodV4'],
    companionReactionId: entry.companionReactionId,
    favorite: entry.favorite,
    pinned: entry.pinned,
    tags: entry.tags,
    createdAt,
    updatedAt,
  };
}


const initialState: AppData & { aiTyping: boolean } = {
  ...createDefaultStore(),
  agentTools: loadTools(),
  rewardRules: loadRewardRules(),
  aiTyping: false,
};

interface AppActions {
  setupAuth: (username: string, passwordHash: string) => void;
  unlockAuth: () => void;
  lockAuth: () => void;
  resetAuth: () => void;
  /** Rune Login Gate — commit the generated Access String and complete onboarding. */
  establishRuneAccess: (input: { username: string; passwordHash: string; accessString: string }) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setAccentColor: (color: 'coral' | 'teal' | 'lavender' | 'amber' | 'rose') => void;
  setThemeConfig: (config: Partial<ThemeConfig>) => void;
  resetThemeConfig: () => void;
  setLanguage: (language: 'zh-TW' | 'en') => void;
  setHolidayRegion: (region: HolidayRegion | null) => void;
  updateProfile: (data: Partial<AppData['profile']>) => void;
  updatePartner: (data: Partial<AppData['partner']>) => void;
  /** Canonical Agent seam — same persisted carrier as updatePartner. */
  updateAgentProfile: (data: Partial<AppData['partner']>) => void;
  setChatContactStatus: (id: string, status: ChatPresenceStatus) => void;
  updateSettings: (data: Partial<AppData>) => void;
  addWorldBookEntry: (entry: Omit<WorldBookEntry, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateWorldBookEntry: (id: string, patch: Partial<Omit<WorldBookEntry, 'id' | 'createdAt'>>) => void;
  deleteWorldBookEntry: (id: string) => void;
  migrateLegacyWorldBook: () => void;
  setDashboardLayout: (layout: string[]) => void;
  toggleWidget: (widgetId: string) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, 'id' | 'createdAt'>) => void;
  clearAllData: () => Promise<void>;
  /** Clear auto-generated Life Graph sources, keeping manual user data. */
  clearLifeGraphData: () => void;
  sendText: (content: string, replyTo?: { id: string; senderName: string; textPreview: string }) => void;
  sendStructuredText: (content: string, payload: Pick<TextMessage, 'interactive' | 'linkPreview'>, replyTo?: TextMessage['replyTo']) => string;
  sendImage: (assetId: string, fileType: string, opts?: { fileName?: string; fileSize?: number; caption?: string }) => void;
  sendFile: (assetId: string, fileName: string, fileSize: number, fileType: string) => void;
  sendVoice: (payload: VoiceMessagePayload) => string;
  /** Patch a voice message (TTS upgrade path). Only applies to type 'voice'. */
  updateVoiceMessage: (id: string, patch: Partial<VoiceMessagePayload>) => void;
  deleteMessage: (id: string) => void;
  deleteMessageForSelf: (id: string) => void;
  deleteMessageForAll: (id: string, identityId?: string) => void;
  restoreDeletedMessage: (convId: string, msgId: string) => void;
  permanentlyDeleteMessage: (convId: string, msgId: string) => void;
  revokeMessage: (id: string) => void;
  appendAssistantMessage: (message: TextMessage) => void;
  appendAssistantMessages: (messages: TextMessage[]) => void;
  removeLastAssistantMessage: () => void;
  sendSticker: (opts: { url?: string; name?: string; stickerId?: string; source?: 'builtin' | 'user' }) => void;
  updateMessage: (id: string, patch: Partial<TextMessage>) => void;
  pinMessage: (id: string) => void;
  unpinMessage: (id: string) => void;
  archiveMessage: (id: string) => void;
  restoreMessage: (id: string) => void;
  /* ── Message state machine ── */
  transitionMessageState: (id: string, targetState: 'consumedByAI' | 'readByUser' | 'expired') => void;
  cleanupExpired: () => void;
  createConversation: () => string;
  createChatProject: (name: string) => string;
  renameChatProject: (projectId: string, name: string) => void;
  archiveChatProject: (projectId: string) => void;
  deleteChatProject: (projectId: string) => void;
  assignConversationToProject: (conversationId: string, projectId: string | undefined) => void;
  createConversationInProject: (projectId: string) => string;
  createGroupConversation: (input: { title: string; avatarUrl?: string; avatarAssetId?: string; avatarCrop?: Conversation['avatarCrop']; participants?: ChatParticipant[]; identityIds?: string[]; groupParticipants?: GroupParticipant[]; defaultSpeakerIdentityId?: string; muted?: boolean; statusConfig?: Conversation['statusConfig']; manualSpeakerSwitchingEnabled?: boolean }) => string;
  updateGroupConversation: (id: string, patch: Partial<Pick<Conversation, 'customTitle' | 'avatarUrl' | 'avatarAssetId' | 'avatarCrop' | 'announcement' | 'muted' | 'pinned' | 'archived' | 'replyPolicy' | 'savedToContacts' | 'statusConfig'>>) => void;
  updateGroupParticipant: (conversationId: string, participantId: string, patch: Partial<ChatParticipant>) => void;
  updateGroupParticipantReplyPolicy: (conversationId: string, participantId: string, replyPolicy: GroupReplyPolicy) => void;
  updateGroupParticipantMeta: (conversationId: string, participantId: string, patch: Partial<Pick<GroupParticipant, 'displayNameOverride' | 'avatarVariantOverrideId' | 'customAvatarAssetId' | 'customAvatarCrop' | 'order' | 'presenceOverride' | 'aiParticipationMode' | 'replyPolicy'>>) => void;
  addGroupParticipant: (conversationId: string, participant: ChatParticipant) => boolean;
  removeGroupParticipant: (conversationId: string, participantId: string) => void;
  addGroupRelationship: (conversationId: string, fromParticipantId: string, toParticipantId: string, kind: GroupRelationshipKind, customLabel?: string, note?: string) => void;
  updateGroupRelationship: (conversationId: string, relationshipId: string, patch: Partial<Pick<GroupRelationship, 'kind' | 'customLabel' | 'note'>>) => void;
  removeGroupRelationship: (conversationId: string, relationshipId: string) => void;
  setCurrentSpeaker: (conversationId: string, participantId: string) => void;
  setConversationPerspective: (conversationId: string, participantId: string) => void;
  sendGroupText: (content: string, senderParticipantId: string, controlSource: 'user' | 'ai' | 'system', replyTo?: { id: string; senderName: string; textPreview: string }, roundId?: string) => string;
  setMessageDeliveryStatus: (id: string, status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed', readByParticipantIds?: string[]) => void;
  retryMessageDelivery: (id: string) => void;
  deleteConversation: (id: string) => void;
  deleteConversations: (ids: string[]) => number;
  restoreConversation: (id: string) => void;
  permanentlyDeleteConversation: (id: string) => void;
  permanentlyDeleteConversations: (ids: string[]) => void;
  getRecentlyDeletedConversations: () => Conversation[];
  getRecentlyDeletedJournalEntries: () => JournalEntry[];
  cleanupExpiredDeleted: () => void;
  updateConversationsBatch: (ids: string[], patch: Pick<Conversation, 'pinned' | 'archived'>) => number;
  renameConversation: (id: string, title: string) => void;
  pinConversation: (id: string) => void;
  archiveConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  markConversationRead: (id: string) => void;
  clearConversationMessages: (id: string) => void;
  /** Get messages for the active conversation (or legacy messages[] fallback). */
  getActiveMessages: () => Message[];
  /* ── Read Receipts ── */
  /** Mark a participant as having read up to a given message in a conversation.
   *  This is the single writer for participant-level read cursors. */
  markParticipantRead: (conversationId: string, participantId: string, lastReadMessageId: string) => void;
  /** Check whether a specific message is covered by a participant's read cursor. */
  isMessageReadByParticipant: (conversationId: string, messageId: string, participantId: string) => boolean;
  /** Get read summary for an outgoing message in a group conversation.
   *  Returns { total: number, read: number } — total valid recipients (excl. sender) and how many have read. */
  getOutgoingMessageReadSummary: (conversationId: string, messageId: string) => { total: number; read: number };
  /** Get the display label for a message's read receipt status.
   *  Returns the status label string (e.g. '未讀', '已讀') or null for incoming messages. */
  getMessageReadReceiptLabel: (conversationId: string, message: Message) => string | null;
  addMemoryEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => string;
  addJournalWorkspaceEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'legacyId' | 'occurredOn' | 'origin'> & Partial<Pick<JournalEntry, 'occurredOn' | 'origin'>>) => string;
  updateJournalWorkspaceEntry: (id: string, patch: Partial<JournalEntry>) => void;
  setPrimaryPinnedJournalEntry: (id: string | null) => void;
  addJournalComment: (postId: string, input: { content: string; parentId?: string; authorId?: string; quote?: { commentId: string; authorId: string; excerpt: string }; mentions?: ForumMention[] }) => string | null;
  updateJournalComment: (postId: string, commentId: string, content: string, mentions?: ForumMention[]) => void;
  deleteJournalComment: (postId: string, commentId: string) => void;
  setJournalCommentVote: (postId: string, commentId: string, actorId: string, value: -1 | 0 | 1) => void;
  bumpJournalWorkspaceEntry: (id: string, now?: number) => boolean;
  setJournalCommentsLocked: (id: string, locked: boolean) => void;
  /** Phase 1B — increment view count once per session. */
  viewJournalThread: (id: string) => void;
  /** Phase 1B — toggle subscribed state. */
  toggleJournalSubscribe: (id: string) => void;
  deleteJournalWorkspaceEntry: (id: string) => void;
  deleteJournalWorkspaceEntries: (ids: string[]) => number;
  restoreJournalEntries: (ids: string[]) => number;
  permanentlyDeleteJournalEntries: (ids: string[]) => number;
  clearJournalWorkspaceData: () => void;
  moveAllPrivateJournalEntriesToNormal: () => void;
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  generateSleepReceipt: (recordId?: string) => string | null;
  deleteSleepReceipt: (id: string) => void;
  saveSleepReceiptToSecondBrain: (id: string) => boolean;
  markSleepReceiptViewed: (id: string) => void;
  addLocation: (location: Omit<MemoryLocationPlace, 'id' | 'createdAt' | 'updatedAt'>) => string;
  deleteMemoryEntry: (id: string) => void;
  updateMemoryEntry: (id: string, patch: Partial<MemoryEntry>) => void;
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDiaryEntry: (id: string, patch: Partial<DiaryEntry>) => void;
  deleteDiaryEntry: (id: string) => void;
  addForumPost: (post: Omit<ForumPost, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateForumPost: (id: string, patch: Partial<ForumPost>) => void;
  deleteForumPost: (id: string) => void;
  toggleForumLike: (postId: string, username: string) => void;
  toggleForumBookmark: (postId: string, username: string) => void;
  addForumReply: (reply: Omit<ForumReply, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateForumReply: (id: string, patch: Partial<ForumReply>) => void;
  deleteForumReply: (id: string) => void;
  addForumNotification: (notification: Omit<ForumNotification, 'id' | 'read' | 'createdAt'>) => void;
  markForumNotificationRead: (id: string) => void;
  clearForumNotifications: () => void;
  addTodo: (entry: Omit<TodoItem, 'id' | 'ticketNumber' | 'completed' | 'createdAt' | 'updatedAt'>) => void;
  updateTodo: (id: string, patch: Partial<Omit<TodoItem, 'id' | 'ticketNumber' | 'createdAt'>>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  addCountdown: (entry: Omit<CountdownItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  togglePinCountdown: (id: string) => void;
  deleteCountdown: (id: string) => void;
  addWater: (ml: number, date?: string) => void;
  resetWaterIfNeeded: () => void;
  updateWaterSettings: (goalMl: number, cupMl: number) => void;
  addMusicTrack: (assetId: string, fileName: string, fileSize: number, fileType: string) => void;
  deleteMusicTrack: (id: string) => void;
  setCurrentTrack: (id: string | undefined) => void;
  setVolume: (volume: number) => void;
  toggleLoop: () => void;
  setTrackDuration: (id: string, duration: number) => void;
  addUsagePoints: (pts: number) => void;
  addFocusTime: (minutes: number) => void;
  incrementCompletedRounds: () => void;
  resetFocusStats: () => void;
  updateFocusConfig: (config: Partial<FocusConfig>) => void;
  addFocusSessionEntry: (entry: FocusSessionEntry) => void;
  addSticker: (name: string, url: string, assetId?: string) => void;
  deleteSticker: (id: string) => void;
  createStickerPack: (name: string, owner: 'user' | 'lunaris') => string;
  addStickerToPack: (packId: string, name: string, url: string, assetId?: string, type?: 'image' | 'gif') => void;
  deleteStickerFromPack: (packId: string, itemId: string) => void;
  deleteStickerPack: (packId: string) => void;
  sendAiMessage: (content: string) => Promise<void>;
  abortAiGeneration: () => void;
  addActivityLog: (entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'read'>) => void;
  markActivityRead: (id: string) => void;
  clearActivityLogs: () => void;
  saveDailyTarot: (spread: import('@/types').TarotSpread, cards: import('@/types').TarotDrawCard[]) => void;
  resetDailyTarot: () => void;
  toggleTool: (toolId: string) => void;
  /* ── Reward Rules CRUD ── */
  addRewardRule: (rule: Omit<import('@/types').RewardRule, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRewardRule: (id: string, patch: Partial<import('@/types').RewardRule>) => void;
  deleteRewardRule: (id: string) => void;
  toggleRewardRule: (id: string) => void;
  addRuntimeLog: (log: import('@/types').AgentRuntimeLog) => void;
  addAiUsageLog: (entry: import('@/types').AiUsageLogEntry) => void;
  clearAiUsageLogs: () => void;
  addProvider: (provider: import('@/types').ProviderConfig) => void;
  updateProvider: (id: string, patch: Partial<import('@/types').ProviderConfig>) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  createMcp: (mcp: import('@/types').MCPConnection) => void;
  updateMcp: (id: string, patch: Partial<import('@/types').MCPConnection>) => void;
  deleteMcp: (id: string) => void;
  toggleMcp: (id: string) => void;
  setAiRole: (role: import('@/types').AiRole, config: Partial<import('@/types').RoleConfig>) => void;
  addSubscription: (record: Omit<import('@/types').SubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSubscription: (id: string, patch: Partial<import('@/types').SubscriptionRecord>) => void;
  deleteSubscription: (id: string) => void;
  generateSubscriptionEntry: (subscriptionId: string) => string | null;
  /* ── Ledger ── */
  ledgerEntries: import('@/types').LedgerEntry[];
  addLedgerEntry: (entry: Omit<import('@/types').LedgerEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateLedgerEntry: (id: string, patch: Partial<import('@/types').LedgerEntry>) => void;
  deleteLedgerEntry: (id: string) => void;
  /* ── Dual Ledger (Moon Ledger Phase 1) ──
     CANONICAL FINANCE LAYER (Life Utility Phase A finance safety lock):
     the canonical owner of expense/income records is the Life Ledger IndexedDB
     (`lunartide-life-ledger-v1` → `entries`) through
     `src/features/lifeLedger/canonicalFinanceStore.ts`; this array is a derived
     read cache for presentation. Planned Cashflow UI retirement must NOT delete
     `moneyTransactions`, `canonicalFinanceStore`, the Life Ledger finance entries,
     or the chat expense ingestion path. See docs/reports/life-utility-phase-a-ownership-closure.md. */
  moneyTransactions: import('@/types').MoneyTransaction[];
  addMoneyTransaction: (entry: Omit<import('@/types').MoneyTransaction, 'id' | 'createdAt'>) => void;
  updateMoneyTransaction: (id: string, patch: Partial<import('@/types').MoneyTransaction>) => void;
  deleteMoneyTransaction: (id: string) => void;
  moonDewLedger: import('@/types').MoonDewLedgerEntry[];
  addMoonDewEntry: (entry: Omit<import('@/types').MoonDewLedgerEntry, 'id' | 'createdAt'>) => boolean;
  reverseMoonDewEntry: (entryId: string, reason: string) => boolean;
  getMoonDewBalance: () => number;
  ledgerDomain: import('@/types').LedgerDomain;
  setLedgerDomain: (domain: import('@/types').LedgerDomain) => void;
  settleFocusForMoonDew: (opts: {
    sessionId: string;
    status: 'completed' | 'interrupted' | 'early_exit' | 'abandoned';
    actualFocusMinutes: number;
    flags: { overAdjusting?: boolean; earlyEscape?: boolean; noTaskDefined?: boolean; goodRecovery?: boolean; honestCompletion?: boolean; fakePreparation?: boolean };
  }) => boolean;
  grantPlayroomMoonDew: (opts: { eventId: string; title: string; amount: number; achievementId?: string }) => boolean;
  /* ── Payment Sources ── */
  paymentSources?: import('@/types').PaymentSource[];
  addPaymentSource: (source: Omit<import('@/types').PaymentSource, 'id' | 'createdAt'>) => void;
  updatePaymentSource: (id: string, patch: Partial<import('@/types').PaymentSource>) => void;
  deletePaymentSource: (id: string) => void;
  /* ── Ledger Accounts ── */
  ledgerAccounts?: import('@/types').LedgerAccountCard[];
  addLedgerAccount: (record: Omit<import('@/types').LedgerAccountCard, 'id' | 'createdAt'>) => void;
  updateLedgerAccount: (id: string, patch: Partial<import('@/types').LedgerAccountCard>) => void;
  deleteLedgerAccount: (id: string) => void;
  /* ── Ledger Budgets ── */
  ledgerBudgets?: import('@/types').LedgerBudget[];
  addLedgerBudget: (budget: Omit<import('@/types').LedgerBudget, 'id' | 'createdAt'>) => void;
  updateLedgerBudget: (id: string, patch: Partial<import('@/types').LedgerBudget>) => void;
  deleteLedgerBudget: (id: string) => void;
  /* ── Tide Check-in ── */
  checkInToday: (note?: string, mood?: string) => { checkIn: TideCheckIn; rewards: TidePointLedger[]; moonDewAdded: boolean } | null;
  canCheckInToday: () => boolean;
  getTodayCheckIn: () => TideCheckIn | undefined;
  getCurrentStreak: () => number;
  getTidePointBalance: () => number;
  addTidePoints: (amount: number, reason: string, source: TidePointLedger['source']) => void;
  spendTidePoints: (amount: number, reason: string, source: TidePointLedger['source']) => boolean;
  calculateMissedDays: () => number;
  getMonthlyCheckInMap: () => Record<string, boolean>;
  dismissCheckInPromptToday: () => void;
  shouldShowCheckInPromptOnHome: () => boolean;
  setTodayMood: (mood: TodayMood | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  addCustomFont: (font: CustomFontEntry) => void;
  removeCustomFont: (id: string) => void;
}

/* ── Ephemeral expiry scheduling ── */
const _expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
let _scheduleExpiry: (id: string) => void = () => {};

export const useAppStore = create<AppData & AppActions & { aiTyping: boolean; rhythmReceipts: SleepReceipt[] }>()(
  persist(
    (set, get) => ({
      ...initialState,
      rhythmReceipts: [] as SleepReceipt[],

      setupAuth: (username, passwordHash) => {
        try {
          sessionStorage.setItem(AUTH_UNLOCK_SESSION_KEY, 'true');
          sessionStorage.setItem('lunartide_session', 'true');
        } catch { /* sessionStorage can be unavailable in private modes */ }
        set((state) => ({
          auth: {
            ...state.auth,
            authEnabled: true,
            username,
            passwordHash,
            isUnlocked: true,
          },
        }));
      },

      unlockAuth: () => {
        try {
          sessionStorage.setItem(AUTH_UNLOCK_SESSION_KEY, 'true');
          sessionStorage.setItem('lunartide_session', 'true');
        } catch { /* sessionStorage can be unavailable in private modes */ }
        set((state) => ({ auth: { ...state.auth, isUnlocked: true } }));
      },

      lockAuth: () => {
        try {
          sessionStorage.removeItem(AUTH_UNLOCK_SESSION_KEY);
          sessionStorage.removeItem('lunartide_session');
        } catch { /* sessionStorage can be unavailable in private modes */ }
        set((state) => ({ auth: { ...state.auth, isUnlocked: false } }));
      },

      resetAuth: () => {
        try {
          sessionStorage.removeItem(AUTH_UNLOCK_SESSION_KEY);
          sessionStorage.removeItem('lunartide_session');
        } catch { /* sessionStorage can be unavailable in private modes */ }
        set((state) => ({
          auth: {
            ...state.auth,
            authEnabled: true,
            username: '',
            passwordHash: '',
            accessString: '',
            onboardingComplete: false,
            legacyOnboarded: false,
            isUnlocked: false,
          },
        }));
      },

      establishRuneAccess: ({ username, passwordHash, accessString }) => {
        try {
          sessionStorage.setItem(AUTH_UNLOCK_SESSION_KEY, 'true');
          sessionStorage.setItem('lunartide_session', 'true');
        } catch { /* sessionStorage can be unavailable in private modes */ }
        set((state) => ({
          auth: {
            ...state.auth,
            authEnabled: true,
            username,
            passwordHash,
            accessString,
            onboardingComplete: true,
            legacyOnboarded: false,
            isUnlocked: true,
          },
        }));
      },

      setTheme: (theme) => set({ theme }),

      setAccentColor: (color) => set({ accentColor: color }),
      setThemeConfig: (config) => set(s => ({ themeConfig: { ...s.themeConfig, ...config } })),
      resetThemeConfig: () => set({ themeConfig: { ...DEFAULT_THEME_CONFIG } }),

      setLanguage: (language) => set({ language }),
      setHolidayRegion: (holidayRegion) => set({ holidayRegion }),

      updateProfile: (data) =>
        set((s) => ({
          profile: { ...s.profile, ...data },
        })),

      updatePartner: (data) =>
        set((s) => ({
          partner: { ...s.partner, ...data },
        })),

      updateAgentProfile: (data) =>
        set((s) => ({
          partner: { ...s.partner, ...data, id: s.partner.id || DEFAULT_AGENT_ID },
        })),

      setChatContactStatus: (id, status) =>
        set((state) => {
          const contact = state.chatContacts.find((c) => c.id === id);
          const activityLog = contact && contact.status !== status
            ? makeActivityLog('chat', `Luna 狀態切換為「${t(`chat.presence.${status}`)}」`, { route: '/chat', level: 'info' })
            : null;
          const result: Record<string, unknown> = {
            chatContacts: state.chatContacts.map((contact) => (
              contact.id === id
                ? { ...contact, status, manualStatusOverride: true, updatedAt: Date.now() }
                : contact
            )),
          };
          if (activityLog) {
            result.activityLogs = [activityLog, ...(state.activityLogs || [])].slice(0, 200);
          }
          return result as { chatContacts: typeof state.chatContacts; activityLogs?: typeof state.activityLogs };
        }),

      updateSettings: (data) => set(data),

      addWorldBookEntry: (entry) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => ({ aiPrompting: { ...state.aiPrompting,
          worldBookEntries: [...state.aiPrompting.worldBookEntries, { ...entry, id, createdAt: now, updatedAt: now }] } }));
        return id;
      },

      updateWorldBookEntry: (id, patch) => set((state) => ({ aiPrompting: { ...state.aiPrompting,
        worldBookEntries: state.aiPrompting.worldBookEntries.map((entry) => entry.id === id ? { ...entry, ...patch, id, updatedAt: Date.now() } : entry) } })),

      deleteWorldBookEntry: (id) => set((state) => ({ aiPrompting: { ...state.aiPrompting,
        worldBookEntries: state.aiPrompting.worldBookEntries.filter((entry) => entry.id !== id) } })),

      migrateLegacyWorldBook: () => {
        const state = get();
        if (state.aiPrompting.worldBookMigrationVersion >= WORLDBOOK_MIGRATION_VERSION) return;
        let raw: string | null = null;
        try { raw = localStorage.getItem(LEGACY_WORLDBOOK_STORAGE_KEY); } catch { /* unavailable */ }
        const migration = migrateLegacyWorldBookEntries(state.aiPrompting.worldBookEntries, parseLegacyWorldBook(raw));
        set({ aiPrompting: { ...state.aiPrompting, worldBookEntries: migration.entries,
          worldBookMigrationVersion: WORLDBOOK_MIGRATION_VERSION } });
      },

      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
      toggleWidget: (widgetId) => set((s) => {
        const hidden = s.hiddenWidgets.includes(widgetId)
          ? s.hiddenWidgets.filter((id) => id !== widgetId)
          : [...s.hiddenWidgets, widgetId];
        return { hiddenWidgets: hidden };
      }),

      addTimelineEvent: (event) =>
        set((s) => ({
          timelineEvents: [
            { ...event, id: crypto.randomUUID(), createdAt: Date.now() },
            ...(s.timelineEvents || []),
          ].slice(0, 500),
        })),

      clearAllData: async () => {
        const state = useAppStore.getState();
        const assetIds: string[] = [];
        // Collect asset IDs from all modules
        for (const msg of state.messages) {
          if ((msg.type === 'image' || msg.type === 'file') && msg.assetId) {
            assetIds.push(msg.assetId);
          }
        }
        for (const track of state.music.tracks) {
          if (track.assetId) assetIds.push(track.assetId);
        }
        // Profile images
        if (state.profile.avatarAssetId) assetIds.push(state.profile.avatarAssetId);
        if (state.profile.coverAssetId) assetIds.push(state.profile.coverAssetId);
        if (state.profile.chatBackgroundAssetId) assetIds.push(state.profile.chatBackgroundAssetId);
        try {
          await deleteAssets(assetIds);
        } catch { /* IndexedDB may already be empty */ }
        // Clear device identity
        try { localStorage.removeItem('lunartide_mg_identity_v1'); } catch { /* unavailable */ }
        // Clear session unlock markers
        try {
          sessionStorage.removeItem('lunartide_auth_unlocked');
          sessionStorage.removeItem('lunartide_session');
          sessionStorage.removeItem('lunartide_session_expired');
        } catch { /* unavailable */ }
        // Clear Zustand persist
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      },

      clearLifeGraphData: () =>
        set((s) => ({
          // Clear auto-generated sources used by Life Graph
          forumPosts: [],
          forumReplies: [],
          water: { ...s.water, todayMl: 0, dailyLogs: {} },
          focusSessionLog: [],
          focusSessions: 0,
          healthRecords: s.healthRecords.filter((r) => r.type !== 'sleep'),
          todos: s.todos.filter((t) => !t.completed),
          conversations: s.conversations.map((c) => ({ ...c, messages: [] })),
          timelineEvents: [],
        })),

      sendText: (content, replyTo) =>
        set((s) => {
          const msg: TextMessage = {
            id: crypto.randomUUID(),
            sender: 'me',
            type: 'text',
            content,
            replyTo,
            time: new Date().toISOString(),
            status: 'sent',
            deliveryStatus: 'sent',
          };
          return appendToActive(s, msg, usageDelta(s.usage, 1, 'chat:send'));
        }),

      sendStructuredText: (content, payload, replyTo) => {
        const id = crypto.randomUUID();
        set((s) => {
          const msg: TextMessage = {
            id, sender: 'me', type: 'text', content, replyTo,
            interactive: payload.interactive, linkPreview: payload.linkPreview,
            time: new Date().toISOString(), status: 'sent', deliveryStatus: 'sent',
          };
          return appendToActive(s, msg, usageDelta(s.usage, 1, 'chat:send'));
        });
        return id;
      },

      sendImage: (assetId, fileType, opts) =>
        set((s) => {
          const msg: ImageMessage = {
            id: crypto.randomUUID(),
            sender: 'me',
            type: 'image',
            assetId,
            fileType,
            fileName: opts?.fileName,
            fileSize: opts?.fileSize,
            caption: opts?.caption,
            createdAt: new Date().toISOString(),
            time: new Date().toISOString(),
            status: 'sent',
            deliveryStatus: 'sent',
            ...activeGroupSenderMetadata(s),
          };
          return appendToActive(s, msg, usageDelta(s.usage, 1, 'chat:image'));
        }),

      sendFile: (assetId, fileName, fileSize, fileType) =>
        set((s) => {
          const msg: FileMessage = {
            id: crypto.randomUUID(),
            sender: 'me',
            type: 'file',
            assetId,
            fileName,
            fileSize,
            fileType,
            createdAt: new Date().toISOString(),
            time: new Date().toISOString(),
            status: 'sent',
            deliveryStatus: 'sent',
            ...activeGroupSenderMetadata(s),
          };
          return appendToActive(s, msg, usageDelta(s.usage, 1, 'chat:file'));
        }),

      addMemoryEntry: (entry) => {
        const id = crypto.randomUUID();
        set((s) => {
          const now = Date.now();
          const summary = generateMemorySummary(entry.scene);
          const category = detectMemoryCategory(entry.scene, entry.triggerText);
          const item: MemoryEntry = {
            ...entry,
            summary,
            category,
            id,
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('memory', 'memory_created', { route: '/memory', level: 'info', detail: summary });
          const tlEvent: TimelineEvent = {
            id: crypto.randomUUID(), type: 'memory', sourceType: 'memory', sourceId: item.id,
            date: toLocalDateString(new Date(now)), icon: '🧠', label: item.scene.slice(0, 20) || '記憶',
            detail: item.scene || item.bodyThoughts, subDetail: item.summary,
            color: 'var(--journal)', route: '/memory', createdAt: now,
          };
          const journalEntry = memoryToJournalEntry(item);
          return {
            memoryEntries: [item, ...s.memoryEntries],
            journalWorkspaceEntries: [
              journalEntry,
              ...(s.journalWorkspaceEntries || []).filter((journal) => journal.legacyId !== item.id),
            ],
            timelineEvents: [tlEvent, ...(s.timelineEvents || [])].slice(0, 500),
            ...usageDelta(s.usage, 1, 'memory:add'),
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        });
        return id;
      },

      addJournalWorkspaceEntry: (entry) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        set((state) => {
          const shouldCreateMemory = entry.kind === 'memory' || entry.aiAccess !== 'private';
          const memoryId = shouldCreateMemory ? `journal-memory-${id}` : undefined;
          const journalEntry: JournalEntry = {
            ...entry,
            id,
            createdAt: now,
            updatedAt: now,
            occurredOn: entry.occurredOn || toLocalDateString(new Date()),
            origin: entry.origin || 'user',
            legacyId: memoryId,
          };
          const memoryEntry = memoryId ? journalToMemoryEntry(journalEntry, memoryId) : undefined;
          const mentionNotifications = newMentionNotifications({ postId:id, sourceId:`post:${id}`, authorId:journalEntry.author === 'lunaris' ? 'lunaris' : 'user', content:journalEntry.content, mentions:journalEntry.mentions, existing:state.forumNotifications || [] });
          return {
            journalWorkspaceEntries: [journalEntry, ...(state.journalWorkspaceEntries || [])],
            memoryEntries: memoryEntry ? [memoryEntry, ...(state.memoryEntries || [])] : state.memoryEntries,
            forumNotifications: [...mentionNotifications, ...(state.forumNotifications || [])].slice(0,50),
          };
        });
        return id;
      },

      updateJournalWorkspaceEntry: (id, patch) =>
        set((state) => {
          const current = (state.journalWorkspaceEntries || []).find((entry) => entry.id === id);
          if (!current) return {};
          const next: JournalEntry = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
          const generatedMemoryId = `journal-memory-${id}`;
          const linkedMemory = state.memoryEntries.find((memory) => memory.id === current.legacyId || memory.id === generatedMemoryId);
          const shouldHaveMemory = next.kind === 'memory' || next.aiAccess !== 'private';
          let memoryEntries = state.memoryEntries;
          if (shouldHaveMemory) {
            const memoryId = linkedMemory?.id || generatedMemoryId;
            const normalized = journalToMemoryEntry(next, memoryId);
            memoryEntries = linkedMemory
              ? state.memoryEntries.map((memory) => memory.id === linkedMemory.id ? normalized : memory)
              : [normalized, ...state.memoryEntries];
          } else if (linkedMemory && linkedMemory.id === generatedMemoryId) {
            memoryEntries = state.memoryEntries.filter((memory) => memory.id !== generatedMemoryId);
          } else if (linkedMemory) {
            memoryEntries = state.memoryEntries.map((memory) => memory.id === linkedMemory.id
              ? { ...memory, allowAiRecall: false, updatedAt: Date.now() }
              : memory);
          }
          const diaryEntries = current.legacyId
            ? state.diaryEntries.map((entry) => entry.id === current.legacyId
                ? { ...entry, title: next.title || '', content: next.content, updatedAt: Date.now() }
                : entry)
            : state.diaryEntries;
          const mentionNotifications = newMentionNotifications({ postId:id, sourceId:`post:${id}`, authorId:next.author === 'lunaris' ? 'lunaris' : 'user', content:next.content, mentions:next.mentions, previous:current.mentions, existing:state.forumNotifications || [] });
          return {
            journalWorkspaceEntries: state.journalWorkspaceEntries.map((entry) => entry.id === id ? next : entry),
            memoryEntries,
            diaryEntries,
            forumNotifications: [...mentionNotifications, ...(state.forumNotifications || [])].slice(0,50),
          };
        }),

      setPrimaryPinnedJournalEntry: (id) =>
        set((state) => {
          const now = Date.now();
          return {
            journalWorkspaceEntries: state.journalWorkspaceEntries.map((entry) => {
              const selected = id !== null && entry.id === id;
              if (selected) return { ...entry, pinned: true, pinnedAt: now, updatedAt: new Date(now).toISOString() };
              if (entry.pinned || entry.pinnedAt) return { ...entry, pinned: false, pinnedAt: null };
              return entry;
            }),
          };
        }),

      addJournalComment: (postId, input) => {
        const content = input.content.trim();
        if (!content) return null;
        const id = crypto.randomUUID();
        const now = Date.now();
        let added = false;
        set((state) => {
          const journalWorkspaceEntries = state.journalWorkspaceEntries.map((entry) => {
            if (entry.id !== postId || entry.commentsLockedAt) return entry;
            const comments = entry.comments ?? [];
            const parent = input.parentId ? comments.find((comment) => comment.id === input.parentId) : undefined;
            const rootCommentId = parent ? (parent.rootCommentId ?? parent.id) : undefined;
            added = true;
            return { ...entry, comments:[...comments, { id, postId, parentId:parent?.id, rootCommentId, authorId:input.authorId ?? 'user', content, createdAt:now, votes:[], quote: input.quote ?? undefined, mentions:input.mentions }], lastActivityAt:now, updatedAt:new Date(now).toISOString() };
          });
          const mentionNotifications = added ? newMentionNotifications({ postId, sourceId:id, authorId:input.authorId ?? 'user', content, mentions:input.mentions, existing:state.forumNotifications || [] }) : [];
          return { journalWorkspaceEntries, forumNotifications:[...mentionNotifications, ...(state.forumNotifications || [])].slice(0,50) };
        });
        return added ? id : null;
      },

      updateJournalComment: (postId, commentId, content, mentions) => set((state) => {
        const value = content.trim();
        if (!value) return {};
        const now = Date.now();
        const currentComment = state.journalWorkspaceEntries.find((entry) => entry.id === postId)?.comments?.find((comment) => comment.id === commentId);
        const mentionNotifications = currentComment ? newMentionNotifications({ postId, sourceId:commentId, authorId:currentComment.authorId, content:value, mentions, previous:currentComment.mentions, existing:state.forumNotifications || [] }) : [];
        return { journalWorkspaceEntries:state.journalWorkspaceEntries.map((entry) => entry.id === postId ? { ...entry, comments:(entry.comments ?? []).map((comment) => comment.id === commentId && comment.authorId === 'user' && !comment.deletedAt ? { ...comment, content:value, mentions, updatedAt:now } : comment), lastActivityAt:now, updatedAt:new Date(now).toISOString() } : entry), forumNotifications:[...mentionNotifications, ...(state.forumNotifications || [])].slice(0,50) };
      }),

      deleteJournalComment: (postId, commentId) => set((state) => {
        const now = Date.now();
        return { journalWorkspaceEntries:state.journalWorkspaceEntries.map((entry) => entry.id === postId ? { ...entry, comments:(entry.comments ?? []).map((comment) => comment.id === commentId && comment.authorId === 'user' ? { ...comment, deletedAt:now, content:'' } : comment), lastActivityAt:now, updatedAt:new Date(now).toISOString() } : entry) };
      }),

      setJournalCommentVote: (postId, commentId, actorId, value) => set((state) => ({ journalWorkspaceEntries:state.journalWorkspaceEntries.map((entry) => entry.id === postId ? { ...entry, comments:(entry.comments ?? []).map((comment) => {
        if (comment.id !== commentId) return comment;
        const votes = comment.votes.filter((vote) => vote.actorId !== actorId);
        if (value !== 0) votes.push({ actorId, value, updatedAt:Date.now() });
        return { ...comment, votes };
      }) } : entry) })),

      bumpJournalWorkspaceEntry: (id, requestedNow) => {
        const now = requestedNow ?? Date.now(); let bumped = false;
        set((state) => ({ journalWorkspaceEntries:state.journalWorkspaceEntries.map((entry) => {
          if (entry.id !== id || (entry.bumpedAt && now - entry.bumpedAt < 30 * 60_000)) return entry;
          bumped = true; return { ...entry, bumpedAt:now, lastActivityAt:now, updatedAt:new Date(now).toISOString() };
        }) }));
        return bumped;
      },

      setJournalCommentsLocked: (id, locked) => set((state) => ({ journalWorkspaceEntries:state.journalWorkspaceEntries.map((entry) => entry.id === id ? { ...entry, commentsLockedAt:locked ? Date.now() : null } : entry) })),

      viewJournalThread: (id) => set((state) => ({
        journalWorkspaceEntries: state.journalWorkspaceEntries.map((entry) =>
          entry.id === id ? { ...entry, viewCount: (entry.viewCount ?? 0) + 1 } : entry),
      })),

      toggleJournalSubscribe: (id) => set((state) => ({
        journalWorkspaceEntries: state.journalWorkspaceEntries.map((entry) =>
          entry.id === id ? { ...entry, subscribed: !(entry.subscribed ?? false) } : entry),
      })),

      deleteJournalWorkspaceEntry: (id) => {
        get().deleteJournalWorkspaceEntries([id]);
      },

      deleteJournalWorkspaceEntries: (ids) => {
        const requestedIds = new Set(ids.filter(Boolean));
        let deletedCount = 0;
        if (requestedIds.size === 0) return 0;
        const now = Date.now();
        set((state) => {
          const retention = state.cacheRetentionDays ?? 30;
          const purgeAt = now + retention * 24 * 60 * 60 * 1000;
          const removed = state.journalWorkspaceEntries.filter((entry) => requestedIds.has(entry.id));
          deletedCount = removed.length;
          if (deletedCount === 0) return {};
          return {
            journalWorkspaceEntries: state.journalWorkspaceEntries.map((entry) =>
              requestedIds.has(entry.id) ? { ...entry, deletedAt: now, purgeAt } : entry,
            ),
          };
        });
        return deletedCount;
      },

      restoreJournalEntries: (ids) => {
        const restoreSet = new Set(ids.filter(Boolean));
        if (restoreSet.size === 0) return 0;
        let count = 0;
        set((s) => ({
          journalWorkspaceEntries: s.journalWorkspaceEntries.map((entry) => {
            if (!restoreSet.has(entry.id)) return entry;
            count++;
            return { ...entry, deletedAt: undefined, purgeAt: undefined };
          }),
        }));
        return count;
      },

      permanentlyDeleteJournalEntries: (ids) => {
        const deleteSet = new Set(ids.filter(Boolean));
        if (deleteSet.size === 0) return 0;
        let count = 0;
        set((s) => {
          const remaining = s.journalWorkspaceEntries.filter((entry) => {
            if (!deleteSet.has(entry.id)) return true;
            count++;
            return false;
          });
          // Also clean up related memoryEntries and diaryEntries
          const legacyIds = new Set(
            s.journalWorkspaceEntries.filter((e) => deleteSet.has(e.id)).map((e) => e.legacyId).filter(Boolean),
          );
          const generatedMemoryIds = new Set(
            s.journalWorkspaceEntries.filter((e) => deleteSet.has(e.id)).map((e) => `journal-memory-${e.id}`),
          );
          return {
            journalWorkspaceEntries: remaining,
            memoryEntries: s.memoryEntries.filter((m) => !legacyIds.has(m.id) && !generatedMemoryIds.has(m.id)),
            diaryEntries: s.diaryEntries.filter((e) => !legacyIds.has(e.id)),
          };
        });
        return count;
      },

      clearJournalWorkspaceData: () => set({
        journalWorkspaceEntries: [],
        memoryEntries: [],
        diaryEntries: [],
      }),

      moveAllPrivateJournalEntriesToNormal: () => set((s) => ({
        journalWorkspaceEntries: s.journalWorkspaceEntries.map((entry) =>
          (entry.access ?? 'normal') === 'private'
            ? { ...entry, access: 'normal' as const, updatedAt: new Date().toISOString() }
            : entry
        ),
      })),

      addHealthRecord: (record) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => {
          const activityLog = makeActivityLog('health', '匯入睡眠記錄', { route: '/memory', level: 'info' });
          const tlEvent: TimelineEvent = {
            id: crypto.randomUUID(), type: 'sleep', sourceType: 'health', sourceId: id,
            date: record.date || toLocalDateString(new Date(now)), icon: '😴', label: '睡眠記錄',
            detail: record.sleepDurationMinutes ? `${Math.floor(record.sleepDurationMinutes / 60)}h${record.sleepDurationMinutes % 60}m` : '睡眠',
            color: 'var(--sleep-blue)', route: '/life-rhythm', createdAt: now,
          };
          return {
            healthRecords: [{ ...record, id, createdAt: now, updatedAt: now }, ...state.healthRecords],
            timelineEvents: [tlEvent, ...(state.timelineEvents || [])].slice(0, 500),
            activityLogs: [activityLog, ...(state.activityLogs || [])].slice(0, 200),
          };
        });
        return id;
      },

      sendVoice: (payload) => {
        const id = crypto.randomUUID();
        set((s) => {
          const metadata = activeGroupSenderMetadata(s);
          const message = {
            id,
            type: 'voice' as const,
            sender: metadata.sender || 'me',
            time: new Date().toISOString(),
            status: 'sent' as const,
            ...payload,
            ...metadata,
            deliveryStatus: 'sending' as const,
          };
          return appendToActive(s, message, {});
        });
        return id;
      },

      updateVoiceMessage: (id, patch) =>
        set((s) => patchInConversations(s, id, (m) => (m.type === 'voice' ? ({ ...m, ...patch } as Message) : m))),

      generateSleepReceipt: (date) => {
        const receiptDate = date || localDateString(Date.now());
        const sleepRecords = loadSleepRecords();
        const record = sleepRecords.find((r) => r.date === receiptDate);
        if (!record) return null;

        const now = Date.now();
        const stages = record.stages.reduce<Record<string, number>>(
          (t, s) => ({ ...t, [s.type]: t[s.type] + s.minutes }),
          { awake: 0, rem: 0, core: 0, deep: 0 },
        );
        const score = computeSleepScore(record.durationMinutes, stages.deep, stages.rem, stages.awake);
        const comment = computeLunarisComment(record.durationMinutes, stages.deep, stages.rem, stages.awake);

        const state = get();
        const existing = state.sleepReceipts.find((r) => r.date === receiptDate);
        const receiptId = existing?.id || crypto.randomUUID();
        set((current) => {
          const nextReceipt: SleepReceipt = {
            id: receiptId,
            type: 'sleep_receipt',
            date: receiptDate,
            totalSleep: record.durationMinutes,
            remMinutes: stages.rem,
            coreMinutes: stages.core,
            deepMinutes: stages.deep,
            awakeMinutes: stages.awake,
            sleepScore: score,
            lunarisComment: comment,
            viewed: existing?.viewed ?? false,
            memoryEntryId: existing?.memoryEntryId,
            savedToSecondBrainAt: existing?.savedToSecondBrainAt,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          };
          const memoryEntries = existing?.memoryEntryId
            ? current.memoryEntries.map((entry) => entry.id === existing.memoryEntryId
              ? {
                  ...entry,
                  scene: `Sleep Receipt · ${receiptDate}`,
                  bodyThoughts: sleepReceiptMemoryBody(nextReceipt),
                  summary: `Sleep ${record.durationMinutes}min · Score ${score}/100`,
                  updatedAt: now,
                }
              : entry)
            : current.memoryEntries;
          const activityLog = makeActivityLog('sleep', '生成睡眠收據', { route: '/life-rhythm', detail: receiptDate });
          const tlEvent: TimelineEvent = {
            id: crypto.randomUUID(), type: 'sleep_receipt', sourceType: 'sleep', sourceId: receiptId,
            date: receiptDate, icon: '😴', label: '睡眠收據',
            detail: `${Math.floor(record.durationMinutes / 60)}h${record.durationMinutes % 60}m · Score ${score}`,
            subDetail: `深${stages.deep}m REM${stages.rem}m 核${stages.core}m`,
            color: 'var(--sleep-blue)', route: '/life-rhythm', createdAt: now,
          };
          return {
            sleepReceipts: [nextReceipt, ...current.sleepReceipts.filter((r) => r.id !== receiptId)],
            memoryEntries,
            timelineEvents: [tlEvent, ...(current.timelineEvents || [])].slice(0, 500),
            activityLogs: [activityLog, ...(current.activityLogs || [])].slice(0, 200),
          };
        });
        return receiptId;
      },

      deleteSleepReceipt: (id) =>
        set((state) => {
          const receipt = state.sleepReceipts.find((item) => item.id === id);
          return {
            sleepReceipts: state.sleepReceipts.filter((item) => item.id !== id),
            memoryEntries: receipt?.memoryEntryId
              ? state.memoryEntries.filter((entry) => entry.id !== receipt.memoryEntryId)
              : state.memoryEntries,
            journalWorkspaceEntries: receipt?.memoryEntryId
              ? state.journalWorkspaceEntries.filter((entry) => entry.legacyId !== receipt.memoryEntryId)
              : state.journalWorkspaceEntries,
          };
        }),

      saveSleepReceiptToSecondBrain: (id) => {
        const receipt = get().sleepReceipts.find((item) => item.id === id);
        if (!receipt) return false;
        if (receipt.memoryEntryId && get().memoryEntries.some((entry) => entry.id === receipt.memoryEntryId)) return true;

        const now = Date.now();
        const memoryEntryId = crypto.randomUUID();
        set((state) => {
          const memoryEntry: MemoryEntry = {
            id: memoryEntryId,
            cardType: 'sleep_receipt',
            sleepReceiptId: receipt.id,
            scene: `Sleep Receipt · ${receipt.date}`,
            triggerText: 'sleep_receipt',
            bodyThoughts: sleepReceiptMemoryBody(receipt),
            anxietyLevel: 0,
            nextStep: '',
            summary: `Sleep ${receipt.totalSleep}min · Score ${receipt.sleepScore}/100`,
            category: 'system',
            tags: ['Sleep', 'sleep_receipt'],
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('memory', '睡眠收據已存入第二大腦', { route: '/memory', detail: receipt.date });
          return {
            memoryEntries: [memoryEntry, ...state.memoryEntries],
            journalWorkspaceEntries: [memoryToJournalEntry(memoryEntry), ...state.journalWorkspaceEntries],
            sleepReceipts: state.sleepReceipts.map((item) => item.id === id
              ? { ...item, memoryEntryId, savedToSecondBrainAt: now, updatedAt: now }
              : item),
            activityLogs: [activityLog, ...(state.activityLogs || [])].slice(0, 200),
          };
        });
        return true;
      },

      markSleepReceiptViewed: (id) =>
        set((state) => ({
          sleepReceipts: state.sleepReceipts.map((receipt) => receipt.id === id && !receipt.viewed
            ? { ...receipt, viewed: true, updatedAt: Date.now() }
            : receipt),
        })),

      addLocation: (location) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((s) => {
          const activityLog = makeActivityLog('memory', `新增地點：${location.name}`, { route: '/memory', level: 'info' });
          return {
            locations: [...s.locations, { ...location, id, createdAt: now, updatedAt: now }],
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        });
        return id;
      },

      deleteMemoryEntry: (id) =>
        set((s) => {
          const entry = s.memoryEntries.find((memory) => memory.id === id);
          return {
            memoryEntries: s.memoryEntries.filter((memory) => memory.id !== id),
            journalWorkspaceEntries: (s.journalWorkspaceEntries || []).filter((journal) => journal.legacyId !== id),
            sleepReceipts: entry?.cardType === 'sleep_receipt'
              ? s.sleepReceipts.map((receipt) => receipt.memoryEntryId === id
                ? { ...receipt, memoryEntryId: undefined, savedToSecondBrainAt: undefined, updatedAt: Date.now() }
                : receipt)
              : s.sleepReceipts,
            healthRecords: entry?.healthRecordId
              ? s.healthRecords.filter((record) => record.id !== entry.healthRecordId)
              : s.healthRecords,
          };
        }),

      updateMemoryEntry: (id, patch) =>
        set((s) => {
          const updatedAt = Date.now();
          const memoryEntries = s.memoryEntries.map((entry) =>
            entry.id === id ? { ...entry, ...patch, updatedAt } : entry
          );
          const updatedMemory = memoryEntries.find((entry) => entry.id === id);
          return {
            memoryEntries,
            journalWorkspaceEntries: updatedMemory
              ? (s.journalWorkspaceEntries || []).map((journal) => journal.legacyId === id
                  ? {
                      ...journal,
                      title: updatedMemory.title || updatedMemory.scene || journal.title,
                      content: updatedMemory.content || updatedMemory.bodyThoughts || updatedMemory.summary || journal.content,
                      moodId: updatedMemory.moodV4 || updatedMemory.mood || journal.moodId,
                      companionReactionId: updatedMemory.companionReactionId,
                      tags: updatedMemory.tags || journal.tags,
                      favorite: updatedMemory.favorite === true,
                      pinned: updatedMemory.pinned === true || updatedMemory.status === 'pinned',
                      archived: updatedMemory.status === 'archived' || updatedMemory.status === 'trash',
                      aiAccess: updatedMemory.allowAiRecall === true ? 'reference' : 'private',
                      lifecycle: updatedMemory.status === 'fading' ? 'fading' : updatedMemory.status === 'archived' || updatedMemory.status === 'trash' ? 'archived' : 'active',
                      updatedAt: new Date(updatedAt).toISOString(),
                    }
                  : journal)
              : s.journalWorkspaceEntries,
          };
        }),

      addDiaryEntry: (entry) =>
        set((s) => {
          const now = Date.now();
          const item: DiaryEntry = {
            ...entry,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          return {
            diaryEntries: [item, ...(s.diaryEntries || [])],
            journalWorkspaceEntries: [diaryToJournalEntry(item), ...(s.journalWorkspaceEntries || [])],
          };
        }),

      updateDiaryEntry: (id, patch) =>
        set((s) => {
          const updatedAt = Date.now();
          const diaryEntries = (s.diaryEntries || []).map((entry) =>
            entry.id === id ? { ...entry, ...patch, updatedAt } : entry
          );
          const updated = diaryEntries.find((entry) => entry.id === id);
          return {
            diaryEntries,
            journalWorkspaceEntries: updated
              ? s.journalWorkspaceEntries.map((entry) => entry.legacyId === id
                  ? { ...entry, title: updated.title, content: updated.content, updatedAt: new Date(updatedAt).toISOString() }
                  : entry)
              : s.journalWorkspaceEntries,
          };
        }),

      deleteDiaryEntry: (id) =>
        set((s) => ({
          diaryEntries: (s.diaryEntries || []).filter((e) => e.id !== id),
          journalWorkspaceEntries: (s.journalWorkspaceEntries || []).filter((entry) => entry.legacyId !== id),
        })),

      addForumPost: (post) =>
        set((s) => {
          const now = Date.now();
          const item: ForumPost = {
            ...post,
            likes: post.likes || [],
            bookmarks: post.bookmarks || [],
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('forum', '發了論壇帖文', { route: '/memory?tab=diary', level: 'info' });
          return {
            forumPosts: [item, ...(s.forumPosts || [])],
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      updateForumPost: (id, patch) =>
        set((s) => ({
          forumPosts: (s.forumPosts || []).map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
          ),
        })),

      toggleForumLike: (postId, username) =>
        set((s) => ({
          forumPosts: (s.forumPosts || []).map((p) => {
            if (p.id !== postId) return p;
            const likes = p.likes || [];
            const idx = likes.indexOf(username);
            const updated = idx === -1 ? [...likes, username] : likes.filter((n) => n !== username);
            return { ...p, likes: updated, updatedAt: Date.now() };
          }),
        })),

      toggleForumBookmark: (postId, username) =>
        set((s) => {
          const posts = (s.forumPosts || []);
          const post = posts.find((p) => p.id === postId);
          if (!post) return { forumPosts: posts };
          const bookmarks = post.bookmarks || [];
          const idx = bookmarks.indexOf(username);
          const isAdd = idx === -1;
          const updatedBookmarks = isAdd
            ? [...bookmarks, username]
            : bookmarks.filter((n) => n !== username);
          const updatedPosts = posts.map((p) =>
            p.id === postId ? { ...p, bookmarks: updatedBookmarks, updatedAt: Date.now() } : p,
          );

          const now = Date.now();
          const summary = `收錄論壇帖文：${(post.content || '').slice(0, 30)}…`;

          let updatedMemories = s.memoryEntries;
          let activityLog: ReturnType<typeof makeActivityLog> | null = null;

          if (isAdd) {
            // Create a forum_bookmark MemoryEntry
            const memoryItem: MemoryEntry = {
              id: crypto.randomUUID(),
              cardType: 'forum_bookmark',
              linkedForumPostId: post.id,
              linkedForumPostContent: post.content.slice(0, 200),
              scene: '收藏了論壇帖文',
              triggerText: post.content.slice(0, 100),
              bodyThoughts: post.content,
              anxietyLevel: 3,
              nextStep: '',
              summary,
              category: 'system',
              createdAt: now,
              updatedAt: now,
            };
            updatedMemories = [memoryItem, ...(s.memoryEntries || [])];
            activityLog = makeActivityLog('forum', t('forum.bookmarkAdded'), {
              route: '/memory?tab=bookmarks',
              detail: post.content.slice(0, 40),
              level: 'info',
            });
          } else {
            // Remove the linked MemoryEntry
            updatedMemories = (s.memoryEntries || []).filter(
              (m) => !(m.linkedForumPostId === postId && m.cardType === 'forum_bookmark'),
            );
            activityLog = makeActivityLog('forum', t('forum.bookmarkRemoved'), {
              level: 'info',
            });
          }

          return {
            forumPosts: updatedPosts,
            memoryEntries: updatedMemories,
            activityLogs: activityLog
              ? [activityLog, ...(s.activityLogs || [])].slice(0, 200)
              : s.activityLogs,
          };
        }),

      deleteForumPost: (id) =>
        set((s) => {
          const replyIds = new Set(
            (s.forumReplies || []).filter((r) => r.postId === id).map((r) => r.id),
          );
          return {
            forumPosts: (s.forumPosts || []).filter((p) => p.id !== id),
            forumReplies: (s.forumReplies || []).filter(
              (r) => r.postId !== id && !(r.parentReplyId && replyIds.has(r.parentReplyId)),
            ),
          };
        }),

      addForumReply: (reply) =>
        set((s) => {
          const now = Date.now();
          const item: ForumReply = {
            ...reply,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          const logs = [...(s.forumReplies || []), item];
          let activityLogs = s.activityLogs;
          let notifications = s.forumNotifications || [];

          if (reply.author === 'user') {
            activityLogs = [makeActivityLog('forum', '回覆了論壇帖文', { route: '/memory?tab=diary', level: 'info' }), ...(s.activityLogs || [])].slice(0, 200);

            // Generate notification for quoted reply
            if (reply.replyTo) {
              const notif: ForumNotification = {
                id: crypto.randomUUID(),
                type: 'quote',
                postId: reply.postId,
                replyId: item.id,
                fromAuthor: reply.author,
                contentPreview: reply.content.slice(0, 60),
                read: false,
                createdAt: now,
              };
              notifications = [notif, ...notifications].slice(0, 50);
            }

            // Generate notification for @mention
            const mentionMatch = reply.content.match(/@(\w+)/);
            if (mentionMatch) {
              const notif: ForumNotification = {
                id: crypto.randomUUID(),
                type: 'mention',
                postId: reply.postId,
                replyId: item.id,
                fromAuthor: reply.author,
                contentPreview: reply.content.slice(0, 60),
                read: false,
                createdAt: now,
              };
              notifications = [notif, ...notifications].slice(0, 50);
            }
          }

          if (reply.author === 'luna') {
            // Notify when Luna replies to user's post
            const repliedPost = s.forumPosts?.find((p) => p.id === reply.postId);
            if (repliedPost && repliedPost.author === 'user') {
              const notif: ForumNotification = {
                id: crypto.randomUUID(),
                type: 'reply',
                postId: reply.postId,
                replyId: item.id,
                fromAuthor: 'luna',
                contentPreview: reply.content.slice(0, 60),
                read: false,
                createdAt: now,
              };
              notifications = [notif, ...notifications].slice(0, 50);
            }
          }

          return { forumReplies: logs, activityLogs, forumNotifications: notifications };
        }),

      updateForumReply: (id, patch) =>
        set((s) => ({
          forumReplies: (s.forumReplies || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r
          ),
        })),

      deleteForumReply: (id) =>
        set((s) => {
          const childIds = new Set(
            (s.forumReplies || []).filter((r) => r.parentReplyId === id).map((r) => r.id),
          );
          return {
            forumReplies: (s.forumReplies || []).filter(
              (r) => r.id !== id && !childIds.has(r.id),
            ),
          };
        }),

      addForumNotification: (notification) =>
        set((s) => {
          const item: ForumNotification = {
            ...notification,
            id: crypto.randomUUID(),
            read: false,
            createdAt: Date.now(),
          };
          return {
            forumNotifications: [item, ...(s.forumNotifications || [])].slice(0, 50),
          };
        }),

      clearForumNotifications: () =>
        set({ forumNotifications: [] }),

      markForumNotificationRead: (id) =>
        set((s) => ({
          forumNotifications: (s.forumNotifications || []).map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      addTodo: (entry) =>
        set((s) => {
          const now = Date.now();
          const ticketNumber = Math.max(
            s.todoTicketSequence || 0,
            ...s.todos.map((todo) => todo.ticketNumber || 0),
          ) + 1;
          const item: TodoItem = {
            ...entry,
            id: crypto.randomUUID(),
            ticketNumber,
            dueDate: entry.dueDate || entry.date,
            dueTime: entry.dueTime || entry.time,
            reminderAt: entry.reminderAt || entry.remindAt,
            status: 'pending',
            completed: false,
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('todo', `新增待辦：${entry.title}`, { route: '/calendar', level: 'info' });
          return {
            todos: [item, ...s.todos],
            todoTicketSequence: ticketNumber,
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((todo) =>
            todo.id === id
              ? {
                  ...todo,
                  ...patch,
                  dueDate: patch.dueDate || patch.date || todo.dueDate || todo.date,
                  dueTime: patch.dueTime || patch.time || todo.dueTime || todo.time,
                  reminderAt: patch.reminderAt || patch.remindAt || todo.reminderAt || todo.remindAt,
                  updatedAt: Date.now(),
                }
              : todo
          ),
        })),

      toggleTodo: (id) =>
        set((s) => {
          const updated = s.todos.map((t) =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
          );
          const toggled = updated.find((t) => t.id === id);
          const activityLog = toggled
            ? makeActivityLog('todo', toggled.completed ? `完成待辦：${toggled.title}` : `取消完成待辦：${toggled.title}`, { route: '/calendar', level: toggled.completed ? 'success' : 'info' })
            : null;
          const result: Record<string, unknown> = { todos: updated };
          if (activityLog) {
            result.activityLogs = [activityLog, ...(s.activityLogs || [])].slice(0, 200);
          }
          if (toggled?.completed) {
            const now = Date.now();
            const tlEvent: TimelineEvent = {
              id: crypto.randomUUID(), type: 'todo', sourceType: 'todo', sourceId: toggled.id,
              date: toggled.date || toLocalDateString(new Date(now)), icon: '✅', label: toggled.title.slice(0, 20),
              detail: `完成待辦：${toggled.title}`,
              color: 'var(--success)', route: '/calendar', createdAt: now,
            };
            result.timelineEvents = [tlEvent, ...(s.timelineEvents || [])].slice(0, 500);
          }
          return result as { todos: typeof updated; activityLogs?: typeof s.activityLogs; timelineEvents?: typeof s.timelineEvents };
        }),

      deleteTodo: (id) =>
        set((s) => {
          const todo = s.todos.find((t) => t.id === id);
          const activityLog = todo
            ? makeActivityLog('todo', `刪除待辦：${todo.title}`, { level: 'warning' })
            : null;
          const result: Record<string, unknown> = { todos: s.todos.filter((t) => t.id !== id) };
          if (activityLog) {
            result.activityLogs = [activityLog, ...(s.activityLogs || [])].slice(0, 200);
          }
          return result as { todos: typeof s.todos; activityLogs?: typeof s.activityLogs };
        }),

      addCalendarEvent: (event) =>
        set((s) => {
          const now = new Date().toISOString();
          const id = crypto.randomUUID();
          const revision = Math.max(0, ...(s.calendarChanges || []).map((change) => change.revision)) + 1;
          return ({
          customEvents: [
            {
              ...event,
              id,
              author: event.author || 'user',
              precision: event.precision || (event.isAllDay ? 'day' : 'minute'),
              revision: 1,
              createdAt: event.createdAt || now,
              updatedAt: now,
            },
            ...(s.customEvents || []),
          ],
          calendarChanges: [...(s.calendarChanges || []), { id: revision, entityType: 'event', entityId: id, changedBy: 'user', changedAt: now, revision }],
          calendarDayRevisions: incrementCalendarDayRevisions(s, [event.date]),
          activityLogs: [
            makeActivityLog('system', `新增日程：${event.title}`, { route: '/calendar', level: 'info' }),
            ...(s.activityLogs || []),
          ].slice(0, 200),
        });
        }),

      updateCalendarEvent: (id, patch) =>
        set((s) => {
          const now = new Date().toISOString();
          const changeRevision = Math.max(0, ...(s.calendarChanges || []).map((change) => change.revision)) + 1;
          const previous = (s.customEvents || []).find((event) => event.id === id);
          return ({
          customEvents: (s.customEvents || []).map((event) =>
            event.id === id ? { ...event, ...patch, author: patch.author || 'user', revision: (event.revision || 1) + 1, updatedAt: now } : event
          ),
          calendarChanges: [...(s.calendarChanges || []), { id: changeRevision, entityType: 'event', entityId: id, changedBy: 'user', changedAt: now, revision: changeRevision }],
          calendarDayRevisions: incrementCalendarDayRevisions(s, [previous?.date || '', patch.date || previous?.date || '']),
        });
        }),

      deleteCalendarEvent: (id) =>
        set((s) => {
          const now = new Date().toISOString();
          const revision = Math.max(0, ...(s.calendarChanges || []).map((change) => change.revision)) + 1;
          const previous = (s.customEvents || []).find((event) => event.id === id);
          return {
            customEvents: (s.customEvents || []).map((event) => event.id === id ? { ...event, deletedAt: now, updatedAt: now, revision: (event.revision || 1) + 1 } : event),
            calendarChanges: [...(s.calendarChanges || []), { id: revision, entityType: 'event', entityId: id, changedBy: 'user', changedAt: now, revision }],
            calendarDayRevisions: incrementCalendarDayRevisions(s, [previous?.date || '']),
          };
        }),

      addCountdown: (entry) =>
        set((s) => {
          const now = Date.now();
          const item: CountdownItem = {
            ...entry,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          return { countdowns: [item, ...s.countdowns] };
        }),

      togglePinCountdown: (id) =>
        set((s) => ({
          countdowns: s.countdowns.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned, updatedAt: Date.now() } : c
          ),
        })),

      deleteCountdown: (id) =>
        set((s) => ({
          countdowns: s.countdowns.filter((c) => c.id !== id),
        })),

      addWater: (ml, date) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          const targetDate = date || today;
          const dailyLogs = { ...(s.water.dailyLogs || {}) };
          dailyLogs[targetDate] = (dailyLogs[targetDate] || 0) + ml;
          // Also update todayMl if for today (backward compat)
          const todayMl = targetDate === today
            ? (s.water.updatedDate !== today ? ml : s.water.todayMl + ml)
            : s.water.todayMl;
          return {
            water: {
              ...s.water,
              todayMl,
              updatedDate: targetDate === today ? today : s.water.updatedDate,
              dailyLogs,
            },
          };
        }),

      resetWaterIfNeeded: () =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          if (s.water.updatedDate !== today) {
            return {
              water: { ...s.water, todayMl: 0, updatedDate: today },
            };
          }
          return s;
        }),

      updateWaterSettings: (goalMl, cupMl) =>
        set((s) => ({
          water: { ...s.water, goalMl, cupMl },
        })),

      addUsagePoints: (pts) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          const wk = (() => {
            const n = new Date();
            const y = n.getFullYear();
            const j1 = new Date(y, 0, 1);
            const w = Math.ceil(((n.getTime() - j1.getTime()) / 86400000 + j1.getDay() + 1) / 7);
            return `${y}-W${String(w).padStart(2, '0')}`;
          })();

          const daily = s.usage.daily.date === today
            ? { date: today, points: s.usage.daily.points + pts }
            : { date: today, points: pts };

          const weekly = s.usage.weekly.weekKey === wk
            ? { weekKey: wk, points: s.usage.weekly.points + pts }
            : { weekKey: wk, points: pts };

          const logEntry = { id: crypto.randomUUID(), ts: Date.now(), points: pts, reason: 'manual' };
          const logs = [...(s.usage.logs || []), logEntry].slice(-100);
          return { usage: { daily, weekly, logs } };
        }),

      addFocusTime: (minutes: number) =>
        set((s) => ({
          focusMinutes: s.focusMinutes + minutes,
        })),

      incrementCompletedRounds: () =>
        set((s) => ({
          focusSessions: s.focusSessions + 1,
        })),

      resetFocusStats: () =>
        set((s) => ({
          focusMinutes: 0,
          focusSessions: 0,
          activityLogs: (s.activityLogs || []).filter(
            (log) => !(log.type === 'system' && (log.title.startsWith('專注完成') || log.title.startsWith('專注中止') || log.title.startsWith('創作完成') || log.title.startsWith('創作中止'))),
          ),
        })),

      updateFocusConfig: (config: Partial<FocusConfig>) =>
        set((s) => ({
          focusConfig: { ...s.focusConfig, ...config },
        })),

      addFocusSessionEntry: (entry: FocusSessionEntry) =>
        set((s) => ({
          focusSessionLog: [...(s.focusSessionLog || []), entry],
        })),

      addSticker: (name, url, assetId) =>
        set((s) => ({
          customStickers: [
            ...(s.customStickers || []),
            { id: crypto.randomUUID(), name: name.trim() || '', url: url.trim(), assetId, createdAt: Date.now() },
          ],
        })),

      deleteSticker: (id) => {
        const sticker = useAppStore.getState().customStickers?.find((st) => st.id === id);
        if (sticker?.assetId) {
          deleteAsset(sticker.assetId).catch(() => {});
        }
        set((s) => ({
          customStickers: (s.customStickers || []).filter((st) => st.id !== id),
        }));
      },

      createStickerPack: (name, owner) => {
        const id = crypto.randomUUID();
        set((s) => ({
          stickerPacks: [
            ...(s.stickerPacks || []),
            { id, name: name.trim() || '未命名', owner, stickers: [], createdAt: Date.now() },
          ],
        }));
        return id;
      },

      addStickerToPack: (packId, name, url, assetId, type) =>
        set((s) => ({
          stickerPacks: (s.stickerPacks || []).map((pack) =>
            pack.id === packId
              ? {
                  ...pack,
                  stickers: [
                    ...pack.stickers,
                    { id: crypto.randomUUID(), name: name.trim() || '', url: url.trim(), assetId, type, createdAt: Date.now() },
                  ],
                }
              : pack,
          ),
        })),

      deleteStickerFromPack: (packId, itemId) =>
        set((s) => ({
          stickerPacks: (s.stickerPacks || []).map((pack) =>
            pack.id === packId
              ? { ...pack, stickers: pack.stickers.filter((st) => st.id !== itemId) }
              : pack,
          ),
        })),

      deleteStickerPack: (packId) => {
        const pack = useAppStore.getState().stickerPacks?.find((p) => p.id === packId);
        if (pack) {
          for (const st of pack.stickers) {
            if (st.assetId) deleteAsset(st.assetId).catch(() => {});
          }
        }
        set((s) => ({
          stickerPacks: (s.stickerPacks || []).filter((p) => p.id !== packId),
        }));
      },

      deleteMessage: (id) =>
        set((s) => {
          const now = Date.now();
          const retention = s.cacheRetentionDays ?? 30;
          return patchInConversations(s, id, (m) => ({
            ...m,
            deletedAt: now,
            purgeAt: now + retention * 24 * 60 * 60 * 1000,
          }));
        }),

      deleteMessageForSelf: (id) =>
        set((s) => patchInConversations(s, id, (m) => ({
          ...m,
          deletedForSelfAt: Date.now(),
        }))),

      deleteMessageForAll: (id, identityId = 'local-user') =>
        set((s) => patchInConversations(s, id, (m) => ({
          ...m,
          deletedForAllAt: Date.now(),
          deletedByIdentityId: identityId,
        }))),

      restoreDeletedMessage: (convId, msgId) =>
        set((s) => {
          const conv = s.conversations.find((c) => c.id === convId);
          if (!conv) return {};
          return {
            conversations: s.conversations.map((c) => {
              if (c.id !== convId) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, deletedAt: undefined, purgeAt: undefined } : m,
                ),
              };
            }),
          };
        }),

      permanentlyDeleteMessage: (convId, msgId) =>
        set((s) => {
          const conv = s.conversations.find((c) => c.id === convId);
          if (!conv) return {};
          const msg = conv.messages.find((m) => m.id === msgId);
          if (msg) {
            if (msg.type === 'image' || msg.type === 'file') {
              deleteAsset((msg as any).assetId).catch(() => {});
            } else if (msg.type === 'voice') {
              if ((msg as any).audioAssetId) deleteAsset((msg as any).audioAssetId).catch(() => {});
            }
          }
          return {
            conversations: s.conversations.map((c) => {
              if (c.id !== convId) return c;
              return { ...c, messages: c.messages.filter((m) => m.id !== msgId) };
            }),
          };
        }),

      revokeMessage: (id) =>
        set((s) => {
          const activityLog = makeActivityLog('chat', '撤回了一則聊天訊息', { level: 'warning' });
          return {
            ...patchInConversations(s, id, (m) => ({
              ...m,
              revoked: true,
              revokedAt: new Date().toISOString(),
              originalType: m.type,
            })),
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      appendAssistantMessage: (message) =>
        set((s) => appendToActive(s, message, {})),

      appendAssistantMessages: (messages) =>
        set((s) => appendToActiveMessages(s, messages)),

      removeLastAssistantMessage: () =>
        set((s) => {
          const activeId = s.activeConversationId;
          if (!activeId) return {};
          const conv = s.conversations.find((c) => c.id === activeId);
          if (!conv) return {};
          const lastIdx = [...conv.messages].reverse().findIndex((m) => m.sender === 'assistant');
          if (lastIdx === -1) return {};
          const realIdx = conv.messages.length - 1 - lastIdx;
          const newMsgs = conv.messages.filter((_, i) => i !== realIdx);
          return {
            conversations: s.conversations.map((c) =>
              c.id === activeId ? { ...c, messages: newMsgs, updatedAt: Date.now() } : c,
            ),
            messages: (s.messages || []).filter((_, i) => i !== realIdx),
          };
        }),

      sendSticker: (opts) =>
        set((s) => {
          const { url, name, stickerId, source } = opts;
          // Builtin: resolve URL from manifest so legacy bubble still works
          let resolvedUrl = url || '';
          if (source === 'builtin' && stickerId) {
            resolvedUrl = lookupClawdSticker(stickerId)?.src ?? '';
          }
          const msg: StickerMessage = {
            id: crypto.randomUUID(),
            sender: 'me',
            type: 'sticker',
            stickerUrl: resolvedUrl || undefined,
            stickerName: name || undefined,
            stickerId: stickerId || undefined,
            source: source || (url ? 'user' : undefined),
            time: new Date().toISOString(),
            status: 'sent',
            deliveryStatus: 'sent',
            ...activeGroupSenderMetadata(s),
          };
          return appendToActive(s, msg, {});
        }),

      updateMessage: (id, patch) =>
        set((s) => patchInConversations(s, id, (m) => ({ ...m, ...patch } as Message))),

      pinMessage: (id) =>
        set((s) => patchInConversations(s, id, (m) => ({ ...m, pinned: true } as Message))),

      unpinMessage: (id) =>
        set((s) => patchInConversations(s, id, (m) => ({ ...m, pinned: false } as Message))),

      archiveMessage: (id) =>
        set((s) => patchInConversations(s, id, (m) => ({ ...m, archived: true } as Message))),

      restoreMessage: (id) =>
        set((s) => patchInConversations(s, id, (m) => ({ ...m, archived: false } as Message))),

      /* ── Message state machine ── */
      transitionMessageState: (id, targetState) =>
        set((s) =>
          patchInConversations(s, id, (m) => {
            const m2 = m as unknown as Record<string, unknown>;
            const current: string = (m2.messageState as string) || 'sent';
            const VALID_TRANSITIONS: Record<string, string[]> = {
              sent: ['consumedByAI'],
              consumedByAI: ['readByUser'],
              readByUser: ['expired'],
              expired: [],
            };
            if (!VALID_TRANSITIONS[current]?.includes(targetState)) return m;
            const now = Date.now();
            const patch: Record<string, unknown> = { messageState: targetState };
            if (targetState === 'consumedByAI') {
              patch.seenByAI = true;
            }
            if (targetState === 'readByUser') {
              patch.status = 'read';
              patch.readAt = now;
              patch.seenByUser = true;
              if (m2.ephemeral && !m2.expireAt) {
                patch.expireAt = now + 5000;
                _scheduleExpiry(id);
              }
            }
            return { ...m, ...patch } as Message;
          }),
        ),

      cleanupExpired: () =>
        set((s) => {
          const now = Date.now();
          let changed = false;
          const conversations = s.conversations.map((c) => {
            const before = c.messages.length;
            const filtered = c.messages.filter((m) => {
              const m2 = m as unknown as Record<string, unknown>;
              if (m2.messageState === 'expired') return false;
              if (m2.messageState === 'readByUser' && m2.ephemeral && m2.expireAt && now > (m2.expireAt as number)) return false;
              return true;
            });
            if (filtered.length !== before) changed = true;
            return filtered.length !== before ? { ...c, messages: filtered, updatedAt: Date.now() } : c;
          });
          if (!changed) return {};
          return {
            conversations,
            messages: (s.messages || []).filter((m) => {
              const m2 = m as unknown as Record<string, unknown>;
              if (m2.messageState === 'expired') return false;
              if (m2.messageState === 'readByUser' && m2.ephemeral && m2.expireAt && now > (m2.expireAt as number)) return false;
              return true;
            }),
          };
        }),

      // ── Conversation management ──

      createConversation: () => {
        const now = Date.now();
        const conv = createEmptyConversation(now);
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: conv.id,
        }));
        return conv.id;
      },

      createChatProject: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return '';
        const now = Date.now();
        const id = `chat-project-${crypto.randomUUID()}`;
        set((state) => ({ chatProjects: [{ id, name: trimmed, createdAt: now, updatedAt: now }, ...state.chatProjects] }));
        return id;
      },

      renameChatProject: (projectId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({ chatProjects: state.chatProjects.map((project) => project.id === projectId ? { ...project, name: trimmed, updatedAt: Date.now() } : project) }));
      },

      archiveChatProject: (projectId) =>
        set((state) => ({ chatProjects: state.chatProjects.map((project) => project.id === projectId ? { ...project, archived: !project.archived, updatedAt: Date.now() } : project) })),

      deleteChatProject: (projectId) =>
        set((state) => ({
          chatProjects: state.chatProjects.filter((project) => project.id !== projectId),
          conversations: state.conversations.map((conversation) => conversation.projectId === projectId ? { ...conversation, projectId: undefined } : conversation),
        })),

      assignConversationToProject: (conversationId, projectId) =>
        set((state) => {
          const validProjectId = projectId && state.chatProjects.some((project) => project.id === projectId) ? projectId : undefined;
          const now = Date.now();
          return {
            conversations: state.conversations.map((conversation) => conversation.id === conversationId ? { ...conversation, projectId: validProjectId } : conversation),
            chatProjects: validProjectId ? state.chatProjects.map((project) => project.id === validProjectId ? { ...project, updatedAt: now } : project) : state.chatProjects,
          };
        }),

      createConversationInProject: (projectId) => {
        const now = Date.now();
        const projectExists = get().chatProjects.some((project) => project.id === projectId);
        const conv = { ...createEmptyConversation(now), ...(projectExists ? { projectId } : {}) };
        set((state) => ({
          conversations: [conv, ...state.conversations],
          activeConversationId: conv.id,
          chatProjects: projectExists ? state.chatProjects.map((project) => project.id === projectId ? { ...project, updatedAt: now } : project) : state.chatProjects,
        }));
        return conv.id;
      },

      createGroupConversation: ({ title, avatarUrl, avatarAssetId, avatarCrop, participants, identityIds, groupParticipants: inputGroupParticipants, defaultSpeakerIdentityId, muted = false, statusConfig, manualSpeakerSwitchingEnabled = true }) => {
        const now = Date.now();
        const id = crypto.randomUUID();
        let normalizedParticipants: ChatParticipant[] = [];
        let groupParticipants: GroupParticipant[] | undefined;

        if (identityIds) {
          const uniqueIdentityIds = [...new Set(identityIds)].slice(0, 12);
          if (uniqueIdentityIds.length < 2) return '';
          const identities = useIdentityStore.getState().identities;
          groupParticipants = (inputGroupParticipants || uniqueIdentityIds.map((identityId, idx) => {
            const identity = identities.find((i) => i.id === identityId);
            return {
              identityId,
              replyPolicy: 'mention' as GroupReplyPolicy,
              aiParticipationMode: (identity?.kind === 'ai' ? 'mention-only' : 'off') as GroupAiParticipationMode,
              role: (identity?.kind === 'user' ? 'admin' : 'member') as 'admin' | 'member',
              order: idx,
              joinedAt: now,
            };
          })).filter((participant) => uniqueIdentityIds.includes(participant.identityId)).slice(0, 12);
          normalizedParticipants = uniqueIdentityIds.map((identityId) => {
            const identity = identities.find((i) => i.id === identityId);
            const isSelf = identityId === 'self' || identity?.kind === 'user';
            const displayName = identityId === 'self' ? (get().profile.displayName || get().userName || '我') : identity?.displayName || identityId;
            return {
              id: identityId,
              name: displayName,
              avatarInitial: displayName.charAt(0),
              avatarColor: isSelf ? 'user' : identity?.kind === 'silent' ? 'lavender' : 'char',
              controlMode: isSelf ? 'user' : 'auto',
              isSelf,
            };
          });
        } else if (participants) {
          normalizedParticipants = participants.map((participant) => ({
            ...participant,
            controlMode: participant.controlMode || (participant.isSelf ? 'user' : 'auto'),
          }));
        }

        const candidate: Conversation = {
          id,
          kind: 'group',
          type: 'group',
          title: title.trim() || '新群聊',
          avatarUrl,
          avatarAssetId,
          avatarCrop,
          messages: [],
          participants: normalizedParticipants,
          participantIds: normalizedParticipants.map((participant) => participant.id),
          ...(groupParticipants ? { groupParticipants } : {}),
          replyPolicy: 'mention',
          muted,
          statusConfig,
          manualSpeakerSwitchingEnabled,
          savedToContacts: true,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          autoTitle: false,
        };
        const initialSpeaker = resolveSafeGroupSpeaker(candidate, useIdentityStore.getState().identities, defaultSpeakerIdentityId);
        const conversation: Conversation = { ...candidate, currentSpeakerParticipantId: initialSpeaker?.identityId };
        set((state) => ({
          conversations: [conversation, ...(state.conversations || [])],
          activeConversationId: id,
        }));
        normalizedParticipants.forEach((participant) => {
          usePresenceStore.getState().setTemporaryPresence(participant.id, 'online');
        });
        return id;
      },

      updateGroupConversation: (id, patch) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === id && conversation.kind === 'group'
              ? { ...conversation, ...patch, updatedAt: Date.now() }
              : conversation,
          ),
        })),

      updateGroupParticipant: (conversationId, participantId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId && conversation.kind === 'group'
              ? {
                  ...conversation,
                  participants: (conversation.participants || []).map((participant) =>
                    participant.id === participantId ? { ...participant, ...patch } : participant,
                  ),
                  groupParticipants: conversation.groupParticipants
                    ? conversation.groupParticipants.map((gp) =>
                        gp.identityId === participantId
                          ? { ...gp, ...(patch.controlMode ? { replyPolicy: patch.controlMode === 'paused' ? 'mention' as GroupReplyPolicy : 'smart' as GroupReplyPolicy } : {}) }
                          : gp
                      )
                    : undefined,
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
        })),

      updateGroupParticipantReplyPolicy: (conversationId, participantId, replyPolicy) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId && conversation.kind === 'group'
              ? {
                  ...conversation,
                  groupParticipants: conversation.groupParticipants?.map((participant) =>
                    participant.identityId === participantId
                      ? { ...participant, replyPolicy, aiParticipationMode: replyPolicy === 'director' ? 'off' : replyPolicy === 'mention' ? 'mention-only' : 'automatic' }
                      : participant,
                  ),
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
        })),

      updateGroupParticipantMeta: (conversationId, participantId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId && conversation.kind === 'group'
              ? {
                  ...conversation,
                  groupParticipants: conversation.groupParticipants?.map((participant) =>
                    participant.identityId === participantId ? { ...participant, ...patch } : participant,
                  ).sort((a, b) => a.order - b.order),
                  updatedAt: Date.now(),
                }
              : conversation,
          ),
        })),

      addGroupParticipant: (conversationId, participant) => {
        let joined = false;
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            if ((conversation.participants || []).some((item) => item.id === participant.id) || (conversation.participants || []).length >= 12) return conversation;
            const participants = [...(conversation.participants || []), participant];
            const groupParticipants = (conversation.groupParticipants ?? (conversation.participants || []).map((item, order) => ({
              identityId: item.id,
              replyPolicy: 'mention' as GroupReplyPolicy,
              role: (item.isSelf ? 'admin' : 'member') as 'admin' | 'member',
              order,
              joinedAt: conversation.createdAt,
            })));
            if (groupParticipants.some((gp) => gp.identityId === participant.id)) return conversation;
            const nextGroupParticipants = [...groupParticipants, {
              identityId: participant.id,
              replyPolicy: 'mention' as GroupReplyPolicy,
              role: 'member' as 'admin' | 'member',
              order: groupParticipants.length,
              joinedAt: Date.now(),
            }];
            joined = true;
            return {
              ...conversation,
              participants,
              participantIds: participants.map((item) => item.id),
              groupParticipants: nextGroupParticipants,
              updatedAt: Date.now(),
            };
          }),
        }));
        return joined;
      },

      removeGroupParticipant: (conversationId, participantId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            const target = (conversation.participants || []).find((item) => item.id === participantId);
            if (target?.isSelf) return conversation;
            const participants = (conversation.participants || []).filter((item) => item.id !== participantId);
            const groupParticipants = conversation.groupParticipants
              ? conversation.groupParticipants.filter((gp) => gp.identityId !== participantId)
              : undefined;
            const groupRelationships = (conversation.groupRelationships || [])
              .filter((r) => r.fromParticipantId !== participantId && r.toParticipantId !== participantId);
            const nextConversation: Conversation = {
              ...conversation,
              participants,
              participantIds: participants.map((item) => item.id),
              groupParticipants,
              groupRelationships,
              updatedAt: Date.now(),
            };
            const nextSpeaker = resolveSafeGroupSpeaker(nextConversation, useIdentityStore.getState().identities);
            const nextPerspective = resolveConversationPerspective(nextConversation, useIdentityStore.getState().identities);
            return { ...nextConversation, currentSpeakerParticipantId: nextSpeaker?.identityId, currentPerspectiveParticipantId: nextPerspective?.identityId };
          }),
        })),

      addGroupRelationship: (conversationId, fromParticipantId, toParticipantId, kind, customLabel, note) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            const existing = (conversation.groupRelationships || [])
              .find((r) => r.fromParticipantId === fromParticipantId && r.toParticipantId === toParticipantId);
            if (existing) return conversation;
            const now = Date.now();
            const relationship: GroupRelationship = {
              id: `rel-${crypto.randomUUID()}`,
              fromParticipantId,
              toParticipantId,
              kind,
              customLabel: customLabel?.trim() || undefined,
              note: note?.trim() || undefined,
              createdAt: now,
              updatedAt: now,
            };
            return { ...conversation, groupRelationships: [...(conversation.groupRelationships || []), relationship], updatedAt: now };
          }),
        })),

      updateGroupRelationship: (conversationId, relationshipId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            const now = Date.now();
            return {
              ...conversation,
              groupRelationships: (conversation.groupRelationships || []).map((r) => {
                if (r.id !== relationshipId) return r;
                const next = { ...r, kind: patch.kind ?? r.kind, updatedAt: now };
                if ('customLabel' in patch) next.customLabel = patch.customLabel?.trim() || undefined;
                if ('note' in patch) next.note = patch.note?.trim() || undefined;
                return next;
              }),
              updatedAt: now,
            };
          }),
        })),

      removeGroupRelationship: (conversationId, relationshipId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            return {
              ...conversation,
              groupRelationships: (conversation.groupRelationships || []).filter((r) => r.id !== relationshipId),
              updatedAt: Date.now(),
            };
          }),
        })),

      setCurrentSpeaker: (conversationId, participantId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId && conversation.kind === 'group'
              && conversation.manualSpeakerSwitchingEnabled !== false
              && getEffectiveGroupParticipant(conversation, useIdentityStore.getState().identities, participantId)?.allowManualSpeaking
              ? { ...conversation, currentSpeakerParticipantId: participantId, updatedAt: Date.now() }
              : conversation,
          ),
        })),

      setConversationPerspective: (conversationId, participantId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId || conversation.kind !== 'group') return conversation;
            const resolved = resolveConversationPerspective(
              { ...conversation, currentPerspectiveParticipantId: participantId },
              useIdentityStore.getState().identities,
            );
            return resolved?.identityId === participantId
              ? { ...conversation, currentPerspectiveParticipantId: participantId, updatedAt: Date.now() }
              : conversation;
          }),
        })),

      sendGroupText: (content, senderParticipantId, controlSource, replyTo, roundId) => {
        const id = crypto.randomUUID();
        const conversation = get().conversations.find((item) => item.id === get().activeConversationId);
        const identities = useIdentityStore.getState().identities;
        const effectiveParticipant = getEffectiveGroupParticipant(conversation, identities, senderParticipantId);
        const participant = effectiveParticipant?.legacyParticipant;
        const isNarrator = senderParticipantId === 'narrator';
        let senderSnapshot: SenderSnapshot | undefined;

        if (conversation?.groupParticipants || isNarrator) {
          senderSnapshot = resolveSenderSnapshot(conversation, effectiveParticipant?.identity, senderParticipantId);
        }

        const message: TextMessage = {
          id,
          sender: effectiveParticipant?.isSelf ? 'me' : 'assistant',
          type: 'text',
          content,
          time: new Date().toISOString(),
          status: 'sent',
          deliveryStatus: controlSource === 'user' ? 'sending' : 'read',
          senderParticipantId,
          senderDisplayNameSnapshot: senderSnapshot?.displayName || effectiveParticipant?.displayName || participant?.groupNickname || participant?.name || (isNarrator ? '旁白' : '未知成員'),
          senderAvatarSnapshot: senderSnapshot?.legacyAvatarUrl || participant?.avatarUrl || participant?.avatarInitial || (isNarrator ? 'N' : '?'),
          ...(senderSnapshot ? { senderSnapshot } : {}),
          controlSource,
          roundId: roundId || crypto.randomUUID(),
          readByParticipantIds: participant?.isSelf ? [senderParticipantId] : [],
          replyTo,
        };
        set((state) => appendToActive(state, message, {}));
        return id;
      },

      setMessageDeliveryStatus: (id, deliveryStatus, readByParticipantIds) =>
        set((state) =>
          patchInConversations(state, id, (message) => ({
            ...message,
            deliveryStatus,
            status: deliveryStatus === 'read' ? 'read' : deliveryStatus === 'delivered' ? 'delivered' : 'sent',
            readByParticipantIds: readByParticipantIds ?? message.readByParticipantIds,
          })),
        ),

      retryMessageDelivery: (id) => {
        set((state) => patchInConversations(state, id, (message) =>
          message.deliveryStatus === 'failed'
            ? { ...message, deliveryStatus: 'sending', status: 'sent' }
            : message,
        ));
        queueMicrotask(() => {
          set((state) => patchInConversations(state, id, (message) =>
            message.deliveryStatus === 'sending'
              ? { ...message, deliveryStatus: 'sent', status: 'sent' }
              : message,
          ));
        });
      },

      deleteConversation: (id) =>
        set((s) => {
          const now = Date.now();
          const retention = s.cacheRetentionDays ?? 30;
          const updated = s.conversations.map((c) =>
            c.id === id ? { ...c, deletedAt: now, purgeAt: now + retention * 24 * 60 * 60 * 1000 } : c,
          );
          const hasConv = s.conversations.some((c) => c.id === id);
          if (!hasConv) return {};
          const nextActive = s.activeConversationId === id
            ? updated.find((c) => !c.deletedAt && !c.archived)?.id ?? updated.find((c) => !c.deletedAt)?.id ?? null
            : s.activeConversationId;
          return { conversations: updated, activeConversationId: nextActive };
        }),

      deleteConversations: (ids) => {
        const existingIds = new Set(get().conversations.map((c) => c.id));
        const deleteSet = new Set(ids.filter((id) => existingIds.has(id)));
        if (deleteSet.size === 0) return 0;
        const now = Date.now();
        set((s) => {
          const retention = s.cacheRetentionDays ?? 30;
          const updated = s.conversations.map((c) =>
            deleteSet.has(c.id) ? { ...c, deletedAt: now, purgeAt: now + retention * 24 * 60 * 60 * 1000 } : c,
          );
          const activeStillExists = Boolean(
            s.activeConversationId && updated.some((c) => c.id === s.activeConversationId && !c.deletedAt),
          );
          const nextActive = activeStillExists
            ? s.activeConversationId
            : updated.find((c) => !c.deletedAt && !c.archived)?.id ?? updated.find((c) => !c.deletedAt)?.id ?? null;
          return { conversations: updated, activeConversationId: nextActive };
        });
        return deleteSet.size;
      },

      restoreConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, deletedAt: undefined, purgeAt: undefined } : c,
          ),
        })),

      permanentlyDeleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          ...(s.activeConversationId === id
            ? { activeConversationId: s.conversations.find((c) => c.id !== id && !c.deletedAt)?.id ?? null }
            : {}),
        })),

      permanentlyDeleteConversations: (ids) => {
        const deleteSet = new Set(ids);
        set((s) => ({
          conversations: s.conversations.filter((c) => !deleteSet.has(c.id)),
          activeConversationId: deleteSet.has(s.activeConversationId ?? '')
            ? s.conversations.find((c) => !deleteSet.has(c.id) && !c.deletedAt)?.id ?? null
            : s.activeConversationId,
        }));
      },

      getRecentlyDeletedConversations: () =>
        get().conversations.filter((c) => !!c.deletedAt),

      getRecentlyDeletedJournalEntries: () =>
        get().journalWorkspaceEntries.filter((e) => !!e.deletedAt),

      cleanupExpiredDeleted: () => {
        const now = Date.now();
        set((s) => {
          const expiredConvIds = new Set(
            s.conversations.filter((c) => c.purgeAt && c.purgeAt <= now).map((c) => c.id),
          );
          const expiredJournalIds = new Set(
            s.journalWorkspaceEntries.filter((e) => e.purgeAt && e.purgeAt <= now).map((e) => e.id),
          );

          // Clean up orphaned IndexedDB assets from expired conversations
          for (const conv of s.conversations) {
            if (!expiredConvIds.has(conv.id)) continue;
            for (const msg of conv.messages) {
              if (msg.type === 'image' || msg.type === 'file') {
                deleteAsset((msg as any).assetId).catch(() => {});
              } else if (msg.type === 'voice') {
                if ((msg as any).audioAssetId) deleteAsset((msg as any).audioAssetId).catch(() => {});
              }
            }
          }

          return {
            conversations: s.conversations.filter((c) => !expiredConvIds.has(c.id)),
            journalWorkspaceEntries: s.journalWorkspaceEntries.filter((e) => !expiredJournalIds.has(e.id)),
            activeConversationId: expiredConvIds.has(s.activeConversationId ?? '')
              ? s.conversations.find((c) => !expiredConvIds.has(c.id) && !c.deletedAt)?.id ?? null
              : s.activeConversationId,
          };
        });
      },

      updateConversationsBatch: (ids, patch) => {
        const updateSet = new Set(ids);
        if (updateSet.size === 0) return 0;
        let count = 0;
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (!updateSet.has(conversation.id)) return conversation;
            count += 1;
            return { ...conversation, ...patch, updatedAt: Date.now() };
          }),
        }));
        return count;
      },

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, customTitle: title, autoTitle: false } : c,
          ),
        })),

      pinConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c,
          ),
        })),

      archiveConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, archived: !c.archived } : c,
          ),
        })),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      markConversationRead: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== id) return c;
            const updatedMsgs = c.messages.map((m) =>
              m.sender !== 'me' && m.status !== 'read' ? { ...m, status: 'read' as const } : m
            );
            return { ...c, messages: updatedMsgs, unread: 0, lastReadAt: new Date().toISOString() };
          }),
        })),

      clearConversationMessages: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c,
          ),
        })),

      getActiveMessages: (): Message[] => {
        const s = get();
        const conv = s.conversations.find((c) => c.id === s.activeConversationId);
        return (conv?.messages ?? s.messages ?? []).filter((message) =>
          !message.deletedAt && !message.deletedForSelfAt && !message.deletedForAllAt
        );
      },

      /* ── Read Receipts (local only) ── */

      markParticipantRead: (conversationId, participantId, lastReadMessageId) => {
        const now = Date.now();
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const cursors = { ...(c.participantReadCursors || {}) };
            const existing = cursors[participantId];
            if (existing && existing.lastReadMessageId === lastReadMessageId) return c;
            cursors[participantId] = { lastReadMessageId, lastReadAt: now };
            return { ...c, participantReadCursors: cursors };
          }),
        }));
      },

      isMessageReadByParticipant: (conversationId, messageId, participantId): boolean => {
        const s = get();
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (!conv) return false;
        const cursor = conv.participantReadCursors?.[participantId];
        if (!cursor) {
          const participant = conv.participants?.find((p) => p.id === participantId);
          if (participant?.lastReadMessageId) {
            const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
            const cursorIdx = conv.messages.findIndex((m) => m.id === participant.lastReadMessageId);
            return msgIdx >= 0 && cursorIdx >= 0 && msgIdx <= cursorIdx;
          }
          return false;
        }
        const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
        const cursorIdx = conv.messages.findIndex((m) => m.id === cursor.lastReadMessageId);
        return msgIdx >= 0 && cursorIdx >= 0 && msgIdx <= cursorIdx;
      },

      getOutgoingMessageReadSummary: (conversationId, messageId): { total: number; read: number } => {
        const s = get();
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (!conv || conv.kind !== 'group') return { total: 0, read: 0 };
        const msg = conv.messages.find((m) => m.id === messageId);
        if (!msg) return { total: 0, read: 0 };
        const participants = conv.participants || [];
        const msgIdx = conv.messages.findIndex((m) => m.id === messageId);
        let total = 0;
        let read = 0;
        for (const p of participants) {
          if (p.id === msg.senderParticipantId) continue;
          if (p.id === 'narrator') continue;
          total++;
          const cursor = conv.participantReadCursors?.[p.id]
            || (p.lastReadMessageId ? { lastReadMessageId: p.lastReadMessageId } : null);
          if (cursor) {
            const cursorIdx = conv.messages.findIndex((m) => m.id === cursor.lastReadMessageId);
            if (cursorIdx >= 0 && msgIdx <= cursorIdx) read++;
          }
        }
        return { total, read };
      },

      getMessageReadReceiptLabel: (conversationId, message): string | null => {
        const delivery = message.deliveryStatus;
        if (delivery === 'sending') return '傳送中';
        if (delivery === 'failed') return '傳送失敗';

        const isMe = message.sender === 'me';
        const isMyIdentity = Boolean(
          message.controlSource === 'user' &&
          message.senderParticipantId &&
          message.senderParticipantId !== 'narrator',
        );
        const isOutgoing = isMe || isMyIdentity;
        if (!isOutgoing) return null;

        const s = get();
        const conv = s.conversations.find((c) => c.id === conversationId);
        if (!conv) return '未讀';

        if (conv.kind === 'group') {
          const { total, read: readCount } = s.getOutgoingMessageReadSummary(conversationId, message.id);
          if (total === 0) return '未讀';
          if (readCount === 0) return '未讀';
          if (readCount >= total) return '全部已讀';
          return `已讀 ${readCount}/${total}`;
        }

        // Direct chat
        const directRecipientKey = 'luna';
        const cursor = conv.participantReadCursors?.[directRecipientKey];
        if (!cursor) return '未讀';

        const msgIdx = conv.messages.findIndex((m) => m.id === message.id);
        const cursorIdx = conv.messages.findIndex((m) => m.id === cursor.lastReadMessageId);
        if (msgIdx >= 0 && cursorIdx >= 0 && msgIdx <= cursorIdx) return '已讀';
        return '未讀';
      },


      addMusicTrack: (assetId, fileName, fileSize, fileType) =>
        set((s) => {
          const track: MusicTrack = {
            id: crypto.randomUUID(),
            title: fileName.replace(/\.[^.]+$/, ''),
            fileName,
            fileSize,
            fileType,
            assetId,
            createdAt: Date.now(),
          };
          const activityLog = makeActivityLog('music', `播放音樂：${track.title}`, { route: '/music', level: 'info' });
          return {
            music: { ...s.music, tracks: [...s.music.tracks, track] },
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      deleteMusicTrack: (id) => {
        const state = useAppStore.getState();
        const track = state.music.tracks.find((t) => t.id === id);
        if (track) {
          deleteAsset(track.assetId).catch(() => {});
        }
        set((s) => {
          const tracks = s.music.tracks.filter((t) => t.id !== id);
          const currentTrackId =
            s.music.currentTrackId === id ? undefined : s.music.currentTrackId;
          return { music: { ...s.music, tracks, currentTrackId } };
        });
      },

      setCurrentTrack: (id) =>
        set((s) => ({ music: { ...s.music, currentTrackId: id } })),

      setVolume: (volume) =>
        set((s) => ({ music: { ...s.music, volume: Math.max(0, Math.min(1, volume)) } })),

      toggleLoop: () =>
        set((s) => ({ music: { ...s.music, loop: !s.music.loop } })),

      setTrackDuration: (id, duration) =>
        set((s) => ({
          music: {
            ...s.music,
            tracks: s.music.tracks.map((t) =>
              t.id === id ? { ...t, duration } : t
            ),
          },
        })),

      sendAiMessage: async (content: string) => {
        const state = useAppStore.getState();
        if (state.aiTyping) return;

        // 1. Add user message to active conversation
        const userMsg: TextMessage = {
          id: crypto.randomUUID(),
          sender: 'me',
          type: 'text',
          content,
          time: new Date().toISOString(),
          status: 'sent',
        };
        set((s) => ({ ...appendToActive(s, userMsg, {}), aiTyping: true }));

        // 2. Retrieve memory context
        const mcEnabled = state.aiConfig.memoryContextEnabled !== false;
        let memoryContext = '';
        let retrievalResult: RetrievalResult = { entries: [], mode: 'skip' };
        if (mcEnabled) {
          const aiEligible = state.memoryEntries.filter(canMemoryEnterAiContext);
          retrievalResult = retrieveRelevantMemories({
            entries: aiEligible,
            currentMessage: content,
          });
          memoryContext = buildMemoryContext(retrievalResult.entries);
          console.debug('[AI] memory context', {
            enabled: true,
            mode: retrievalResult.mode,
            retrieved: retrievalResult.entries.length,
            totalEntries: aiEligible.length,
            chars: memoryContext.length,
          });
        } else {
          console.debug('[AI] memory context', { enabled: false });
        }
        const systemPrompt = buildSystemPrompt(state.aiConfig.systemPrompt, memoryContext);
        const chatMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
        ];
        const currentMessages = useAppStore.getState().getActiveMessages();
        for (const msg of currentMessages) {
          if (msg.type !== 'text') continue;
          if (msg.sender === 'me') {
            chatMessages.push({ role: 'user', content: msg.content });
          } else if (msg.sender === 'assistant') {
            chatMessages.push({ role: 'assistant', content: msg.content });
          }
        }

        // 3. Create placeholder assistant message
        const assistantId = crypto.randomUUID();
        const memoryUsed = retrievalResult.entries.length > 0;
        const assistantMsg: TextMessage = {
          id: assistantId,
          sender: 'assistant',
          type: 'text',
          content: '',
          time: new Date().toISOString(),
          status: 'sent',
          memoryContextUsed: memoryUsed,
          memoryContextMode: retrievalResult.mode,
          memoryContextCount: retrievalResult.entries.length,
        };
        set((s) => appendToActive(s, assistantMsg, {}));

        // 4. Start streaming
        const controller = new AbortController();
        _abortController = controller;

        try {
          const generator = sendChatMessage(
            chatMessages,
            {
              provider: state.aiConfig.provider,
              model: state.aiConfig.model,
              apiKey: state.aiConfig.apiKey,
              baseUrl: state.aiConfig.baseUrl,
              temperature: state.aiConfig.temperature,
              maxTokens: state.aiConfig.maxTokens,
              topP: state.aiConfig.topP,
              systemPrompt,
            },
            controller.signal,
          );

          let fullContent = '';
          for await (const chunk of generator) {
            fullContent += chunk.content;
            set((s) => patchInConversations(s, assistantId, (m) => ({ ...m, content: fullContent })));
          }
          if (!fullContent) {
            set((s) => patchInConversations(s, assistantId, (m) => ({ ...m, content: '沒有收到回覆' })));
          } else {
            // Successful AI reply: +2 usage
            set((s) => ({ ...usageDelta(s.usage, 2, 'ai:reply') }));

            // Attach sticker based on emotional context
            const sticker = selectStickerForResponse(fullContent);
            if (sticker) {
              set((s) => patchInConversations(s, assistantId, (m) => ({ ...m, stickerUrl: sticker.url, stickerName: sticker.name })));
            }
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // User aborted — partial content already saved
          } else {
            const message = err instanceof Error ? err.message : 'AI 請求失敗';
            useToastStore.getState().showToast(message);
            set((s) => patchInConversations(s, assistantId, (m) => ({ ...m, content: message })));
          }
        } finally {
          _abortController = null;
          set({ aiTyping: false });
        }
      },

      abortAiGeneration: () => {
        _abortController?.abort();
        _abortController = null;
      },

      addActivityLog: (entry) =>
        set((s) => ({
          activityLogs: [
            {
              ...entry,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
              read: false,
            },
            ...(s.activityLogs || []),
          ].slice(0, 200),
        })),

      markActivityRead: (id) =>
        set((s) => ({
          activityLogs: (s.activityLogs || []).map((log) =>
            log.id === id ? { ...log, read: true } : log,
          ),
        })),

      clearActivityLogs: () => set({ activityLogs: [] }),

      saveDailyTarot: (spread, cards) =>
        set((s) => {
          const today = new Date().toISOString().slice(0, 10);
          const entry = { date: today, spread, cards, createdAt: Date.now() };
          const activityLog = makeActivityLog('system', '今日塔羅已抽取', { detail: `${cards.length} 張牌`, level: 'info' });
          return {
            dailyTarot: entry,
            tarotHistory: [entry, ...(s.tarotHistory || [])].slice(0, 365),
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      resetDailyTarot: () =>
        set((s) => ({
          dailyTarot: { date: '', spread: 'single' as const, cards: [], createdAt: 0 },
          tarotHistory: (s.tarotHistory || []).filter((e) => e.date !== s.dailyTarot?.date),
        })),

      toggleTool: (toolId) =>
        set((s) => {
          const next = s.agentTools.map((t) =>
            t.id === toolId ? { ...t, enabled: !t.enabled } : t,
          );
          const tool = next.find((t) => t.id === toolId);
          const log = tool
            ? makeActivityLog('settings', `工具「${tool.name}」已${tool.enabled ? '啟用' : '停用'}`, { route: '/settings', level: 'info' })
            : null;
          saveTools(next);
          return {
            agentTools: next,
            ...(log ? { activityLogs: [log, ...(s.activityLogs || [])].slice(0, 200) } : {}),
          };
        }),

      addRewardRule: (rule) =>
        set((s) => {
          const now = Date.now();
          const item = {
            ...rule,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          const next = [...(s.rewardRules || []), item];
          saveRewardRules(next);
          return { rewardRules: next };
        }),

      updateRewardRule: (id, patch) =>
        set((s) => {
          const next = (s.rewardRules || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
          );
          saveRewardRules(next);
          return { rewardRules: next };
        }),

      deleteRewardRule: (id) =>
        set((s) => {
          const next = (s.rewardRules || []).filter((r) => r.id !== id);
          saveRewardRules(next);
          return { rewardRules: next };
        }),

      toggleRewardRule: (id) =>
        set((s) => {
          const next = (s.rewardRules || []).map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r,
          );
          saveRewardRules(next);
          return { rewardRules: next };
        }),

      addRuntimeLog: (log) =>
        set((s) => {
          const activityLog = log.source === 'moonread' && log.status === 'completed'
            ? makeActivityLog('chat', '月讀室 Luna 完成一次分析', { route: '/library', level: 'info' })
            : null;
          return {
            agentRuntimeLogs: [...(s.agentRuntimeLogs || []), log].slice(-200),
            ...(activityLog ? { activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200) } : {}),
          };
        }),

      addAiUsageLog: (entry) =>
        set((s) => {
          const date = entry.date || new Date(entry.createdAt).toISOString().slice(0, 10);
          const cutoff = Date.now() - 90 * 86400000;
          const prev = s.aiUsage.daily[date] || { requestCount: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0, totalTokens: 0, errorCount: 0, estimatedTokens: 0 };
          return {
            aiUsage: {
              daily: {
                ...s.aiUsage.daily,
                [date]: {
                  requestCount: prev.requestCount + 1,
                  inputTokens: prev.inputTokens + (entry.inputTokens || 0),
                  outputTokens: prev.outputTokens + (entry.outputTokens || 0),
                  cachedInputTokens: prev.cachedInputTokens + (entry.cachedInputTokens || 0),
                  reasoningTokens: prev.reasoningTokens + (entry.reasoningTokens || 0),
                  totalTokens: prev.totalTokens + (entry.totalTokens || 0),
                  errorCount: prev.errorCount + (entry.status === 'error' ? 1 : 0),
                  estimatedTokens: prev.estimatedTokens + (entry.estimatedTotalTokens || 0),
                },
              },
              logs: [...(s.aiUsage.logs || []).filter((log) => log.createdAt >= cutoff), entry],
            },
          };
        }),

      clearAiUsageLogs: () => set({ aiUsage: { daily: {}, logs: [] } }),

      addProvider: (provider) =>
        set((s) => {
          const next = [...(s.providers || []), provider];
          const log = makeActivityLog('settings', `Provider「${provider.name}」已新增`, { route: '/settings', level: 'success' });
          return {
            providers: next,
            activityLogs: [log, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      updateProvider: (id, patch) =>
        set((s) => ({
          providers: (s.providers || []).map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
          ),
        })),

      deleteProvider: (id) =>
        set((s) => ({
          providers: (s.providers || []).filter((p) => p.id !== id),
        })),

      setDefaultProvider: (id) =>
        set((s) => {
          const provider = (s.providers || []).find((p) => p.id === id);
          const log = provider
            ? makeActivityLog('settings', `Provider 已切換為 ${provider.name}`, { route: '/settings', level: 'info' })
            : null;
          return {
            providers: (s.providers || []).map((p) => ({
              ...p,
              isDefault: p.id === id,
              updatedAt: p.id === id ? Date.now() : p.updatedAt,
            })),
            ...(log ? { activityLogs: [log, ...(s.activityLogs || [])].slice(0, 200) } : {}),
          };
        }),

      setAiRole: (role, config) =>
        set((s) => ({
          aiRoles: {
            ...s.aiRoles,
            [role]: { ...s.aiRoles[role], ...config },
          },
        })),

      createMcp: (mcp) =>
        set((s) => {
          const log = makeActivityLog('settings', `外部服務「${mcp.name}」已新增`, { route: '/settings', level: 'success' });
          return {
            mcpConnections: [...(s.mcpConnections || []), mcp],
            activityLogs: [log, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      updateMcp: (id, patch) =>
        set((s) => ({
          mcpConnections: (s.mcpConnections || []).map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
          ),
        })),

      deleteMcp: (id) =>
        set((s) => ({
          mcpConnections: (s.mcpConnections || []).filter((c) => c.id !== id),
        })),

      toggleMcp: (id) =>
        set((s) => ({
          mcpConnections: (s.mcpConnections || []).map((c) =>
            c.id === id ? { ...c, enabled: !c.enabled, updatedAt: Date.now() } : c,
          ),
        })),

      addSubscription: (record) =>
        set((s) => {
          const newRecord = {
            ...record,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const activityLog = makeActivityLog('subscription', 'subscription_added', { route: '/subscriptions', level: 'info', detail: record.serviceName });
          return {
            subscriptions: [newRecord, ...(s.subscriptions || [])],
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: (s.subscriptions || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r
          ),
        })),

      deleteSubscription: (id) =>
        set((s) => ({
          subscriptions: (s.subscriptions || []).filter((r) => r.id !== id),
        })),

      generateSubscriptionEntry: (subscriptionId) => {
        const sub = get().subscriptions?.find((s) => s.id === subscriptionId);
        if (!sub) return null;
        const now = Date.now();
        const entryId = crypto.randomUUID();
        const subAmount = sub.amount ?? sub.price ?? 0;
        const mt: import('@/types').MoneyTransaction = {
          id: entryId,
          type: 'expense',
          amountMinor: Math.max(0, Math.round(subAmount * 100)),
          currency: sub.currency || 'TWD',
          accountId: sub.paymentSourceId || 'default',
          categoryId: '其他',
          source: 'manual',
          title: sub.name || sub.serviceName || '訂閱扣款',
          note: `訂閱：${sub.name || sub.serviceName || ''}`,
          occurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          moneyTransactions: [mt, ...(s.moneyTransactions || [])],
          subscriptions: (s.subscriptions || []).map((r) =>
            r.id === subscriptionId
              ? { ...r, nextBillingDate: advanceBillingDate(r), updatedAt: Date.now() }
              : r
          ),
        }));
        return entryId;
      },

      /* ── Ledger (compatibility adapter → moneyTransactions) ── */
      addLedgerEntry: (entry) => {
        const now = new Date().toISOString();
        const amountMinor = typeof entry.amount === 'number' && Number.isFinite(entry.amount)
          ? Math.max(0, Math.round(entry.amount * 100))
          : 0;
        const mt: import('@/types').MoneyTransaction = {
          id: crypto.randomUUID(),
          type: entry.type === 'income' ? 'income' : 'expense',
          amountMinor,
          currency: entry.currency || 'TWD',
          accountId: entry.paymentSourceId || 'default',
          categoryId: entry.category || '其他',
          source: entry.source === 'chat' ? 'chat' : 'manual',
          title: entry.title,
          note: entry.note,
          occurredAt: entry.date ? `${entry.date}T00:00:00` : now,
          createdAt: now,
        };
        set((s) => ({ moneyTransactions: [mt, ...(s.moneyTransactions || [])] }));
      },

      updateLedgerEntry: (id, patch) =>
        set((s) => ({
          moneyTransactions: (s.moneyTransactions || []).map((r) => {
            if (r.id !== id) return r;
            const updated: import('@/types').MoneyTransaction = { ...r, updatedAt: new Date().toISOString() };
            if (typeof patch.amount === 'number') updated.amountMinor = Math.max(0, Math.round(patch.amount * 100));
            if (typeof patch.currency === 'string') updated.currency = patch.currency;
            if (typeof patch.category === 'string') updated.categoryId = patch.category;
            if (typeof patch.title === 'string') updated.title = patch.title;
            if (typeof patch.note === 'string') updated.note = patch.note;
            if (typeof patch.type === 'string') updated.type = patch.type === 'income' ? 'income' : 'expense';
            if (typeof patch.source === 'string') updated.source = patch.source === 'chat' ? 'chat' : 'manual';
            if (typeof patch.paymentSourceId === 'string') updated.accountId = patch.paymentSourceId;
            if (typeof patch.date === 'string') updated.occurredAt = `${patch.date}T00:00:00`;
            return updated;
          }),
        })),

      deleteLedgerEntry: (id) =>
        set((s) => ({
          moneyTransactions: (s.moneyTransactions || []).filter((r) => r.id !== id),
        })),

      /* ── Dual Ledger (Moon Ledger Phase 1) ── */
      moneyTransactions: [] as import('@/types').MoneyTransaction[],
      addMoneyTransaction: (entry) =>
        set((s) => {
          const now = new Date().toISOString();
          const item: import('@/types').MoneyTransaction = {
            ...entry,
            id: crypto.randomUUID(),
            createdAt: now,
          };
          return { moneyTransactions: [item, ...(s.moneyTransactions || [])] };
        }),
      updateMoneyTransaction: (id, patch) =>
        set((s) => ({
          moneyTransactions: (s.moneyTransactions || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteMoneyTransaction: (id) =>
        set((s) => ({
          moneyTransactions: (s.moneyTransactions || []).filter((r) => r.id !== id),
        })),

      moonDewLedger: [] as import('@/types').MoonDewLedgerEntry[],
      addMoonDewEntry: (entry) => {
        const s = get();
        if (hasMoonDewKey(s.moonDewLedger || [], entry.idempotencyKey)) {
          return false;
        }
        const now = new Date().toISOString();
        const item: import('@/types').MoonDewLedgerEntry = { ...entry, id: crypto.randomUUID(), createdAt: now };
        set({ moonDewLedger: [item, ...(s.moonDewLedger || [])] });
        return true;
      },
      reverseMoonDewEntry: (entryId, reason) => {
        const s = get();
        const target = (s.moonDewLedger || []).find((e) => e.id === entryId);
        if (!target) return false;
        // Check if already reversed — look for an existing reversal entry pointing to this target
        const alreadyReversed = (s.moonDewLedger || []).some(
          (e) => e.source === 'reversal' && e.reversedEntryId === entryId,
        );
        if (alreadyReversed) return false;
        const reversal: import('@/types').MoonDewLedgerEntry = {
          id: crypto.randomUUID(),
          amount: -target.amount,
          source: 'reversal',
          reasonCode: 'reversal:manual',
          title: reason || '撤銷流水',
          idempotencyKey: `reversal:${target.id}`,
          relatedEntityId: target.id,
          reversedEntryId: target.id,
          createdAt: new Date().toISOString(),
        };
        set({
          moonDewLedger: [reversal, ...(s.moonDewLedger || [])],
        });
        return true;
      },
      getMoonDewBalance: () => {
        const s = get();
        let sum = 0;
        for (const entry of s.moonDewLedger || []) {
          sum += entry.amount;
        }
        return Math.max(0, sum);
      },
      ledgerDomain: 'money',
      setLedgerDomain: (domain) => set({ ledgerDomain: domain }),
      settleFocusForMoonDew: (opts) => {
        const s = get();
        const key = `focus:${opts.sessionId}:settlement`;
        if (hasMoonDewKey(s.moonDewLedger || [], key)) {
          return false;
        }
        const currentBalance = get().getMoonDewBalance();
        // Phase 1.1.2: Use source-filtered cap values (focus only)
        const todayEarned = todayEarnedBySource(s.moonDewLedger || [], CAP_RULES.earnCapSources);
        const todayLost = todayLostBySource(s.moonDewLedger || [], CAP_RULES.lossCapSources);
        const { entries } = settleFocusSession({ ...opts, currentBalance, todayEarned, todayLost });
        if (entries.length === 0) return false;
        let anyAdded = false;
        for (const entry of entries) {
          if (entry.amount === 0) continue;
          if (get().addMoonDewEntry(entry)) anyAdded = true;
        }
        return anyAdded;
      },
      /** LEGACY / FENCED (Phase A) — no active caller. Playroom awards must be re-specified before use. */
      grantPlayroomMoonDew: (opts) => {
        if (import.meta.env.DEV) {
          console.warn('[legacy] useAppStore.grantPlayroomMoonDew is fenced (Life Utility Phase A). No canonical call path is wired.');
        }
        const s = get();
        const key = `playroom:${opts.eventId}`;
        if (hasMoonDewKey(s.moonDewLedger || [], key)) {
          return false;
        }
        const todayPlayroom = (s.moonDewLedger || [])
          .filter((e) => e.createdAt.slice(0, 10) === toLocalDateString(new Date()) && e.source === 'playroom')
          .reduce((sum, e) => sum + Math.max(0, e.amount), 0);
        if (todayPlayroom + opts.amount > MOON_DEW_RULES.playroomDailyCap) {
          return false;
        }
        const entry = buildPlayroomMoonDewEntry(opts);
        return get().addMoonDewEntry(entry);
      },

      /* ── Payment Sources ── */
      addPaymentSource: (source) =>
        set((s) => ({
          paymentSources: [
            { ...source, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...(s.paymentSources || []),
          ],
        })),
      updatePaymentSource: (id, patch) =>
        set((s) => ({
          paymentSources: (s.paymentSources || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deletePaymentSource: (id) =>
        set((s) => ({
          paymentSources: (s.paymentSources || []).filter((r) => r.id !== id),
        })),

      /* ── Ledger Accounts ── */
      addLedgerAccount: (account) =>
        set((s) => ({
          ledgerAccounts: [
            { ...account, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...(s.ledgerAccounts || []),
          ],
        })),
      updateLedgerAccount: (id, patch) =>
        set((s) => ({
          ledgerAccounts: (s.ledgerAccounts || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteLedgerAccount: (id) =>
        set((s) => ({
          ledgerAccounts: (s.ledgerAccounts || []).filter((r) => r.id !== id),
        })),

      /* ── Ledger Budgets ── */
      addLedgerBudget: (budget) =>
        set((s) => ({
          ledgerBudgets: [
            { ...budget, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...(s.ledgerBudgets || []),
          ],
        })),
      updateLedgerBudget: (id, patch) =>
        set((s) => ({
          ledgerBudgets: (s.ledgerBudgets || []).map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteLedgerBudget: (id) =>
        set((s) => ({
          ledgerBudgets: (s.ledgerBudgets || []).filter((r) => r.id !== id),
        })),

      /* ── Tide Check-in (LEGACY / FENCED — Life Utility Phase A ownership closure) ──
         Canonical check-in, streak and status owner:
           src/features/tideclock/useCheckInStore.ts  (persist `lunartide-check-in` v1)
         The `tideCheckIn` slice below is a retired mirror with no active production
         caller. Daily Status reads the canonical streak from `useCheckInStore` —
         never `currentStreak` here.
         Do NOT re-wire these writers: the live daily path is `useCheckInStore.clockIn`
         → `addMoonDewEntry` (idempotency key `checkin:<date>:clock_in`), which awards
         月露 exactly once per day. The legacy grant below used key `checkin:<date>`
         (10–15 月露), which the dedupe guard would NOT catch — re-wiring it risks a
         double grant. See docs/reports/life-utility-phase-a-ownership-closure.md. */
      canCheckInToday: () => {
        const today = localDateString(Date.now());
        return !get().tideCheckIn?.checkIns?.some((item) => item.date === today);
      },

      getTodayCheckIn: () => {
        const today = localDateString(Date.now());
        return (get().tideCheckIn?.checkIns || []).find((item) => item.date === today);
      },

      getCurrentStreak: () => calculateCurrentStreakFrom(get().tideCheckIn?.checkIns || []),

      getTidePointBalance: () => {
        let sum = 0;
        for (const entry of get().moonDewLedger || []) {
          sum += entry.amount;
        }
        return Math.max(0, sum);
      },

      /** LEGACY / FENCED (Phase A) — no active caller. Canonical rewards: addMoonDewEntry. */
      addTidePoints: (amount, reason, source) => {
        if (import.meta.env.DEV) {
          console.warn('[legacy] useAppStore.addTidePoints is fenced (Life Utility Phase A). Canonical path: addMoonDewEntry.');
        }
        if (!Number.isFinite(amount) || amount <= 0) return;
        get().addMoonDewEntry({
          amount,
          source: source === 'checkin' || source === 'streak' ? 'daily_checkin' : source === 'gacha' ? 'playroom' : 'manual_adjustment',
          reasonCode: `legacy:${source}`,
          title: reason,
          idempotencyKey: `legacy-tide:${source}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        });
      },

      /** LEGACY / FENCED (Phase A) — no active caller. Canonical rewards: addMoonDewEntry. */
      spendTidePoints: (amount, reason, source) => {
        if (import.meta.env.DEV) {
          console.warn('[legacy] useAppStore.spendTidePoints is fenced (Life Utility Phase A). Canonical path: addMoonDewEntry.');
        }
        if (!Number.isFinite(amount) || amount <= 0) return false;
        const balance = get().getMoonDewBalance();
        if (balance < amount) return false;
        return get().addMoonDewEntry({
          amount: -amount,
          source: 'manual_adjustment',
          reasonCode: `legacy_spend:${source}`,
          title: reason,
          idempotencyKey: `legacy-tide-spend:${source}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        });
      },

      calculateMissedDays: () => calculateMissedDaysThisMonth(get().tideCheckIn?.checkIns || []),

      getMonthlyCheckInMap: () => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const checkedDates = new Set((get().tideCheckIn?.checkIns || []).map((item) => item.date));
        const map: Record<string, boolean> = {};
        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = localDateString(new Date(now.getFullYear(), now.getMonth(), day).getTime());
          map[date] = checkedDates.has(date);
        }
        return map;
      },

      dismissCheckInPromptToday: () => {
        const today = localDateString(Date.now());
        set((s) => ({
          tideCheckIn: {
            ...s.tideCheckIn,
            checkIns: s.tideCheckIn?.checkIns || [],
            pointLedger: s.tideCheckIn?.pointLedger || [],
            dismissedCheckInPromptDate: today,
          },
        }));
      },

      shouldShowCheckInPromptOnHome: () => {
        const today = localDateString(Date.now());
        const tide = get().tideCheckIn;
        return get().canCheckInToday() && tide?.dismissedCheckInPromptDate !== today;
      },

      checkInToday: (note, mood) => {
        if (import.meta.env.DEV) {
          console.warn('[legacy] useAppStore.checkInToday is fenced (Life Utility Phase A). Canonical path: useCheckInStore.clockIn.');
        }
        const state = get();
        const today = localDateString(Date.now());
        if ((state.tideCheckIn?.checkIns || []).some((item) => item.date === today)) return null;

        const lastDate = state.tideCheckIn?.lastCheckInDate;
        const previousStreak = state.tideCheckIn?.currentStreak || calculateCurrentStreakFrom(state.tideCheckIn?.checkIns || []);
        const streakDay = lastDate && daysBetweenLocal(lastDate, today) === 1 ? previousStreak + 1 : 1;
        const createdAt = new Date().toISOString();
        const rewards: TidePointLedger[] = [
          {
            id: crypto.randomUUID(),
            type: 'earn',
            amount: 10,
            reason: '每日簽到',
            source: 'checkin',
            createdAt,
          },
        ];
        if (streakDay > 0 && streakDay % 3 === 0) {
          rewards.push({
            id: crypto.randomUUID(),
            type: 'earn',
            amount: 15,
            reason: '連續 3 天潮汐獎勵',
            source: 'streak',
            createdAt,
          });
        }
        if (streakDay > 0 && streakDay % 7 === 0) {
          rewards.push({
            id: crypto.randomUUID(),
            type: 'earn',
            amount: 50,
            reason: '7 日潮汐獎勵',
            source: 'streak',
            createdAt,
          });
        }
        const pointsEarned = rewards.reduce((sum, reward) => sum + reward.amount, 0);
        const checkIn: TideCheckIn = {
          id: crypto.randomUUID(),
          date: today,
          mood: mood || undefined,
          note: note?.trim() || undefined,
          pointsEarned,
          streakDay,
          createdAt,
        };
        const nextCheckIns = [checkIn, ...(state.tideCheckIn?.checkIns || [])];
        const missedCountThisMonth = calculateMissedDaysThisMonth(nextCheckIns);
        const nextLongestStreak = Math.max(state.tideCheckIn?.longestStreak || 0, streakDay);
        const unlockedSevenDayReward = streakDay > 0 && streakDay % 7 === 0;
        const activityLog = makeActivityLog('system', '今日潮位已同步', {
          detail: `+${pointsEarned} 潮汐點 · 連續 ${streakDay} 天`,
          route: '/',
          level: 'success',
        });
        const moonDewEntry = buildDailyCheckinMoonDew(today, streakDay);
        const moonDewAdded = get().addMoonDewEntry(moonDewEntry);
        set((current) => ({
          tideCheckIn: {
            ...current.tideCheckIn,
            checkIns: nextCheckIns,
            currentStreak: streakDay,
            longestStreak: nextLongestStreak,
            missedCountThisMonth,
            lastCheckInDate: today,
            makeupTickets: (current.tideCheckIn?.makeupTickets || 0) + (unlockedSevenDayReward ? 1 : 0),
            penaltyEnabled: current.tideCheckIn?.penaltyEnabled === true,
          },
          activityLogs: [activityLog, ...(current.activityLogs || [])].slice(0, 200),
        }));
        return { checkIn, rewards, moonDewAdded };
      },

      setTodayMood: (mood) => set({ todayMood: mood }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      addCustomFont: (font) =>
        set((s) => ({ customFonts: [...(s.customFonts || []), font] })),
      removeCustomFont: (id) =>
        set((s) => ({ customFonts: (s.customFonts || []).filter((f) => f.id !== id) })),
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      migrate: (persisted) => normalizeStore(persisted as Partial<AppData>),
      merge: (persisted, current) => {
        const normalized = normalizeStore(persisted as Partial<AppData>);
        // Auto-title migration: existing conversations with '新對話' that have a user message
        if (Array.isArray(normalized.conversations)) {
          normalized.conversations = normalized.conversations.map((c) => {
            if (c.title === '新對話' && c.messages.length > 0) {
              const firstUserMsg = c.messages.find(
                (m: any) => m.sender === 'me' && m.type === 'text'
              ) as { content: string } | undefined;
              if (firstUserMsg) {
                return { ...c, title: generateConvTitle(firstUserMsg.content) };
              }
            }
            return c;
          });
        }
        return { ...current, ...normalized };
      },
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { aiTyping, rhythmReceipts, ...rest } = state;
        const sanitizedProviders = (rest.providers || []).map((p) => ({
          ...p,
          apiKey: '',
        }));
        return {
          ...rest,
          providers: sanitizedProviders,
          auth: {
            ...state.auth,
            isUnlocked: false,
          },
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (!error) state?.migrateLegacyWorldBook();
      },
    }
  )
);

/* ── Expiry scheduler (assigned after store creation) ── */
_scheduleExpiry = (id: string) => {
  const existing = _expiryTimers.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    useAppStore.getState().transitionMessageState(id, 'expired');
    _expiryTimers.delete(id);
  }, 5000);
  _expiryTimers.set(id, timer);
};

/* ── rhythmReceipts alias: keep in sync with sleepReceipts ── */
useAppStore.subscribe((state, prev) => {
  if (state.sleepReceipts !== prev.sleepReceipts) {
    useAppStore.setState({ rhythmReceipts: state.sleepReceipts });
  }
});

/* ── Agent Identity (canonical) / Partner selectors (legacy alias seam) ── */

/**
 * User-facing display name (1–24 chars, trimmed).
 * Falls back to the generic agent name (智能體) — never a fixed "LUNARIS".
 */
export function selectAgentDisplayName(partner?: { name?: string; displayName?: string }): string {
  const raw = partner?.displayName?.trim() || partner?.name?.trim();
  if (!raw) return AGENT_DEFAULT_DISPLAY_NAME;
  // Clamp to 24 chars
  return raw.length > 24 ? raw.slice(0, 24).trim() : raw;
}

/** Legacy alias — kept so partner-oriented call sites don't break. */
export function selectPartnerDisplayName(partner?: { name?: string; displayName?: string }): string {
  return selectAgentDisplayName(partner);
}

/** Agent avatar metadata (IndexedDB-backed). Returns undefined when no custom avatar. */
export function selectAgentAvatar(partner?: { avatarImage?: AvatarImageMeta }): AvatarImageMeta | undefined {
  return partner?.avatarImage;
}

/** Legacy alias of selectAgentAvatar. */
export function selectPartnerAvatar(partner?: { avatarImage?: AvatarImageMeta }): AvatarImageMeta | undefined {
  return selectAgentAvatar(partner);
}

/** Canonical id of the current agent (Phase 1: single agent). */
export function selectCurrentAgentId(): AgentId {
  return DEFAULT_AGENT_ID;
}

/** Canonical read model for the current agent, derived from persisted partner data. */
export function selectAgentProfile(partner?: { name?: string; displayName?: string; status?: string; bio?: string; personalityNote?: string; avatarInitial?: string; avatarColor?: string; avatarImage?: AvatarImageMeta; characterVoice?: CharacterVoiceProfile }): AgentProfile {
  return {
    id: selectCurrentAgentId(),
    name: partner?.name ?? SYSTEM_AGENT_NAME,
    displayName: selectAgentDisplayName(partner),
    status: partner?.status ?? '',
    bio: partner?.bio,
    personalityNote: partner?.personalityNote,
    avatarInitial: partner?.avatarInitial || AGENT_DEFAULT_AVATAR_INITIAL,
    avatarColor: partner?.avatarColor || 'char',
    avatarImage: partner?.avatarImage,
    characterVoice: partner?.characterVoice,
  };
}
