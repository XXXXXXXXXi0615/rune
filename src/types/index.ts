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

export interface AppData {
  theme: 'dark' | 'light' | 'system';
  accentColor: 'coral' | 'teal' | 'lavender' | 'amber' | 'rose';
  language: 'zh-TW' | 'en';
  userName: string;
  avatarSize: number;
  bgOpacity: number;
  homeCustomCSS: string;
  profile: ProfileData;
  water: WaterData;
  locations: MemoryLocationPlace[];
  customEvents: CalendarEvent[];
  todos: TodoItem[];
  countdowns: CountdownItem[];
  journalEntries: QuickJournalEntry[];
  memoryEntries: MemoryEntry[];
  healthRecords: HealthRecord[];
  diaryEntries: DiaryEntry[];
  launcherIcons: Record<string, LauncherApp>;
  launcherOrder: string[];
  hiddenLauncherApps: string[];
  aiConfig: AiConfig;
  aiConnection: AiConnectionConfig;
  music: MusicState;
  messages: Message[];
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
  dailyTarot: DailyTarotData;
  tarotHistory: TarotHistoryEntry[];
  agentTools: AgentTool[];
  agentRuntimeLogs: AgentRuntimeLog[];
  providers: ProviderConfig[];
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
  assetId?: string;       // IndexedDB asset key for file-uploaded stickers
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
  name: string;
  status: string;
  avatarInitial: string;
  avatarColor: string;
  avatarImageUrl?: string;
  avatarImage?: AvatarImageMeta;
}

export type ChatPresenceStatus = 'online' | 'invisible' | 'busy' | 'syncing' | 'offline' | 'local' | 'quiet';

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

export type ActivityLogType = 'todo' | 'memory' | 'health' | 'music' | 'chat' | 'settings' | 'system';
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
  latencyMs?: number;
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

export interface WorldBookEntry {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
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
  title: string;
  completed: boolean;
  description: string;
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
  image?: string; // base64
}

export interface TodoItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: 'life' | 'work' | 'study' | 'health' | 'lunartide';
  notes?: string;
  remindAt?: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
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

export type MemoryCategory = 'dialogue' | 'emotion' | 'reading' | 'idea' | 'achievement' | 'system';

export interface MemoryEntry {
  id: string;
  cardType?: 'journal' | 'health' | 'todo';
  healthRecordId?: string;
  scene: string;
  triggerText: string;
  bodyThoughts: string;
  anxietyLevel: number;
  nextStep: string;
  location?: MemoryLocation;
  /** AI-generated one-line summary */
  summary?: string;
  /** Auto-detected category */
  category?: MemoryCategory;
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

// ================================================================
// Chat
// ================================================================

interface BaseMessage {
  id: string;
  sender: 'me' | 'friend' | 'assistant';
  time: string;
  status: 'sent' | 'delivered' | 'read';
  revoked?: boolean;
  revokedAt?: string;
  originalType?: 'text' | 'image' | 'file' | 'sticker';
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
  stickerUrl: string;
  stickerName?: string;
}

export type Message = TextMessage | ImageMessage | FileMessage | StickerMessage;

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
  fileName: string;
  fileSize: number;
  fileType: string;
  assetId: string;
  duration?: number; // seconds, set after audio metadata loads
  createdAt: number;
}

export interface MusicState {
  tracks: MusicTrack[];
  currentTrackId?: string;
  volume: number; // 0-1
  loop: boolean;
}

// ================================================================
// Drawer & Modal IDs
// ================================================================

export type DrawerId =
  | 'calendar-create'
  | 'todo'
  | 'countdown'
  | 'event'
  | 'water'
  | 'icon-editor'
  | 'ai-config'
  | 'qj-export'
  | 'attachment';

export type ModalId =
  | 'message-action-sheet'
  | 'menu-modal'
  | 'icon-cropper'
  | 'danger-zone';

// ================================================================
// Provider Center
// ================================================================

export type ProviderType = 'openai' | 'claude' | 'gemini' | 'deepseek' | 'openrouter' | 'ollama' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
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
