import type { HolidayRegion } from '@/features/calendar/holiday/types';

// ================================================================
// Core App Data
// ================================================================

export interface WaterData {
  goalMl: number;
  cupMl: number;
  todayMl: number;
  updatedDate: string; // YYYY-MM-DD
  reminderOn: boolean;
  reminderInterval: number;
  dailyLogs: Record<string, number>; // date -> ml
}

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'custom';

export interface AiConfig {
  enabled: boolean;
  mode: 'proxy' | 'direct';
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  proxyUrl: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  reasoningSummary: 'off' | 'brief' | 'detailed';
  systemPrompt: string;
  memoryContextEnabled: boolean;
  devMockEnabled: boolean;
}

export type AiConnectionProvider =
  | 'openai'
  | 'openai-compatible'
  | 'deepseek'
  | 'gemini'
  | 'claude'
  | 'openrouter'
  | 'groq'
  | 'siliconflow'
  | 'ollama'
  | 'custom-relay';

export type AiCompatibilityMode = 'openai-compatible' | 'native-gemini' | 'native-claude';

export type AiConnectionStatus = 'not_configured' | 'configured' | 'testing' | 'ok' | 'error';

export interface AiConnectionModel {
  id: string;
  label?: string;
  provider?: string;
}

/** @deprecated Legacy AI connection config — use ProviderConfig instead */
export interface AiConnectionConfig {
  enabled: boolean;
  provider: AiConnectionProvider;
  compatibilityMode: AiCompatibilityMode;
  baseUrl: string;
  apiKey: string;
  model: string;
  availableModels: AiConnectionModel[];
  status: AiConnectionStatus;
  lastTestedAt?: number;
  errorMessage?: string;
  streamingEnabled: boolean;
  thinkingUiEnabled: boolean;
  temperature: number;
  maxTokens?: number;
  contextMessageLimit: number;
  modelsEndpoint: string;
  chatEndpoint: string;
}

export interface LauncherApp {
  key: string;
  label: string;
  action: string;
  gradient: string;
  iconImg?: string; // base64
}

export interface UsageLogEntry {
  id: string;
  ts: number;
  points: number;
  reason: string;
}

export interface UsageData {
  daily: { date: string; points: number };
  weekly: { weekKey: string; points: number };
  logs: UsageLogEntry[];
}

export type FocusPreset = 'espresso' | 'flow' | 'deepwork' | 'night' | 'custom';

export interface FocusConfig {
  focusMinutes: number;
  breakMinutes: number;
  targetRounds: number;
  selectedPreset: FocusPreset;
}

export interface FocusSessionEntry {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  actualFocusMinutes: number;
  plannedFocusMinutes: number;
  plannedRounds: number;
  roundsCompleted: number;
  interruptions: number;
  status: 'completed' | 'interrupted';
  /** Phase 2.1: optional enriched fields */
  sessionId?: string;
  task?: string;
  outcome?: 'kept' | 'recorded' | 'caught';
  flags?: {
    overAdjusting?: boolean;
    earlyEscape?: boolean;
    noTaskDefined?: boolean;
    goodRecovery?: boolean;
    honestCompletion?: boolean;
    fakePreparation?: boolean;
  };
  pauseCount?: number;
  modeId?: string;
  linkedQuestId?: string;
}

export type VoiceMessageRole = 'user' | 'assistant';

export type TranscriptStatus = 'none' | 'pending' | 'done' | 'failed';

export type VoiceMessageSpeed = 1 | 1.25 | 1.5 | 2;

export interface VoiceMessage {
  id: string;
  role: VoiceMessageRole;
  audioUrl?: string;
  artworkUrl?: string;
  artworkSource?: 'upload' | 'generated' | 'none';
  fileName?: string;
  mimeType?: string;
  durationMs?: number;
  waveform?: number[];
  transcript?: string;
  transcriptStatus: TranscriptStatus;
  transcriptSource?: 'mock' | 'stt' | 'manual';
  createdAt: string;
  speed?: VoiceMessageSpeed;
  source: 'upload' | 'recording' | 'ai-generated' | 'text';
  audioPersistence?: 'session' | 'saved' | 'remote';
  text?: string;
  allowMemory?: boolean;
  memoryEntryId?: string;
}

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom' | 'one-time';
export type SubscriptionCategory = 'work' | 'study' | 'life' | 'entertainment' | 'ai';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial';

export interface SubscriptionRecord {
  id: string;
  serviceName: string;
  purchaseType: string;
  purchaseDate: string; // YYYY-MM-DD
  renewalDate: string; // YYYY-MM-DD
  price: number;
  billingCycle: BillingCycle;
  category: SubscriptionCategory;
  paymentReason: string;
  notes: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  iconUrl?: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
  /* ── LedgerSubscription extension fields (migration-safe) ── */
  name?: string;
  amount?: number;
  currency?: string;
  customCycleDays?: number;
  startDate?: string;
  nextBillingDate?: string;
  paymentSourceId?: string;
  paymentPlatform?: string;
  renewalUrl?: string;
  renewalUrlLabel?: string;
  reason?: string;
  note?: string;
}

/* ── Payment Source (local tag, not real bank) ── */
export type PaymentSourceType = 'wallet' | 'bank-card' | 'app-store' | 'google-play' | 'paypal' | 'cash' | 'website' | 'other';

export interface PaymentSource {
  id: string;
  name: string;
  type: PaymentSourceType;
  lastFour?: string;
  customImage?: string;
  note?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string;
}

/* ── Ledger Account Card (visual, not real bank) ── */
export interface LedgerAccountCard {
  id: string;
  name: string;
  balance: number;
  currency: string;
  cardImage?: string;
  cardOverlay?: 'light' | 'dark' | 'auto';
  lastFour?: string;
  note?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt?: string;
}

/* ── Ledger Budget ── */
export interface LedgerBudget {
  id: string;
  category: string;
  amount: number;
  currency: string;
  period: 'monthly';
  createdAt: string;
  updatedAt?: string;
}

export type LedgerCategory = '生活' | '飲食' | '工作' | '學習' | '娛樂' | 'AI' | '交通' | '醫療' | '其他';
export type LedgerMood = '必要' | '衝動' | '安慰' | '後悔' | '開心' | '普通';
export type LedgerType = 'expense' | 'income' | 'subscription' | 'adjustment';
export type LedgerSource = 'chat' | 'manual' | 'subscription' | 'receipt';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  amount: number;
  currency: string;
  title: string;
  category: LedgerCategory;
  source: LedgerSource;
  date: string;
  note?: string;
  merchant?: string;
  mood?: LedgerMood;
  allowAiRecall?: boolean;
  subscriptionId?: string;
  paymentSourceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TideCheckIn {
  id: string;
  date: string; // YYYY-MM-DD, local date
  mood?: string;
  note?: string;
  pointsEarned: number;
  streakDay: number;
  createdAt: string;
}

export interface TidePointLedger {
  id: string;
  type: 'earn' | 'spend' | 'penalty' | 'adjust';
  amount: number;
  reason: string;
  source: 'checkin' | 'streak' | 'gacha' | 'makeup' | 'manual';
  createdAt: string;
}

export interface TideCheckInState {
  checkIns: TideCheckIn[];
  pointLedger: TidePointLedger[];
  currentStreak: number;
  longestStreak: number;
  missedCountThisMonth: number;
  lastCheckInDate?: string;
  dismissedCheckInPromptDate?: string;
  makeupTickets: number;
  penaltyEnabled: boolean;
}

/* ================================================================
   Dual Ledger — Moon Ledger Phase 1
   ================================================================ */

export type LedgerDomain = 'money' | 'moon_dew';

export type MoneyTransactionSource = 'manual' | 'chat' | 'import';

export interface MoneyTransaction {
  id: string;
  type: 'income' | 'expense';
  amountMinor: number;
  currency: string;
  accountId: string;
  categoryId: string;
  source: MoneyTransactionSource;
  title?: string;
  note?: string;
  occurredAt: string; // ISO 8601
  createdAt: string;  // ISO 8601
  updatedAt?: string; // ISO 8601
}

export type MoonDewSource =
  | 'daily_checkin'
  | 'focus'
  | 'playroom'
  | 'achievement'
  | 'manual_adjustment'
  | 'reversal'
  | 'migration'
  | 'quest'
  | 'check_in';

export interface MoonDewLedgerEntry {
  id: string;
  amount: number;
  source: MoonDewSource;
  reasonCode: string;
  title: string;
  relatedEntityId?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO 8601
  reversedEntryId?: string;
}

export type TimeEventType =
  | 'countdown'
  | 'anniversary'
  | 'birthday'
  | 'project'
  | 'personal'
  | 'renewal'
  | 'memory'
  | 'system';

export interface TimeEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: TimeEventType;
  repeat: 'none' | 'yearly' | 'monthly';
  icon: string;
  note?: string;
  pinned: boolean;
  reminderEnabled: boolean;
  /** @deprecated Use date. Kept for old persisted entries and subscription bridges. */
  targetDate?: string;
  /** @deprecated Use note. */
  description?: string;
  linkedId?: string;
  linkedType?: 'subscription' | 'memory' | 'journal' | 'book' | 'music' | 'system';
  /** @deprecated Use pinned. */
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SleepReceipt {
  id: string;
  type: 'sleep_receipt';
  date: string;
  totalSleep: number;
  remMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  awakeMinutes: number;
  sleepScore: number;
  lunarisComment: string;
  viewed: boolean;
  memoryEntryId?: string;
  savedToSecondBrainAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ── TimelineEvent (Phase 12) ──
export type TimelineEventType =
  | 'memory' | 'sleep' | 'period' | 'todo'
  | 'forum_post' | 'forum_reply' | 'chat'
  | 'water' | 'focus' | 'journal' | 'event'
  | 'diet' | 'diet_receipt' | 'sleep_receipt';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  sourceType: string;
  sourceId: string;
  date: string;
  icon: string;
  label: string;
  detail: string;
  subDetail?: string;
  color: string;
  route?: string;
  createdAt: number;
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface CustomFontEntry {
  id: string;
  name: string;
  fontFamily: string;   // CSS font-family value, e.g. '"My Font"'
  category: 'system' | 'google' | 'custom';
  assetId?: string;     // IndexedDB key for custom uploaded fonts
  url?: string;          // URL for Google Fonts
  format?: 'truetype' | 'opentype' | 'woff' | 'woff2';
  createdAt: number;
}

export interface AppData {
  auth: AuthState;
  moonGateDeviceIdentity?: MoonGateDeviceIdentity;
  moonGateAuthVersion?: number;
  theme: 'dark' | 'light' | 'system';
  accentColor: 'coral' | 'teal' | 'lavender' | 'amber' | 'rose';
  themeConfig: ThemeConfig;
  language: 'zh-TW' | 'en';
  /** Explicit user choice only; null means Holiday projection is unconfigured. */
  holidayRegion: HolidayRegion | null;
  userName: string;
  avatarSize: number;
  bgOpacity: number;
  homeCustomCSS: string;
  profile: ProfileData;
  water: WaterData;
  locations: MemoryLocationPlace[];
  customEvents: CalendarEvent[];
  calendarNotes?: CalendarNote[];
  calendarChanges?: CalendarChangeCursor[];
  calendarPermissions?: CalendarPermissions;
  momentsAgentPermissions?: MomentsAgentPermissions;
  lastSeenCalendarRevision?: number;
  calendarDayElements?: CalendarDayElement[];
  calendarDayRevisions?: CalendarDayRevision[];
  calendarDaySnapshots?: CalendarDaySnapshot[];
  todos: TodoItem[];
  todoTicketSequence: number;
  countdowns: CountdownItem[];
  journalEntries: QuickJournalEntry[];
  memoryEntries: MemoryEntry[];
  healthRecords: HealthRecord[];
  sleepReceipts: SleepReceipt[];
  diaryEntries: DiaryEntry[];
  journalWorkspaceEntries: JournalEntry[];
  journalSchemaVersion: number;
  journalMigrationStats?: {
    migratedAt: string;
    memoryBefore: number;
    diaryBefore: number;
    journalAfter: number;
  };
  forumPosts: ForumPost[];
  forumReplies: ForumReply[];
  forumNotifications: ForumNotification[];
  timelineEvents: TimelineEvent[];
  launcherIcons: Record<string, LauncherApp>;
  launcherOrder: string[];
  hiddenLauncherApps: string[];
  dashboardLayout: string[];
  hiddenWidgets: string[];
  aiConfig: AiConfig;
  aiConnection: AiConnectionConfig;
  music: MusicState;
  messages: Message[];
  conversations: Conversation[];
  chatProjects: ChatProject[];
  activeConversationId: string | null;
  chatContacts: ChatContact[];
  activityLogs: ActivityLogEntry[];
  recentEmojis: string[];
  chatStickers: string[];
  chatBondStyle: 'heart' | 'ecg';
  anniversaries: Anniversary[];
  usage: UsageData;
  partner: PartnerData;
  connectionStyle: ConnectionStyle;
  petWidget: PetWidgetData;
  aiUsage: AiUsageData;
  aiPrompting: AiPromptingData;
  customStickers: CustomSticker[];
  stickerPacks: StickerPack[];
  dailyTarot: DailyTarotData;
  tarotHistory: TarotHistoryEntry[];
  agentTools: AgentTool[];
  rewardRules: RewardRule[];
  agentRuntimeLogs: AgentRuntimeLog[];
  providers: ProviderConfig[];
  mcpConnections: MCPConnection[];
  aiRoles: AiRolesMap;
  focusConfig: FocusConfig;
  focusSessionLog: FocusSessionEntry[];
  focusMinutes: number;
  focusSessions: number;
  allowClawdInChat: boolean;
  subscriptions: SubscriptionRecord[];
  ledgerEntries: LedgerEntry[];
  paymentSources?: PaymentSource[];
  ledgerAccounts?: LedgerAccountCard[];
  ledgerBudgets?: LedgerBudget[];
  moneyTransactions: MoneyTransaction[];
  moonDewLedger: MoonDewLedgerEntry[];
  ledgerDomain: LedgerDomain;
  ledgerMigrationVersion?: number;
  tideCheckIn: TideCheckInState;
  timeEvents: TimeEvent[];
  forumMigrationVersion: number;
  forumCleanupVersion: number;
  hasSeenSettingsIntro: boolean;
  chatSettings: ChatSettings;
  enableForumAiReplies: boolean;
  todayMood: TodayMood | null;
  displayFont: string;
  bodyFont: string;
  fontSize: number;
  /** Cloud sync status (Supabase). */
  syncStatus: SyncStatus;
  /** User's custom font library. */
  customFonts: CustomFontEntry[];
  /** Daily Cache retention period in days (default 30). */
  cacheRetentionDays: number;
}

export interface AuthState {
  authEnabled: boolean;
  username: string;
  passwordHash: string;
  isUnlocked: boolean;
  /** Rune Login Gate: the generated Access String (single storage key). */
  accessString: string;
  /** True once first-run onboarding (Invitation Code → Access String) is committed. */
  onboardingComplete: boolean;
  /** True for legacy password users migrated to the Access String contract. */
  legacyOnboarded: boolean;
}

export type MoonGateKeyState = 'available' | 'key_unavailable';

export interface MoonGateDeviceIdentity {
  id: string;
  publicFingerprint: string;
  createdAt: number;
  platformLabel: string;
  version: number;
}

/** Safe appearance customizer — whitelist of preset-based theme overrides. */
export interface ThemeConfig {
  accent: string;
  backgroundPreset: 'default' | 'moonlight' | 'pink' | 'blue' | 'terminal';
  glassIntensity: 'low' | 'medium' | 'high';
  radius: 'soft' | 'round' | 'pill';
  bubbleStyle: 'glass' | 'wechat' | 'paper' | 'terminal';
  /** Global typography multiplier. 1 = standard; range [0.85, 1.25], step 0.05. Typography-only — never scales geometry. */
  fontScale: number;
}

export interface ChatSettings {
  continuousMessages: boolean;
  burstDelay: number; // ms, default 4000
}

export type TarotSpread = 'single' | 'three' | 'lunar';

export interface TarotDrawCard {
  cardId: string;
  reversed: boolean;
}

export interface DailyTarotData {
  date: string;
  spread: TarotSpread;
  cards: TarotDrawCard[];
  createdAt: number;
}

export interface TarotHistoryEntry {
  date: string;
  spread: TarotSpread;
  cards: TarotDrawCard[];
  createdAt: number;
}

export interface CustomSticker {
  id: string;
  name: string;
  url: string;
  assetId?: string;
  createdAt: number;
}

export interface StickerPackItem {
  id: string;
  name: string;
  url: string;
  assetId?: string;
  tags?: string[];
  type?: 'image' | 'gif';
  createdAt: number;
}

export interface StickerPack {
  id: string;
  name: string;
  owner: 'user' | 'lunaris';
  stickers: StickerPackItem[];
  createdAt: number;
}

export interface AvatarImageMeta {
  storage: 'indexeddb';
  key: string;
  name: string;
  type: string;
  size: number;
  updatedAt: number;
}

export interface ProfileData {
  displayName: string;
  status: string;
  bio: string;
  /** Presence 簽名 — Home Presence Capsule 下方顯示的一句話。 */
  signature?: string;
  avatarInitial?: string;
  avatarColor?: string;
  avatarAssetId?: string;
  avatarImage?: AvatarImageMeta;
  coverAssetId?: string;
  chatBackgroundAssetId?: string;
}

export interface AvatarData {
  initial: string;
  color: string;
  imageUrl?: string;
}

export interface PartnerData {
  /** Stable agent profile id — legacy migration marker + multi-agent seam. */
  id?: string;
  /** Internal system identity name (e.g. "agent"). Never user-facing by itself. */
  name: string;
  /** User-changable display name (1–24 chars). Falls back to the generic agent name (智能體). */
  displayName?: string;
  status: string;
  /** Presence 簽名 — 供 Chat / Presence tooltip / profile 使用（非常駐 Home）。 */
  signature?: string;
  bio?: string;
  personalityNote?: string;
  avatarInitial: string;
  avatarColor: string;
  avatarImageUrl?: string;
  avatarImage?: AvatarImageMeta;
  characterVoice?: CharacterVoiceProfile;
}

export type ChatPresenceStatus = 'online' | 'invisible' | 'busy' | 'syncing' | 'offline' | 'local' | 'quiet' | 'disabled' | 'unlinked';

export type CompanionMood =
  | 'idle'
  | 'curious'
  | 'happy'
  | 'focused'
  | 'concerned'
  | 'sleepy'
  | 'annoyed'
  | 'protective'
  | 'quiet';

export type CompanionMode = 'quiet' | 'active' | 'teasing' | 'gentle' | 'focus';

export type InitiativeLevel = 'low' | 'medium' | 'high';

export interface CompanionState {
  mood: CompanionMood;
  statusText: string;
  energy: number;
  focus: number;
  affection: number;
  annoyance: number;
  lastUpdatedAt: number;
  reason?: string;
  source: 'rule' | 'llm' | 'manual-preference';
}

export interface CompanionPreferences {
  companionMode: CompanionMode;
  initiativeLevel: InitiativeLevel;
  allowProactiveNudge: boolean;
  allowMoodFromChat: boolean;
}

export interface ChatContact {
  id: string;
  name: string;
  avatar: 'partner' | 'system' | 'custom';
  status: ChatPresenceStatus;
  manualStatusOverride?: boolean;
  lastMessage: string;
  unreadCount: number;
  updatedAt: number;
  route: string;
}

export type ActivityLogType = 'todo' | 'memory' | 'health' | 'music' | 'chat' | 'forum' | 'settings' | 'system' | 'inspiration' | 'timekeeper' | 'subscription' | 'focus' | 'book' | 'diet' | 'sleep';
export const ALL_ACTIVITY_LOG_TYPES: ActivityLogType[] = ['todo', 'memory', 'health', 'music', 'chat', 'forum', 'settings', 'system', 'inspiration', 'timekeeper', 'subscription', 'focus', 'book', 'diet', 'sleep'];
export type ActivityLogLevel = 'info' | 'success' | 'warning' | 'danger';

export interface ActivityLogEntry {
  id: string;
  type: ActivityLogType;
  title: string;
  detail?: string;
  route?: string;
  createdAt: number;
  read: boolean;
  level: ActivityLogLevel;
}

export type ConnectionStyle = 'heart' | 'heartbeat' | 'wave' | 'orbit' | 'link';

export type PetMood = 'idle' | 'happy' | 'thinking' | 'sleepy' | 'anxious' | 'shy' | 'annoyed' | 'error';

export interface PetImageMeta {
  storage: 'indexeddb';
  key: string;
  name: string;
  type?: string;
  size?: number;
  updatedAt: number;
}

export interface PetImageFrame {
  id: string;
  storage: 'indexeddb';
  key: string;
  name: string;
  type: string;
  size: number;
  updatedAt: number;
}

export interface PetMoodImages {
  frames: PetImageFrame[];
  frameDurationMs?: number;
  loop?: boolean;
}

export interface AiUsageLogEntry {
  id: string;
  createdAt: number;
  date: string;
  provider: string;
  model: string;
  source: 'chat' | 'test_connection' | 'diary' | 'memory' | 'unknown';
  status: 'success' | 'error';
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedTotalTokens?: number;
  estimatedCostUsd?: number;
  pricingVersion?: string;
  pricingUpdatedAt?: string;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface AiUsageDailyData {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  errorCount: number;
  estimatedTokens: number;
}

export interface AiUsageData {
  daily: Record<string, AiUsageDailyData>;
  logs: AiUsageLogEntry[];
}

export interface WorldBookEntryMetadata {
  category?: 'character' | 'location' | 'event' | 'rule';
  legacyType?: 'location' | 'character' | 'organization' | 'concept';
}

export interface WorldBookEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
  metadata?: WorldBookEntryMetadata;
}

export interface AiPromptingData {
  systemPrompt: string;
  characterPrompt: string;
  stylePrompt: string;
  safetyPrompt: string;
  memoryEnabled: boolean;
  memoryLimit: number;
  diaryMemoryEnabled: boolean;
  worldBookEnabled: boolean;
  worldBookEntries: WorldBookEntry[];
  worldBookMigrationVersion: number;
}

export interface PetWidgetData {
  visible: boolean;
  x?: number;
  y?: number;
  currentMood: PetMood;
  manualMoodOverride?: boolean;
  moodImages: Partial<Record<PetMood, PetMoodImages>>;
  images?: Partial<Record<PetMood, PetImageMeta>>;
}

// ================================================================
// Calendar / Events
// ================================================================

export interface CalendarEvent {
  id: string;
  type: 'event' | 'task';
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  title: string;
  completed: boolean;
  description: string;
  note?: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  category?: 'general' | 'countdown' | 'anniversary' | 'birthday' | 'project' | 'personal' | 'renewal' | 'memory' | 'system';
  repeat?: 'none' | 'yearly' | 'monthly';
  pinned?: boolean;
  reminderEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
  image?: string; // base64
  author?: CalendarAuthor;
  precision?: 'minute' | 'hour' | 'segment' | 'day';
  eventType?: string;
  questId?: string;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

/** Canonical calendar entity. CalendarEvent remains the compatibility name. */
export type CalendarEntry = CalendarEvent;

export type CalendarAuthor = 'user' | 'lunaris' | 'auto';

export interface CalendarNote {
  id: string;
  dateKey: string;
  eventId?: string;
  author: Exclude<CalendarAuthor, 'auto'>;
  content: string;
  likedByUser?: boolean;
  likedByLunaris?: boolean;
  x?: number;
  y?: number;
  width?: number;
  rotation?: number;
  styleVariant?: 'cream' | 'teal' | 'amber';
  zIndex?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type CalendarDayElementType = 'photo' | 'sticker';
export interface CalendarDayElement {
  id: string;
  dateKey: string;
  type: CalendarDayElementType;
  assetId?: string;
  stickerId?: 'crescent' | 'tide-wave' | 'star' | 'pearl' | 'stamp' | 'tape' | 'doodle';
  frame?: 'plain' | 'polaroid';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdBy: Exclude<CalendarAuthor, 'auto'>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface CalendarDayRevision { dateKey: string; contentRevision: number }
export interface CalendarDaySnapshot {
  dateKey: string;
  assetId: string;
  contentRevision: number;
  renderedRevision: number;
  renderedAt: number;
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/webp';
  renderError?: string;
}

export interface CalendarChangeCursor {
  id: number;
  entityType: 'event' | 'note';
  entityId: string;
  changedBy: Exclude<CalendarAuthor, 'auto'>;
  changedAt: string;
  revision: number;
}

export interface CalendarPermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  comment: boolean;
}

export interface MomentsAgentPermissions {
  momentsRead: boolean;
  momentsWrite: boolean;
  momentsInteract: boolean;
}

export interface TodoItem {
  id: string;
  ticketNumber: number;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  /** Alias for date, used by Time Hub deadline wording. */
  dueDate?: string;
  /** Alias for time, used by Time Hub deadline wording. */
  dueTime?: string;
  completed: boolean;
  status?: 'pending' | 'done' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  category: 'life' | 'work' | 'study' | 'health' | 'lunartide' | 'shopping' | 'other';
  notes?: string;
  remindAt?: string;
  /** Alias for remindAt. */
  reminderAt?: string;
  countdownEnabled?: boolean;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  countdownRef?: {
    type: CountdownItem['type'];
    color: string;
    customTypeLabel?: string;
  };
  memoryRef?: {
    id: string;
    title: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface CountdownItem {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  targetTime?: string;
  type: 'anniversary' | 'deadline' | 'birthday' | 'project' | 'custom';
  customTypeLabel?: string;
  color: string;
  pinned: boolean;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Anniversary {
  id: string;
  title: string;
  date: string;
  image?: string;
  pinned: boolean;
}

// ================================================================
// Journal
// ================================================================

export interface QuickJournalEntry {
  id: string;
  templateType: string;
  date: string;
  time: string;
  weekday: string;
  scene: string;
  triggerText: string;
  bodyThoughts: string;
  anxietyLevel: number;
  nextStep: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryLocation {
  id?: string;
  name: string;
  rawName?: string;
  lat?: number;
  lng?: number;
}

export interface MemoryLocationPlace {
  id: string;
  name: string;
  rawName?: string;
  icon: string;
  color: string;
  description: string;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
}

export type MemoryCategory = 'dialogue' | 'emotion' | 'reading' | 'idea' | 'achievement' | 'system' | 'crash' | 'forum_collect';

export type MemoryMood = 'calm' | 'happy' | 'anxious' | 'angry' | 'dark' | 'panic';

/** TodayMood — unified cross-app mood for the current day */
export type TodayMood = 'happy' | 'calm' | 'anxiety' | 'gloomy' | 'angry' | 'meltdown';

export interface DiaryReply {
  id: string;
  body: string;
  createdAt: number;
  authorName: string;
  authorAvatar?: string; // CSS gradient or color
  parentReplyId?: string; // nested reply — id of the parent reply
}

export interface MemoryEntry {
  id: string;
  /* ── v2 vault fields ── */
  title?: string;
  content?: string;
  owner?: 'user' | 'ai' | 'shared';
  createdBy?: 'user' | 'ai' | 'system';
  source?: 'chat' | 'focus' | 'forum' | 'diet' | 'timekeeper' | 'todo' | 'inspiration' | 'works' | 'item_archive' | 'period' | 'voice' | 'system' | 'manual';
  type?: string;
  status?: 'inbox' | 'active' | 'pinned' | 'keep' | 'fading' | 'archived' | 'trash';
  visibility?: 'user-visible' | 'ai-context' | 'private' | 'hidden';
  allowAiRecall?: boolean;
  localOnly?: boolean;
  sensitive?: boolean;
  expiresAt?: number;
  deleteAfter?: number;
  metadata?: Record<string, unknown>;
  /* ── legacy fields ── */
  cardType?: 'journal' | 'health' | 'todo' | 'forum_bookmark' | 'diet_receipt' | 'sleep_receipt';
  dietReceiptId?: string;
  sleepReceiptId?: string;
  healthRecordId?: string;
  linkedForumPostId?: string;
  linkedForumPostContent?: string;
  scene: string;
  triggerText: string;
  bodyThoughts: string;
  anxietyLevel: number;
  nextStep: string;
  location?: MemoryLocation;
  summary?: string;
  category?: MemoryCategory;
  completed?: boolean;
  images?: string[];
  mood?: string;
  moodV4?: MemoryMood;
  /** Stable manifest id for the optional LUNARIS journal reaction. */
  companionReactionId?: string;
  replies?: DiaryReply[];
  liked?: boolean;
  favorite?: boolean;
  pinned?: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export type HealthRecordType = 'sleep' | 'screenTime' | 'mood' | 'water';
export type HealthRecordSource = 'manual' | 'pasted' | 'healthConnect' | 'systemUsage' | 'mcp';
export type HealthRecordQuality = 'poor' | 'normal' | 'good';

export interface ScreenTimeApp {
  name: string;
  durationMinutes: number;
}

export interface HealthRecord {
  id: string;
  type: HealthRecordType;
  date: string;
  source: HealthRecordSource;
  /** Future MCP integration — source app name */
  sourceApp?: string;
  rawText?: string;
  sleepStart?: string;
  sleepEnd?: string;
  sleepDurationMinutes?: number;
  deepSleepMinutes?: number;
  wakeCount?: number;
  /** Screen time specific */
  totalScreenMinutes?: number;
  topApps?: ScreenTimeApp[];
  quality: HealthRecordQuality;
  mood?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type DiaryAuthor = 'user' | 'luna' | 'shared';

export type DiaryVisibility = 'normal' | 'locked' | 'sealed';

export type DiaryMood = 'blank' | 'joy' | 'calm' | 'tired' | 'anxious';

export type JournalEntryKind = 'diary' | 'memory' | 'ai_diary' | 'shared';
export type JournalCaptureMode = 'fragment' | 'vent' | 'dialogue';
export type JournalAuthor = 'user' | 'lunaris' | 'shared';
export type JournalAiAccess = 'private' | 'reference' | 'coauthor';
export type JournalEntrySource = 'manual' | 'chat' | 'focus' | 'diet' | 'calendar' | 'migration';
export type JournalEntryOrigin = 'user' | 'system' | 'imported' | 'demo';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  completedAt?: string;
}

export interface JournalAttachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name?: string;
}

export interface JournalAuthorSegment {
  id: string;
  author: Exclude<JournalAuthor, 'shared'>;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** Phase 1B — Quote reference recorded on the quoting comment. */
export interface JournalCommentQuote {
  commentId: string;
  authorId: string;
  excerpt: string;
}

export interface JournalCommentVote {
  actorId: string;
  value: -1 | 1;
  updatedAt: number;
}

export interface JournalComment {
  id: string;
  postId: string;
  parentId?: string;
  rootCommentId?: string;
  authorId: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  votes: JournalCommentVote[];
  quote?: JournalCommentQuote;
  mentions?: ForumMention[];
}

export interface ForumMention {
  identityId: string;
  handleSnapshot: string;
  displayNameSnapshot: string;
}

export interface JournalEntry {
  id: string;
  kind: JournalEntryKind;
  author: JournalAuthor;
  /** Content access. Kept separate from overview visibility. */
  access?: 'normal' | 'private';
  visibility?: {
    hiddenFromOverview?: boolean;
    hiddenAt?: number;
  };
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  /** Local calendar date. Never derive this with UTC ISO slicing. */
  occurredOn: string;
  origin: JournalEntryOrigin;
  moodId?: string;
  companionReactionId?: string;
  tags: string[];
  attachments: JournalAttachment[];
  favorite: boolean;
  pinned: boolean;
  /** Feed-only appreciation state. Deliberately independent from favorite/bookmark. */
  isLiked?: boolean;
  /** Primary feed pin timestamp. `null` means explicitly unpinned. */
  pinnedAt?: number | null;
  bumpedAt?: number | null;
  lastActivityAt?: number;
  commentsLockedAt?: number | null;
  /** Phase 1B — cumulative unique thread opens. */
  viewCount?: number;
  /** Phase 1B — user-subscribed notification toggle. */
  subscribed?: boolean;
  comments?: JournalComment[];
  mentions?: ForumMention[];
  archived: boolean;
  aiAccess: JournalAiAccess;
  lifecycle?: 'active' | 'fading' | 'archived';
  source?: JournalEntrySource;
  legacyId?: string;
  segments?: JournalAuthorSegment[];
  imageRefs?: JournalImageRef[];
  /** Phase 2 quick-capture mode. Legacy entries fall back to 'fragment' at read time. */
  captureMode?: JournalCaptureMode;
  checklistItems?: ChecklistItem[];
  /** Soft delete (Daily Cache Phase 2). */
  deletedAt?: number;
  purgeAt?: number;
}

/* ── Journal AI Echo (Phase 2) ── */
export type JournalAIResponseMode = 'listen' | 'question' | 'organize';

export interface JournalAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: JournalAIResponseMode;
  createdAt: string;
  status?: 'pending' | 'done' | 'error';
  /** organize replies render as a standalone suggestion card */
  suggestedTags?: string[];
}

export interface JournalAIThread {
  id: string;
  /** reference only — full messages never live inside JournalEntry */
  journalEntryId: string;
  friendId: string;
  mode: JournalAIResponseMode;
  /** user explicitly confirmed sending the entry content to the friend */
  entryShared: boolean;
  messages: JournalAIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntry {
  id: string;
  author: DiaryAuthor;
  visibility: DiaryVisibility;
  title: string;
  content: string;
  mood?: DiaryMood;
  date: string;
  createdAt: number;
  updatedAt: number;
  source?: 'manual' | 'chat' | 'memory' | 'mock-luna';
  lock?: {
    enabled: boolean;
    mode: 'soft';
    passwordHash?: string;
    unlockAt?: number;
    hint?: string;
  };
}

export type ForumPostAuthor = 'user' | 'luna';

export interface ForumPost {
  id: string;
  author: ForumPostAuthor;
  content: string;
  status: 'normal' | 'locked' | 'scheduled' | 'draft';
  scheduledOpenAt?: number;
  linkedMemoryId?: string;
  linkedJournalId?: string;
  likes?: string[];
  bookmarks?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ForumReply {
  id: string;
  postId: string;
  parentReplyId?: string;
  author: ForumPostAuthor;
  content: string;
  replyTo?: {
    id: string;
    content: string;
    author: ForumPostAuthor;
  };
  createdAt: number;
  updatedAt: number;
}

export type ForumNotificationType = 'reply' | 'quote' | 'mention';

export interface ForumNotification {
  id: string;
  type: ForumNotificationType;
  postId: string;
  replyId: string;
  fromAuthor: ForumPostAuthor;
  contentPreview: string;
  read: boolean;
  createdAt: number;
}

// ================================================================
// Chat
// ================================================================

/** narrator is retained only to render legacy sender snapshots; new identities use user, ai, or silent. */
export type IdentityKind = 'user' | 'ai' | 'silent' | 'narrator';

export interface AvatarVariant {
  id: string;
  label: string;
  /** Legacy display field accepted by older identity imports. */
  name?: string;
  assetId: string;
  cropX: number;
  cropY: number;
  zoom: number;
}

/** Restrained motion presets applied to the AI portrait while "speaking". No fake lip-sync in Phase 1. */
export type CallMotionPreset = 'none' | 'breathe' | 'scale' | 'glow' | 'tilt';

/** Per-identity imagery for simulated calls. All images are IndexedDB assets — never Base64 in persisted state. */
export interface IdentityCallMedia {
  callPortraitAssetId?: string;
  cameraOffAssetId?: string;
  callBackgroundAssetId?: string;
  crop?: { x: number; y: number; zoom: number };
  motionPreset?: CallMotionPreset;
}

export interface ChatIdentity {
  id: string;
  kind: IdentityKind;
  displayName: string;
  /** Canonical lowercase forum/chat handle, stored without @. */
  handle?: string;
  avatarVariants: AvatarVariant[];
  defaultAvatarVariantId: string;
  bio: string;
  personaPrompt: string;
  tone?: string;
  mentionAliases: string[];
  providerConfigId?: string;
  modelId?: string;
  defaultReplyPolicy?: GroupReplyPolicy;
  allowManualSpeaking: boolean;
  archived: boolean;
  /** Simulated-call imagery settings (Immersive Media Phase 1). */
  callMedia?: IdentityCallMedia;
  createdAt: number;
  updatedAt: number;
}

export interface SenderSnapshot {
  identityId: string;
  displayName: string;
  avatarAssetId?: string;
  avatarVariantId?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  legacyAvatarUrl?: string;
  fallbackSeed?: string;
  kind: IdentityKind;
}

/**
 * Immutable snapshot of the message sender's identity at the time of send.
 * Used on ALL new messages (user, AI, system) for reliable display and
 * auditability.  Must NOT be changed when the character/user profile is
 * later edited.
 */
export interface MessageSenderSnapshot {
  senderId: string;
  senderType: 'user' | 'character' | 'system';
  displayName: string;
  avatarAssetId?: string;
  /** Character's updatedAt timestamp at the moment of this message — serves
   *  as an opaque version tag so old messages can display the correct avatar
   *  even after the character gets a new picture.  Absent for user / system
   *  senders. */
  characterVersion?: number;
}

// ================================================================
// Simulated AI Calls (Immersive Media Phase 1 — no WebRTC)
// ================================================================

export type SimulatedCallState = 'ringing' | 'connecting' | 'active' | 'reconnecting' | 'ended' | 'failed';
export type SimulatedCallKind = 'voice' | 'video';

export interface CallTranscriptEntry {
  id: string;
  speaker: 'me' | 'ai';
  identityId?: string;
  text: string;
  at: number;
}

export type CallEventType =
  | 'state'
  | 'mic'
  | 'camera'
  | 'speaker'
  | 'captions'
  | 'background'
  | 'reaction'
  | 'context-share'
  | 'minimize'
  | 'hangup';

export interface CallEventEntry {
  id: string;
  type: CallEventType;
  detail?: string;
  at: number;
}

export interface CallParticipantSnapshot {
  identityId: string;
  displayName: string;
  kind: IdentityKind;
  portraitAssetId?: string;
}

/** Simulated screen share may only carry app content — never a real screen capture. */
export type SharedCallContextType = 'image' | 'document' | 'journal' | 'context-card';

export interface SharedCallContext {
  id: string;
  type: SharedCallContextType;
  title: string;
  /** Reference to an app entity (journal entry id, memory id …). */
  refId?: string;
  /** IndexedDB asset reference for uploaded images / documents. Never Base64. */
  assetId?: string;
  at: number;
}

/** Persisted call summary. No audio / video is stored by default. */
export interface CallRecord {
  id: string;
  kind: SimulatedCallKind;
  conversationId?: string;
  startedAt: number;
  connectedAt?: number;
  endedAt: number;
  durationMs: number;
  participants: CallParticipantSnapshot[];
  transcript: CallTranscriptEntry[];
  events: CallEventEntry[];
  sharedContextIds: string[];
  sharedContexts: SharedCallContext[];
  endReason?: string;
}

export type PresenceState = 'online' | 'away' | 'busy' | 'offline' | 'invisible';

export interface PresenceOverride {
  mode: 'auto' | 'manual';
  state?: PresenceState;
  statusText?: string;
  expiresAt?: number;
}

export interface GroupParticipant {
  identityId: string;
  displayNameOverride?: string;
  avatarVariantOverrideId?: string;
  /** Group-scoped IndexedDB avatar. Never stores image data in persisted state. */
  customAvatarAssetId?: string;
  customAvatarCrop?: {
    x: number;
    y: number;
    zoom: number;
  };
  replyPolicy: GroupReplyPolicy;
  /** Canonical Phase 1 participation mode. replyPolicy remains as a legacy compatibility carrier. */
  aiParticipationMode?: GroupAiParticipationMode;
  role: 'member' | 'admin';
  order: number;
  joinedAt: number;
  presenceOverride?: PresenceOverride;
}

export type GroupRelationshipKind = 'close' | 'friend' | 'family' | 'rival' | 'protective' | 'dependent' | 'formal' | 'custom';

export interface GroupRelationship {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  kind: GroupRelationshipKind;
  customLabel?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type PresenceStatus = PresenceState;
export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type GroupReplyPolicy = 'mention' | 'smart' | 'roundtable' | 'director';
export type GroupAiParticipationMode = 'off' | 'mention-only' | 'automatic';
export type ParticipantControlMode = 'user' | 'auto' | 'paused';

export interface ParticipantPresence {
  participantId: string;
  status: PresenceStatus;
  actualPresenceStatus?: PresenceStatus;
  visiblePresenceStatus?: PresenceStatus;
  customText?: string;
  lastActiveAt?: string;
  manuallySet: boolean;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  groupNickname?: string;
  avatarUrl?: string;
  avatarInitial?: string;
  avatarColor?: string;
  controlMode: ParticipantControlMode;
  isSelf?: boolean;
  /** Last message ID this participant has read (single source of truth for read receipts).
   *  Local read receipt only — not synced with remote users. */
  lastReadMessageId?: string;
  /** Timestamp (ms) of this participant's last read. */
  lastReadAt?: number;
}

export interface BaseMessage {
  id: string;
  sender: 'me' | 'friend' | 'assistant';
  senderId?: string;
  characterVersion?: number;
  time: string;
  status: 'sent' | 'delivered' | 'read';
  deliveryStatus?: MessageDeliveryStatus;
  senderParticipantId?: string;
  senderDisplayNameSnapshot?: string;
  senderAvatarSnapshot?: string;
  senderSnapshot?: SenderSnapshot;
  /** Character System snapshot — populated on ALL new messages (Phase 1.1). */
  messageSnapshot?: MessageSenderSnapshot;
  controlSource?: 'user' | 'ai' | 'system';
  roundId?: string;
  readByParticipantIds?: string[];
  revoked?: boolean;
  revokedAt?: string;
  originalType?: 'text' | 'image' | 'file' | 'sticker' | 'voice';
  replyTo?: {
    id: string;
    senderName: string;
    textPreview: string;
  };
  readAt?: number;
  seenByUser?: boolean;
  seenByAI?: boolean;
  ephemeral?: boolean;
  expireAt?: number;
  messageState?: 'sent' | 'consumedByAI' | 'readByUser' | 'expired';
  pinned?: boolean;
  archived?: boolean;
  /** Soft delete (Daily Cache Phase 2). Not rendered when set. */
  deletedAt?: number;
  purgeAt?: number;
  /** Hidden only from this local user's chat view. The canonical message remains intact. */
  deletedForSelfAt?: number;
  /** Hidden from every participant view represented by this local conversation. */
  deletedForAllAt?: number;
  /** Identity that requested the global deletion, retained for auditability. */
  deletedByIdentityId?: string;
}

export interface ThinkingBlock {
  status: 'thinking' | 'done';
  characterThought: string;
  runtimeSteps: string[];
  startedAt: number;
  finishedAt?: number;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
  memoryContextUsed?: boolean;
  memoryContextMode?: 'keyword' | 'trigger' | 'skip';
  memoryContextCount?: number;
  thinking?: ThinkingBlock;
  stickerUrl?: string;
  stickerName?: string;
  interactive?: import('@/features/interactive/types').InteractiveAttachment;
  linkPreview?: {
    url: string;
    normalizedUrl: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    domain: string;
    provider?: string;
    fetchedAt: number;
  };
}

export interface ImageMessage extends BaseMessage {
  type: 'image';
  assetId: string;
  fileName?: string;
  fileSize?: number;
  fileType: string;
  caption?: string;
  createdAt: string;
}

export interface FileMessage extends BaseMessage {
  type: 'file';
  assetId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

export interface StickerMessage extends BaseMessage {
  type: 'sticker';
  /** Legacy / user sticker: data URL or blob reference */
  stickerUrl?: string;
  stickerName?: string;
  /** Builtin sticker: id from defaultClawdStickers manifest */
  stickerId?: string;
  /** Source discriminator for rendering */
  source?: 'builtin' | 'user';
}

/**
 * Voice sources must never be conflated:
 * - 'recorded': a real microphone recording — always has audioAssetId (IndexedDB Blob).
 * - 'scripted': a text performance — NO audio asset; playback uses local SpeechSynthesis
 *   or verbatim captions. Never fabricate an audioAssetId for scripted messages.
 * - 'tts': backend-generated audio — audioAssetId appears once synthesis succeeds;
 *   textSnapshot is always retained so the message can be re-synthesized.
 */
export type VoiceMessageSource = 'recorded' | 'scripted' | 'tts';

export type TtsSynthesisStatus = 'pending' | 'ready' | 'failed';

export interface VoiceSnapshot {
  /** Display label of the character voice, e.g. "LUNARIS · 溫柔" */
  voiceName?: string;
  /** SpeechSynthesis voiceURI when a local voice was chosen. */
  voiceUri?: string;
  tone?: string;
  rate?: number;
  pitch?: number;
  lang?: string;
}

export interface VoiceMessagePayload {
  /** Present only for real audio (recorded, or tts once synthesis succeeded). */
  audioAssetId?: string;
  durationMs: number;
  waveform: number[];
  mimeType?: string;
  source: VoiceMessageSource;
  transcript?: string;
  /** Original text for scripted / tts messages. Always retained. */
  textSnapshot?: string;
  /** Voice configuration snapshot for scripted / tts messages. */
  voiceSnapshot?: VoiceSnapshot;
  /** Lifecycle of backend synthesis for source === 'tts'. */
  ttsStatus?: TtsSynthesisStatus;
}

export interface ChatVoiceMessage extends BaseMessage, VoiceMessagePayload {
  type: 'voice';
}

export type Message = TextMessage | ImageMessage | FileMessage | StickerMessage | ChatVoiceMessage;

export type ChatMiniGame = 'capsule-guess' | 'daily-oracle' | 'memory-flip';

export type VoiceAvailability =
  | 'unavailable'
  | 'not-configured'
  | 'ready'
  | 'error';

export type VoiceAutoPlayMode = 'never' | 'short-only' | 'always';

export interface CharacterProfile {
  id: string;
  name: string;
  avatarAssetId?: string;
  coverAssetId?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  /** Tab 1 — 基本資料 */
  subtitle: string;
  /** 一句身份 (replaces UI label for subtitle field) */
  shortIdentity?: string;
  /** 別名 */
  alias?: string;
  description: string;
  greeting: string;
  /** Tab 2 — 人格與語氣 */
  personality: string;
  /** 核心人格體系 */
  corePersonality?: string;
  speakingStyle: string;
  /** 情緒表達 */
  emotionalExpression?: string;
  /** 價值觀 */
  values?: string;
  /** 界限 */
  boundaries?: string;
  /** 常用語 */
  commonTerms?: string;
  /** 語氣強度 1-10 */
  toneStrength?: number;
  /** Tab 3 — 關係與背景 */
  relationship: string;
  /** 與使用者的關係（new field supersedes `relationship` UI label） */
  relationshipToUser?: string;
  /** 背景 */
  background?: string;
  scenario: string;
  /** 目前對話情境（new field supersedes `scenario` UI label） */
  currentSituation?: string;
  /** 對使用者的稱呼 */
  userAddress?: string;
  /** 關係界限 */
  relationshipBoundaries?: string;
  /** 已知事實 */
  knownFacts?: string;
  /** 未知事項 */
  unknownFacts?: string;
  /** Tab 4 — 模型與記憶 */
  folderId: string;
  tags: string[];
  capabilities: string[];
  modelProfileId?: string;
  /** 模型模式：global 沿用全局 | custom 自訂 */
  modelMode?: 'global' | 'custom';
  /** 自訂 Provider ID */
  providerId?: string;
  /** 自訂 Model ID */
  modelId?: string;
  /** temperature */
  temperature?: number;
  /** max output tokens */
  maxOutput?: number;
  /** 工具權限清單 */
  toolPermissions?: string[];
  memoryPolicyId?: string;
  /** 記憶讀取權限 */
  memoryReadEnabled?: boolean;
  /** 記憶寫入權限 */
  memoryWriteEnabled?: boolean;
  /** 允許讀取的世界書 ID */
  allowedWorldBookIds?: string[];
  /** 允許使用的技能 ID */
  allowedSkillIds?: string[];
  /** 記憶範圍 */
  memoryScope?: 'shared' | 'conversation_only' | 'character_only';
  /** Tab 5 — 進階 */
  systemPrompt: string;
  /** 上下文預覽（AI 生成） */
  contextPreview?: string;
  /** 語音設定 ID */
  voiceProfileId?: string;
  /** 公開身份設定 */
  publicPersonaSettings?: {
    isPublic: boolean;
    publicName?: string;
    publicDescription?: string;
  };
  /** 敏感資料權限 */
  sensitiveDataPermissions?: {
    health?: boolean;
    period?: boolean;
    finance?: boolean;
    privateJournal?: boolean;
    preciseLocation?: boolean;
    otherCharacterSessions?: boolean;
  };
  /** 角色版本號 */
  characterVersion?: number;
  isBuiltIn: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface UserPersonaProfile {
  id: string;
  name: string;
  avatarAssetId?: string;
  subtitle: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterFolder {
  id: string;
  name: string;
  order: number;
  isSystem?: boolean;
}

export interface CharacterVoiceProfile {
  enabled: boolean;
  provider?: 'openai' | 'elevenlabs' | 'minimax' | 'azure' | 'local' | 'custom';
  model?: string;
  modelId?: string;
  voiceId?: string;
  voiceName?: string;
  speakerId?: string;
  language?: string;
  speed?: number;
  pitch?: number;
  autoPlayMode?: VoiceAutoPlayMode;
  availability?: VoiceAvailability;
  lastTestError?: string;
  autoPlay?: boolean;
  emotionStyle?: string;
}

export interface ConversationSummary {
  summary: string;
  topics: string[];
  updatedAt: number;
  messageCount: number;
}

export interface ChatProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  customTitle?: string;
  /** Optional Chat Project membership. Conversation remains the sole membership owner. */
  projectId?: string;
  /** Persona/character references; profile records remain conversation-independent. */
  userPersonaId?: string;
  characterIds?: string[];
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  unread?: number;
  /** ISO timestamp of when the *local user* last marked this conversation read (badge clear). */
  lastReadAt?: string;
  pinned?: boolean;
  archived?: boolean;
  /** Auto-generated title flag: true until user manually renames. */
  autoTitle?: boolean;
  /** Conversation-level short-term memory, updated every 20 messages. */
  summary?: ConversationSummary;
  kind?: 'direct' | 'group';
  type?: 'direct' | 'group';
  avatarUrl?: string;
  /** IndexedDB-backed custom group avatar. Never stores image data in Zustand. */
  avatarAssetId?: string;
  avatarCrop?: {
    x: number;
    y: number;
    zoom: number;
  };
  announcement?: string;
  participantIds?: string[];
  participants?: ChatParticipant[];
  /** Identity-based participant refs (new conversations). Conversations use identityId references only. */
  groupParticipants?: GroupParticipant[];
  /** Group-scoped directed relationships between participants. */
  groupRelationships?: GroupRelationship[];
  currentSpeakerParticipantId?: string;
  /** Presentation-only reading lens; independent from speaking and responder identity. */
  currentPerspectiveParticipantId?: string;
  /** Group-scoped permission. Identity-level allowManualSpeaking is still enforced. */
  manualSpeakerSwitchingEnabled?: boolean;
  replyPolicy?: GroupReplyPolicy;
  muted?: boolean;
  savedToContacts?: boolean;
  draft?: string;
  /**
   * Per-participant read cursors (single source of truth for read receipts).
   * Key = participantId. For direct chats, use a synthetic key (e.g. 'luna').
   * Local read receipt only — not synced with remote users.
   */
  participantReadCursors?: Record<string, { lastReadMessageId: string; lastReadAt: number }>;
  statusConfig?: {
    mode: 'auto' | 'custom';
    customText?: string;
    expiresAt?: number;
    updatedAt: number;
  };
  /** Soft delete (Daily Cache Phase 2). */
  deletedAt?: number;
  purgeAt?: number;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string; // base64
  lastSeen?: string;
  ai?: boolean;
  chatBgImg?: string;
  createdAt?: string;
}

// ================================================================
// Music
// ================================================================

export interface MusicTrack {
  id: string;
  title: string;
  /** User-editable display name. Falls back to title if empty. */
  displayName?: string;
  /** Optional artist parsed from imported filenames. Existing records may omit it. */
  artist?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  assetId: string;
  duration?: number; // seconds, set after audio metadata loads
  createdAt: number;
  /** User-uploaded cover image as data URL. Falls back to generated pixel cover. */
  customCover?: string;
}

export interface MusicState {
  tracks: MusicTrack[];
  currentTrackId?: string;
  volume: number; // 0-1
  loop: boolean;
}

// ================================================================
// Voice / Suno Clips — AI-generated audio for the floating player
// ================================================================

/** Where a voice/Suno clip came from — drives the badge in the floating player. */
export type VoiceClipSource = 'suno' | 'ai-voice' | 'tts';

export interface VoiceClip {
  id: string;
  /** Display title shown in the floating player. */
  title: string;
  /** Optional subtitle, e.g. provider name or prompt snippet. */
  subtitle?: string;
  /** Origin of the clip — controls the badge icon/label. */
  source: VoiceClipSource;
  /** Playable URL (object URL or remote). */
  url: string;
  /** Seconds; filled in after metadata loads. */
  duration?: number;
  createdAt: number;
  /** Optional cover image as data URL. */
  cover?: string;
}

// ================================================================
// Drawer & Modal IDs
// ================================================================

export type DrawerId =
  | 'calendar-create'
  | 'todo'
  | 'countdown'
  | 'event'
  | 'icon-editor'
  | 'ai-config'
  | 'qj-export'
  | 'attachment'
  | 'clawd';


export type ModalId =
  | 'message-action-sheet'
  | 'menu-modal'
  | 'icon-cropper'
  | 'danger-zone';

// ================================================================
// Provider Center
// ================================================================

export type ProviderType =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'glm'
  | 'minimax'
  | 'openrouter'
  | 'ollama'
  | 'groq'
  | 'siliconflow'
  | 'custom';

export type ProviderConnectionStatus = 'untested' | 'connected' | 'failed';

export type AiRole = 'chat' | 'vision' | 'embedding' | 'speech';

export interface RoleConfig {
  providerId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  streaming: boolean;
  thinkingUi: boolean;
}

export type AiRolesMap = Record<AiRole, RoleConfig>;

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  streamingEnabled: boolean;
  thinkingUiEnabled: boolean;
  temperature: number;
  maxTokens: number;
  contextMessageLimit: number;
  modelsEndpoint: string;
  chatEndpoint: string;
  connectionStatus?: ProviderConnectionStatus;
  lastTestedAt?: number;
  lastTestLatencyMs?: number;
  lastConnectionError?: string;
  createdAt: number;
  updatedAt: number;
  credentialId?: string;
  hasCredential?: boolean;
  credentialUpdatedAt?: number;
}

// ================================================================
// MCP Connections
// ================================================================

export interface MCPConnection {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  transport: 'streamable-http' | 'sse';
  serverUrl: string;
  headers?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// ================================================================
// Agent Runtime Log & Tools Center
// ================================================================

export type AgentToolType = 'moonread' | 'memory' | 'web_search' | 'file_reader' | 'custom_http';

export interface AgentTool {
  id: string;
  name: string;
  type: AgentToolType;
  enabled: boolean;
  description: string;
  endpoint: string;
  headers: Record<string, string>;
  allowedPresets: string[];
  requireConfirmation: boolean;
}

/* ── Emotion Reward System — user-defined reward rules ── */

export type RewardRarity = 'gentle' | 'warm' | 'rare' | 'luminous';

export interface RewardRule {
  id: string;
  name: string;
  emoji: string;
  /** Rule fires when current state matches these conditions. Empty = always match. */
  condition: {
    moodMin?: number;      // minimum moodBias [-1.0, 1.0]
    moodMax?: number;
    driftState?: 'calm' | 'balanced' | 'warm';
    streakMin?: number;    // minimum consecutive days
    streakMax?: number;
  };
  rewardContent: string;   // the reward text shown to user
  moodDelta: number;       // effect on moodBias [-1.0, 1.0]
  driftDelta: number;      // effect on personalityDrift [-0.5, 0.5]
  rarity: RewardRarity;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AgentLogStatus = 'idle' | 'thinking' | 'calling_tool' | 'completed' | 'failed';

export interface AgentRuntimeStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'skipped' | 'error';
  startedAt?: number;
  finishedAt?: number;
  detail?: string;
}

export interface AgentToolCall {
  id: string;
  toolId: string;
  toolName: string;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface AgentRuntimeLog {
  id: string;
  requestId: string;
  messageId: string;
  presetId: string;
  providerId: string;
  model: string;
  startedAt: number;
  finishedAt?: number;
  status: AgentLogStatus;
  /** Safe-to-display reasoning summary — never raw chain-of-thought */
  visibleReasoningSummary: string;
  steps: AgentRuntimeStep[];
  toolCalls: AgentToolCall[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    estimated: boolean;
  };
  costEstimate: number;
  error?: string;
  /** Source context: 'moonread' | 'chat' | 'diary' | 'memory' */
  source: string;
}

// ================================================================
// Gacha System
// ================================================================

export type GachaProbabilityMode = 'equal' | 'weighted';
export type GachaDrawMode = 'withReplacement' | 'withoutReplacement';
export type GachaRevealMode = 'open' | 'mystery';
export type GachaMachineSkin = 'coral-cream' | 'moonlight' | 'teal-mint';

export interface GachaItem {
  id: string;
  poolId: string;
  title: string;
  content?: string;
  imageAssetId?: string;
  accent?: string;
  weight: number;
  enabled: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GachaPool {
  id: string;
  name: string;
  description?: string;
  coverAssetId?: string;
  probabilityMode: GachaProbabilityMode;
  drawMode: GachaDrawMode;
  revealMode: GachaRevealMode;
  machineSkin: GachaMachineSkin;
  itemIds: string[];
  lastUsedAt?: number;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface GachaDrawRecord {
  id: string;
  poolId: string;
  itemId: string;
  poolNameSnapshot: string;
  titleSnapshot: string;
  contentSnapshot?: string;
  imageAssetIdSnapshot?: string;
  probabilitySnapshot: number;
  drawnAt: number;
  favorited: boolean;
  sentToChatAt?: number;
  messageId?: string;
}

export interface GachaChatContext {
  sourceType: 'gacha';
  recordId: string;
  poolId: string;
  itemId: string;
  poolNameSnapshot: string;
  titleSnapshot: string;
  contentSnapshot?: string;
  imageAssetRef?: string;
  drawnAt: number;
  probabilitySnapshot: number;
}

// ================================================================
// Component Props
// ================================================================

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ================================================================
// Object Lifecycle Memory System
// ──────────────────────────────────────────────────────────────
// NOT an inventory/stock system. This models the *emotional lifecycle*
// of physical objects: how long they've accompanied the user, when they
// are aging out, when they've entered farewell, and when they've retired. No quantities.
// ================================================================

/** Lifecycle stage of a tracked object. */
export type ObjectLifecycleState = 'active' | 'aging' | 'farewell' | 'retired';

/** Emotional tone of a lifecycle narrative event. */
export type ObjectLifecycleEmotion =
  | 'neutral'
  | 'warm'
  | 'fond'
  | 'bittersweet'
  | 'grateful'
  | 'sad'
  | 'ready';

/** A lifecycle transition event attached to an object and mirrored in the store log. */
export interface ObjectLifecycleEvent {
  id: string;
  objectId: string;
  from?: ObjectLifecycleState;
  to: ObjectLifecycleState;
  action: 'created' | 'transitioned' | 'edited';
  /** Why this state changed. */
  reason: string;
  /** User sentiment captured for the event. */
  emotion: ObjectLifecycleEmotion;
  /** Optional usage situation around the transition. */
  context?: string;
  /** Human-readable memory text. */
  note?: string;
  createdAt: number;
}

/** A single usage / context log entry attached to an object. */
export interface ObjectUsageLog {
  id: string;
  /** ISO date string (YYYY-MM-DD) when this log was recorded. */
  date: string;
  /** What happened — "used for morning coffee", "brought on trip to Kyoto", etc. */
  note: string;
  /** Optional emotional tone tag. */
  mood?: 'warm' | 'neutral' | 'tired' | 'fond' | 'bittersweet';
}

/** A tracked physical object with lifecycle + emotional metadata. */
export interface ObjectMemory {
  id: string;
  name: string;
  /** Optional image URL (object URL, data URL, or remote). */
  image?: string;
  /** User-defined category, e.g. "杯具", "書籍", "電子產品". */
  category: string;
  /** Current lifecycle state. */
  lifecycleState: ObjectLifecycleState;
  /** ISO date when the object entered the user's life. */
  startDate: string;
  /** ISO date when it was retired (only if state === 'retired'). */
  endDate?: string;
  /** Computed usage days from startDate → today (or endDate). Stored for quick display. */
  usageDays: number;
  /** Emotional or contextual notes. */
  notes: string;
  /** Chronological usage / context log entries. */
  usageLogs: ObjectUsageLog[];
  /** Chronological lifecycle state changes. */
  lifecycleEvents: ObjectLifecycleEvent[];
  createdAt: number;
  updatedAt: number;
}

// ================================================================
// Photo Wall
// ================================================================

export interface JournalImageRef {
  photoId: string;
  caption?: string;
  order: number;
}

export interface PhotoEntry {
  id: string;
  imageData: string;
  caption: string;
  date: string;
  time: string;
  rotation: number;
  offsetX: number;
  offsetY: number;
  fromNoteId?: string;
  pinColor: string;
  aspectRatio: 'square' | 'portrait' | 'landscape';
  createdAt: number;
}
