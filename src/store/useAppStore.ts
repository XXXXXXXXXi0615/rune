import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppData, UsageData, TextMessage, ImageMessage, FileMessage, MemoryEntry, DiaryEntry, TodoItem, CountdownItem, MusicTrack, MemoryLocationPlace, HealthRecord, ChatPresenceStatus, ActivityLogEntry } from '@/types';
import { deleteAsset } from '@/store/assets';
import { useToastStore } from '@/store/useToastStore';
import { STORAGE_KEY, createDefaultStore, normalizeStore } from '@/store/storage';
import { t } from '@/i18n';
import { sendChatMessage } from '@/ai/client';
import { buildSystemPrompt } from '@/ai/prompts';
import { buildMemoryContext } from '@/ai/memoryContext';
import { retrieveRelevantMemories } from '@/ai/retrieveMemories';
import type { RetrievalResult } from '@/ai/retrieveMemories';
import type { ChatMessage } from '@/ai/types';
import { loadTools, saveTools } from '@/config/agentTools';
import { generateMemorySummary, detectMemoryCategory } from '@/ai/memorySummary';

let _abortController: AbortController | null = null;

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

const initialState: AppData & { aiTyping: boolean } = {
  ...createDefaultStore(),
  agentTools: loadTools(),
  aiTyping: false,
};

interface AppActions {
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setAccentColor: (color: 'coral' | 'teal' | 'lavender' | 'amber' | 'rose') => void;
  setLanguage: (language: 'zh-TW' | 'en') => void;
  updateProfile: (data: Partial<AppData['profile']>) => void;
  updatePartner: (data: Partial<AppData['partner']>) => void;
  setChatContactStatus: (id: string, status: ChatPresenceStatus) => void;
  updateSettings: (data: Partial<AppData>) => void;
  clearAllData: () => Promise<void>;
  sendText: (content: string) => void;
  sendImage: (assetId: string, fileType: string, opts?: { fileName?: string; fileSize?: number; caption?: string }) => void;
  sendFile: (assetId: string, fileName: string, fileSize: number, fileType: string) => void;
  deleteMessage: (id: string) => void;
  revokeMessage: (id: string) => void;
  addMemoryEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>) => string;
  addLocation: (location: Omit<MemoryLocationPlace, 'id' | 'createdAt' | 'updatedAt'>) => string;
  deleteMemoryEntry: (id: string) => void;
  updateMemoryEntry: (id: string, patch: Partial<MemoryEntry>) => void;
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteDiaryEntry: (id: string) => void;
  addTodo: (entry: Omit<TodoItem, 'id' | 'completed' | 'createdAt' | 'updatedAt'>) => void;
  updateTodo: (id: string, patch: Partial<Omit<TodoItem, 'id' | 'createdAt'>>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
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
  addSticker: (name: string, url: string, assetId?: string) => void;
  deleteSticker: (id: string) => void;
  sendAiMessage: (content: string) => Promise<void>;
  abortAiGeneration: () => void;
  addActivityLog: (entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'read'>) => void;
  markActivityRead: (id: string) => void;
  clearActivityLogs: () => void;
  saveDailyTarot: (spread: import('@/types').TarotSpread, cards: import('@/types').TarotDrawCard[]) => void;
  resetDailyTarot: () => void;
  toggleTool: (toolId: string) => void;
  addRuntimeLog: (log: import('@/types').AgentRuntimeLog) => void;
  addProvider: (provider: import('@/types').ProviderConfig) => void;
  updateProvider: (id: string, patch: Partial<import('@/types').ProviderConfig>) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
}

export const useAppStore = create<AppData & AppActions & { aiTyping: boolean }>()(
  persist(
    (set) => ({
      ...initialState,

      setTheme: (theme) => set({ theme }),

      setAccentColor: (color) => set({ accentColor: color }),

      setLanguage: (language) => set({ language }),

      updateProfile: (data) =>
        set((s) => ({
          profile: { ...s.profile, ...data },
        })),

      updatePartner: (data) =>
        set((s) => ({
          partner: { ...s.partner, ...data },
        })),

      setChatContactStatus: (id, status) =>
        set((state) => {
          const contact = state.chatContacts.find((c) => c.id === id);
          const activityLog = contact && contact.status !== status
            ? makeActivityLog('chat', `Luna 狀態切換為「${t(`chat.presence.${status}`)}」`, { route: '/chat/luna', level: 'info' })
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

      clearAllData: async () => {
        // Delete all assets from IndexedDB
        const { deleteAssets } = await import('@/store/assets');
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
        // Clear Zustand persist
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      },

      sendText: (content) =>
        set((s) => {
          const msg: TextMessage = {
            id: crypto.randomUUID(),
            sender: 'me',
            type: 'text',
            content,
            time: new Date().toISOString(),
            status: 'sent',
          };
          return { messages: [...s.messages, msg], ...usageDelta(s.usage, 1, 'chat:send') };
        }),

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
          };
          return { messages: [...s.messages, msg], ...usageDelta(s.usage, 1, 'chat:image') };
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
          };
          return { messages: [...s.messages, msg], ...usageDelta(s.usage, 1, 'chat:file') };
        }),

      addMemoryEntry: (entry) =>
        set((s) => {
          const now = Date.now();
          const summary = generateMemorySummary(entry.scene);
          const category = detectMemoryCategory(entry.scene, entry.triggerText);
          const item: MemoryEntry = {
            ...entry,
            summary,
            category,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('memory', `新增記憶：${summary}`, { route: '/memory', level: 'info' });
          return {
            memoryEntries: [item, ...s.memoryEntries],
            ...usageDelta(s.usage, 1, 'memory:add'),
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

      addHealthRecord: (record) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set((state) => {
          const activityLog = makeActivityLog('health', '匯入睡眠記錄', { route: '/memory', level: 'info' });
          return {
            healthRecords: [{ ...record, id, createdAt: now, updatedAt: now }, ...state.healthRecords],
            activityLogs: [activityLog, ...(state.activityLogs || [])].slice(0, 200),
          };
        });
        return id;
      },

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
            healthRecords: entry?.healthRecordId
              ? s.healthRecords.filter((record) => record.id !== entry.healthRecordId)
              : s.healthRecords,
          };
        }),

      updateMemoryEntry: (id, patch) =>
        set((s) => ({
          memoryEntries: s.memoryEntries.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e
          ),
        })),

      addDiaryEntry: (entry) =>
        set((s) => {
          const now = Date.now();
          const item: DiaryEntry = {
            ...entry,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
          };
          return { diaryEntries: [item, ...(s.diaryEntries || [])] };
        }),

      deleteDiaryEntry: (id) =>
        set((s) => ({
          diaryEntries: (s.diaryEntries || []).filter((e) => e.id !== id),
        })),

      addTodo: (entry) =>
        set((s) => {
          const now = Date.now();
          const item: TodoItem = {
            ...entry,
            id: crypto.randomUUID(),
            completed: false,
            createdAt: now,
            updatedAt: now,
          };
          const activityLog = makeActivityLog('todo', `新增待辦：${entry.title}`, { route: '/calendar', level: 'info' });
          return { todos: [item, ...s.todos], activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200) };
        }),

      updateTodo: (id, patch) =>
        set((s) => ({
          todos: s.todos.map((todo) =>
            todo.id === id
              ? { ...todo, ...patch, updatedAt: Date.now() }
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
          return result as { todos: typeof updated; activityLogs?: typeof s.activityLogs };
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

      deleteMessage: (id) => {
        const msg = useAppStore.getState().messages.find((m) => m.id === id);
        if (msg && (msg.type === 'image' || msg.type === 'file')) {
          deleteAsset(msg.assetId).catch(() => {});
        }
        set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
      },

      revokeMessage: (id) =>
        set((s) => {
          const msg = s.messages.find((m) => m.id === id);
          if (!msg || msg.sender !== 'me') return s;
          const activityLog = makeActivityLog('chat', '撤回了一則聊天訊息', { level: 'warning' });
          return {
            messages: s.messages.map((m) =>
              m.id === id
                ? { ...m, revoked: true, revokedAt: new Date().toISOString(), originalType: m.type }
                : m,
            ),
            activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200),
          };
        }),

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

        // 1. Add user message
        const userMsg: TextMessage = {
          id: crypto.randomUUID(),
          sender: 'me',
          type: 'text',
          content,
          time: new Date().toISOString(),
          status: 'sent',
        };
        set((s) => ({ messages: [...s.messages, userMsg], aiTyping: true }));

        // 2. Retrieve memory context
        const mcEnabled = state.aiConfig.memoryContextEnabled !== false;
        let memoryContext = '';
        let retrievalResult: RetrievalResult = { entries: [], mode: 'skip' };
        if (mcEnabled) {
          retrievalResult = retrieveRelevantMemories({
            entries: state.memoryEntries,
            currentMessage: content,
          });
          memoryContext = buildMemoryContext(retrievalResult.entries);
          console.debug('[AI] memory context', {
            enabled: true,
            mode: retrievalResult.mode,
            retrieved: retrievalResult.entries.length,
            totalEntries: state.memoryEntries.length,
            chars: memoryContext.length,
          });
        } else {
          console.debug('[AI] memory context', { enabled: false });
        }
        const systemPrompt = buildSystemPrompt(state.aiConfig.systemPrompt, memoryContext);
        const chatMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
        ];
        const currentMessages = useAppStore.getState().messages;
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
        set((s) => ({ messages: [...s.messages, assistantMsg] }));

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
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullContent }
                  : m,
              ),
            }));
          }
          if (!fullContent) {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: '沒有收到回覆' }
                  : m,
              ),
            }));
          } else {
            // Successful AI reply: +2 usage
            set((s) => ({ ...usageDelta(s.usage, 2, 'ai:reply') }));
          }
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // User aborted — partial content already saved
          } else {
            const message = err instanceof Error ? err.message : 'AI 請求失敗';
            useToastStore.getState().showToast(message);
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: message }
                  : m,
              ),
            }));
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

      addRuntimeLog: (log) =>
        set((s) => {
          const activityLog = log.source === 'moonread' && log.status === 'completed'
            ? makeActivityLog('chat', '月讀室 Luna 完成一次分析', { route: '/moon-reading', level: 'info' })
            : null;
          return {
            agentRuntimeLogs: [...(s.agentRuntimeLogs || []), log].slice(-200),
            ...(activityLog ? { activityLogs: [activityLog, ...(s.activityLogs || [])].slice(0, 200) } : {}),
          };
        }),

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
    }),
    {
      name: STORAGE_KEY,
      merge: (persisted, current) => ({
        ...current,
        ...normalizeStore(persisted as Partial<AppData>),
      }),
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { aiTyping, ...rest } = state;
        return rest;
      },
    }
  )
);
