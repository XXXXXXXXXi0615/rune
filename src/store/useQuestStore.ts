import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppStore } from '@/store/useAppStore';
import { toLocalDateString } from '@/utils/date';
import type { TodoItem } from '@/types';

export type QuestStatus = 'available' | 'claimed' | 'in_progress' | 'completed' | 'abandoned' | 'archived';
export type QuestPriority = 'low' | 'medium' | 'high';
export type QuestRewardTier = 'light' | 'normal' | 'large';

export interface QuestSubtask { id: string; title: string; completed: boolean }
export interface QuestRecurrence { frequency: 'daily' | 'weekly' | 'monthly'; interval: number }

export interface Quest {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  priority: QuestPriority;
  status: QuestStatus;
  dueAt?: string;
  estimatedMinutes?: number;
  subtasks: QuestSubtask[];
  recurrence?: QuestRecurrence;
  reminderAt?: string;
  note?: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;
  focusedMinutes: number;
  linkedFocusSessionIds: string[];
  rewardTier: QuestRewardTier;
  rewardSettledAt?: string;
  rewardLedgerEntryId?: string;
  rewardReversedAt?: string;
  source: 'manual' | 'calendar_migration' | 'system';
  legacyTodoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestMigrationResult { sourceCount: number; migratedCount: number; failedCount: number; skippedCount: number }

interface QuestState {
  quests: Quest[];
  questMigrationVersion: number;
  mainQuestByDate: Record<string, string>;
  createQuest: (draft: Partial<Quest> & Pick<Quest, 'title'>) => string;
  ensureSystemQuest: (key: string, draft: Pick<Quest, 'title'> & Partial<Quest>) => string;
  updateQuest: (id: string, patch: Partial<Quest>) => void;
  deleteQuest: (id: string) => void;
  claimQuest: (id: string) => void;
  unclaimQuest: (id: string) => void;
  startQuest: (id: string) => void;
  completeQuest: (id: string) => boolean;
  undoCompletion: (id: string) => boolean;
  toggleQuestCompletion: (id: string) => boolean;
  abandonQuest: (id: string) => void;
  archiveQuest: (id: string) => void;
  restoreQuest: (id: string) => void;
  toggleSubtask: (questId: string, subtaskId: string) => void;
  linkFocusSession: (questId: string, sessionId: string, minutes: number) => boolean;
  setMainQuest: (id: string | null, date?: string) => void;
  migrateLegacyTodos: (todos: TodoItem[]) => QuestMigrationResult;
}

const STATUSES: QuestStatus[] = ['available', 'claimed', 'in_progress', 'completed', 'abandoned', 'archived'];
const PRIORITIES: QuestPriority[] = ['low', 'medium', 'high'];
const TIERS: QuestRewardTier[] = ['light', 'normal', 'large'];
const REWARDS: Record<QuestRewardTier, number> = { light: 2, normal: 5, large: 10 };
const QUEST_DAILY_CAP = 20;
const MIGRATION_VERSION = 1;

function validIso(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function uniqueStrings(value: unknown): string[] {
  return Array.from(new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []));
}

export function normalizeQuest(input: Partial<Quest>, fallbackId: string = crypto.randomUUID()): Quest {
  const now = new Date().toISOString();
  const subtasks = Array.isArray(input.subtasks) ? input.subtasks.map((item, index) => ({
    id: typeof item?.id === 'string' && item.id ? item.id : `${fallbackId}:subtask:${index}`,
    title: typeof item?.title === 'string' ? item.title.slice(0, 200) : '',
    completed: Boolean(item?.completed),
  })).filter((item) => item.title) : [];
  return {
    id: typeof input.id === 'string' && input.id ? input.id : fallbackId,
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 240) : '未命名任務',
    description: typeof input.description === 'string' ? input.description : undefined,
    categoryId: typeof input.categoryId === 'string' ? input.categoryId : undefined,
    priority: PRIORITIES.includes(input.priority as QuestPriority) ? input.priority! : 'medium',
    status: STATUSES.includes(input.status as QuestStatus) ? input.status! : 'available',
    dueAt: validIso(input.dueAt),
    estimatedMinutes: Number.isFinite(input.estimatedMinutes) ? Math.max(1, Math.round(input.estimatedMinutes!)) : undefined,
    subtasks,
    recurrence: input.recurrence && ['daily', 'weekly', 'monthly'].includes(input.recurrence.frequency)
      ? { frequency: input.recurrence.frequency, interval: Math.max(1, Math.round(input.recurrence.interval || 1)) }
      : undefined,
    reminderAt: validIso(input.reminderAt),
    note: typeof input.note === 'string' ? input.note : undefined,
    claimedAt: validIso(input.claimedAt),
    startedAt: validIso(input.startedAt),
    completedAt: validIso(input.completedAt),
    focusedMinutes: Number.isFinite(input.focusedMinutes) ? Math.max(0, Math.round(input.focusedMinutes!)) : 0,
    linkedFocusSessionIds: uniqueStrings(input.linkedFocusSessionIds),
    rewardTier: TIERS.includes(input.rewardTier as QuestRewardTier) ? input.rewardTier! : 'normal',
    rewardSettledAt: validIso(input.rewardSettledAt),
    rewardLedgerEntryId: typeof input.rewardLedgerEntryId === 'string' ? input.rewardLedgerEntryId : undefined,
    rewardReversedAt: validIso(input.rewardReversedAt),
    source: ['manual', 'calendar_migration', 'system'].includes(input.source || '') ? input.source! : 'manual',
    legacyTodoId: typeof input.legacyTodoId === 'string' ? input.legacyTodoId : undefined,
    createdAt: validIso(input.createdAt) || now,
    updatedAt: validIso(input.updatedAt) || now,
  };
}

function todoDueAt(todo: TodoItem): string | undefined {
  const date = todo.dueDate || todo.date;
  if (!date) return undefined;
  const parsed = new Date(`${date}T${todo.dueTime || todo.time || '23:59'}:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function todayQuestEarned(): number {
  const today = toLocalDateString();
  return (useAppStore.getState().moonDewLedger || []).reduce((sum, entry) => {
    return entry.source === 'quest' && entry.amount > 0 && toLocalDateString(new Date(entry.createdAt)) === today ? sum + entry.amount : sum;
  }, 0);
}

export const useQuestStore = create<QuestState>()(persist((set, get) => ({
  quests: [],
  questMigrationVersion: 0,
  mainQuestByDate: {},
  createQuest: (draft) => {
    const id = crypto.randomUUID();
    const quest = normalizeQuest({ ...draft, id, source: draft.source || 'manual' }, id);
    set((state) => ({ quests: [quest, ...state.quests] }));
    return id;
  },
  ensureSystemQuest: (key, draft) => {
    const id = `system:tiderail:${key}`;
    if (get().quests.some((quest) => quest.id === id)) return id;
    const quest = normalizeQuest({ ...draft, id, source: 'system' }, id);
    set((state) => ({ quests: [quest, ...state.quests] }));
    return id;
  },
  updateQuest: (id, patch) => set((state) => ({ quests: state.quests.map((quest) => quest.id === id ? normalizeQuest({ ...quest, ...patch, id, updatedAt: new Date().toISOString() }, id) : quest) })),
  deleteQuest: (id) => set((state) => ({ quests: state.quests.filter((quest) => quest.id !== id) })),
  claimQuest: (id) => get().updateQuest(id, { status: 'claimed', claimedAt: new Date().toISOString() }),
  unclaimQuest: (id) => get().updateQuest(id, { status: 'available', claimedAt: undefined, startedAt: undefined }),
  startQuest: (id) => get().updateQuest(id, { status: 'in_progress', startedAt: new Date().toISOString(), claimedAt: get().quests.find((q) => q.id === id)?.claimedAt || new Date().toISOString() }),
  completeQuest: (id) => {
    const quest = get().quests.find((item) => item.id === id);
    if (!quest || quest.status === 'completed') return false;
    const now = new Date().toISOString();
    let rewardSettledAt = quest.rewardSettledAt;
    let rewardLedgerEntryId = quest.rewardLedgerEntryId;
    if (!rewardSettledAt && quest.source !== 'calendar_migration') {
      const requested = REWARDS[quest.rewardTier] + (get().mainQuestByDate[toLocalDateString()] === id ? 3 : 0);
      const applied = Math.max(0, Math.min(requested, QUEST_DAILY_CAP - todayQuestEarned()));
      const key = `quest:${id}:completion`;
      const added = useAppStore.getState().addMoonDewEntry({
        amount: applied,
        source: 'quest',
        reasonCode: 'quest_completion',
        title: `完成任務：${quest.title}`,
        relatedEntityId: id,
        idempotencyKey: key,
        metadata: { requestedAmount: requested, appliedAmount: applied, rewardTier: quest.rewardTier },
      });
      const entry = useAppStore.getState().moonDewLedger.find((item) => item.idempotencyKey === key);
      if (added || entry) {
        rewardSettledAt = now;
        rewardLedgerEntryId = entry?.id;
      }
    }
    get().updateQuest(id, { status: 'completed', completedAt: now, rewardSettledAt, rewardLedgerEntryId });
    return true;
  },
  undoCompletion: (id) => {
    const quest = get().quests.find((item) => item.id === id);
    if (!quest?.completedAt || Date.now() - Date.parse(quest.completedAt) > 8000 || quest.rewardReversedAt) return false;
    if (quest.rewardLedgerEntryId) useAppStore.getState().reverseMoonDewEntry(quest.rewardLedgerEntryId, `撤銷任務完成：${quest.title}`);
    get().updateQuest(id, { status: quest.startedAt ? 'in_progress' : quest.claimedAt ? 'claimed' : 'available', completedAt: undefined, rewardReversedAt: new Date().toISOString() });
    return true;
  },
  toggleQuestCompletion: (id) => {
    const quest = get().quests.find((item) => item.id === id);
    if (!quest) return false;
    if (quest.status !== 'completed') return get().completeQuest(id);

    if (quest.rewardLedgerEntryId && !quest.rewardReversedAt) {
      useAppStore.getState().reverseMoonDewEntry(quest.rewardLedgerEntryId, `撤銷任務完成：${quest.title}`);
    }
    get().updateQuest(id, {
      status: quest.startedAt ? 'in_progress' : quest.claimedAt ? 'claimed' : 'available',
      completedAt: undefined,
      rewardReversedAt: quest.rewardReversedAt || new Date().toISOString(),
    });
    return true;
  },
  abandonQuest: (id) => get().updateQuest(id, { status: 'abandoned' }),
  archiveQuest: (id) => get().updateQuest(id, { status: 'archived' }),
  restoreQuest: (id) => get().updateQuest(id, { status: 'available' }),
  toggleSubtask: (questId, subtaskId) => set((state) => ({ quests: state.quests.map((quest) => quest.id === questId ? { ...quest, subtasks: quest.subtasks.map((subtask) => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask), updatedAt: new Date().toISOString() } : quest) })),
  linkFocusSession: (questId, sessionId, minutes) => {
    const quest = get().quests.find((item) => item.id === questId);
    if (!quest || quest.linkedFocusSessionIds.includes(sessionId)) return false;
    get().updateQuest(questId, { focusedMinutes: quest.focusedMinutes + Math.max(0, Math.round(minutes)), linkedFocusSessionIds: [...quest.linkedFocusSessionIds, sessionId] });
    return true;
  },
  setMainQuest: (id, date = toLocalDateString()) => set((state) => ({ mainQuestByDate: id ? { ...state.mainQuestByDate, [date]: id } : Object.fromEntries(Object.entries(state.mainQuestByDate).filter(([key]) => key !== date)) })),
  migrateLegacyTodos: (todos) => {
    const existing = new Set(get().quests.map((quest) => quest.legacyTodoId).filter(Boolean));
    const migrated: Quest[] = [];
    let failedCount = 0; let skippedCount = 0;
    for (const todo of Array.isArray(todos) ? todos : []) {
      if (!todo?.id || !todo.title) { failedCount += 1; continue; }
      if (existing.has(todo.id)) { skippedCount += 1; continue; }
      try {
        migrated.push(normalizeQuest({
          id: `todo:${todo.id}`,
          title: todo.title,
          description: todo.notes,
          categoryId: todo.category,
          priority: todo.priority,
          status: todo.completed ? 'completed' : 'available',
          dueAt: todoDueAt(todo),
          recurrence: todo.repeat !== 'none' ? { frequency: todo.repeat, interval: 1 } : undefined,
          reminderAt: todo.reminderAt || todo.remindAt,
          source: 'calendar_migration',
          legacyTodoId: todo.id,
          createdAt: new Date(todo.createdAt || Date.now()).toISOString(),
          updatedAt: new Date(todo.updatedAt || todo.createdAt || Date.now()).toISOString(),
          completedAt: todo.completed ? new Date(todo.updatedAt || Date.now()).toISOString() : undefined,
          rewardTier: todo.priority === 'high' ? 'large' : todo.priority === 'low' ? 'light' : 'normal',
        }, `todo:${todo.id}`));
      } catch (error) {
        failedCount += 1;
        console.warn('[TIDEQUEST] Todo migration failed', todo.id, error);
      }
    }
    if (migrated.length) set((state) => ({ quests: [...migrated, ...state.quests], questMigrationVersion: MIGRATION_VERSION }));
    else if (get().questMigrationVersion < MIGRATION_VERSION) set({ questMigrationVersion: MIGRATION_VERSION });
    return { sourceCount: todos?.length || 0, migratedCount: migrated.length, failedCount, skippedCount };
  },
}), {
  name: 'lunartide-quests',
  version: 1,
  partialize: (state) => ({ quests: state.quests, questMigrationVersion: state.questMigrationVersion, mainQuestByDate: state.mainQuestByDate }),
  merge: (persisted, current) => {
    const data = persisted as Partial<QuestState> | undefined;
    const seen = new Set<string>();
    const quests = (Array.isArray(data?.quests) ? data!.quests : []).map((quest) => normalizeQuest(quest)).filter((quest) => !seen.has(quest.id) && !!seen.add(quest.id));
    return { ...current, ...data, quests, mainQuestByDate: data?.mainQuestByDate && typeof data.mainQuestByDate === 'object' ? data.mainQuestByDate : {} };
  },
}));

export function getQuestDateKey(quest: Quest): string | undefined {
  return quest.dueAt ? toLocalDateString(new Date(quest.dueAt)) : undefined;
}

export function getQuestStreak(quests: Quest[], now = new Date()): number {
  const days = new Set(quests.filter((quest) => quest.completedAt).map((quest) => toLocalDateString(new Date(quest.completedAt!))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(toLocalDateString(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(toLocalDateString(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
