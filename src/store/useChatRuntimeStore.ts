import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GenerationStyle } from '@/ai/modelCapabilities';

/* ── Types ── */

export interface ConversationSummary {
  id: string;
  content: string;
  version: number;
  previousVersion?: string;
  createdAt: number;
  updatedAt: number;
  sourceMessageRange: { start: number; end: number };
}

export interface LongTermMemory {
  id: string;
  content: string;
  pinned: boolean;
  paused: boolean;
  sourceMessageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatRequestUsage {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cachedWriteTokens?: number;
  cacheHitRate?: number;
  latencyMs: number;
  estimatedCost: number;
  usedSummary: boolean;
  rawRoundsUsed: number;
  longTermMemoriesUsed: number;
  timestamp: number;
  error?: string;
  errorType?: ErrorType;
}

export type ErrorType =
  | 'network'
  | 'invalid_api_key'
  | 'rate_limit'
  | 'insufficient_balance'
  | 'context_too_long'
  | 'model_unavailable'
  | 'provider_error'
  | 'unknown';

export type ContextStrategy = 'smart' | 'recent' | 'full';

export interface ConversationRuntimeSettings {
  generationStyle: GenerationStyle;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number | null;
  contextStrategy: ContextStrategy;
  recentRounds: number;
  autoCompress: boolean;
  compressMode: 'auto' | 'manual';
  compressThreshold: number;
  retainRecentRounds: number;
}

export interface ConversationContextState {
  summaryId: string | null;
  summaryVersions: ConversationSummary[];
  currentVersion: number;
  compressCount: number;
  lastCompressAt: number | null;
  lastCompressError: string | null;
  longTermMemories: LongTermMemory[];
}

export interface SessionUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  requestCount: number;
  totalLatencyMs: number;
  compressCount: number;
  estimatedCost: number;
}

export interface ConversationState {
  conversationId: string;
  settings: ConversationRuntimeSettings;
  contextState: ConversationContextState;
  sessionUsage: SessionUsage;
  recentRequests: ChatRequestUsage[];
}

/* ── Defaults ── */

export const DEFAULT_SETTINGS: ConversationRuntimeSettings = {
  generationStyle: 'natural',
  temperature: 0.8,
  topP: 0.95,
  maxOutputTokens: 4096,
  contextStrategy: 'smart',
  recentRounds: 12,
  autoCompress: true,
  compressMode: 'auto',
  compressThreshold: 80,
  retainRecentRounds: 10,
};

export function createConversationState(conversationId: string): ConversationState {
  return {
    conversationId,
    settings: { ...DEFAULT_SETTINGS },
    contextState: {
      summaryId: null,
      summaryVersions: [],
      currentVersion: 0,
      compressCount: 0,
      lastCompressAt: null,
      lastCompressError: null,
      longTermMemories: [],
    },
    sessionUsage: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      requestCount: 0,
      totalLatencyMs: 0,
      compressCount: 0,
      estimatedCost: 0,
    },
    recentRequests: [],
  };
}

/* ── Store ── */

export function errorTypeLabel(t: ErrorType): string {
  switch (t) {
    case 'network': return '網絡連線異常';
    case 'invalid_api_key': return 'API 金鑰無效';
    case 'rate_limit': return '請求頻率過高';
    case 'insufficient_balance': return '帳戶餘額不足';
    case 'context_too_long': return '上下文過長';
    case 'model_unavailable': return '模型不可用';
    case 'provider_error': return '供應商錯誤';
    default: return '發生錯誤';
  }
}

interface ChatRuntimeState {
  states: Record<string, ConversationState>;

  // Settings
  getSettings: (conversationId: string) => ConversationRuntimeSettings;
  updateSettings: (conversationId: string, patch: Partial<ConversationRuntimeSettings>) => void;
  resetToProviderDefaults: (conversationId: string) => void;

  // Context state
  getContextState: (conversationId: string) => ConversationContextState;
  setSummary: (conversationId: string, summary: ConversationSummary) => void;
  restoreSummaryVersion: (conversationId: string, version: number) => ConversationSummary | null;
  clearCompressError: (conversationId: string) => void;
  setCompressError: (conversationId: string, error: string) => void;
  incrementCompressCount: (conversationId: string) => void;

  // Long-term memory
  addLongTermMemory: (conversationId: string, memory: LongTermMemory) => void;
  updateLongTermMemory: (conversationId: string, memoryId: string, patch: Partial<LongTermMemory>) => void;
  deleteLongTermMemory: (conversationId: string, memoryId: string) => void;

  // Usage & diagnostics
  getSessionUsage: (conversationId: string) => SessionUsage;
  getRecentRequests: (conversationId: string) => ChatRequestUsage[];
  recordRequest: (conversationId: string, usage: ChatRequestUsage) => void;
  clearSessionExecutionCache: (conversationId: string) => void;

  // Cleanup
  removeConversationState: (conversationId: string) => void;
}

export const useChatRuntimeStore = create<ChatRuntimeState>()(
  persist(
    (set, get) => ({
      states: {},

      getSettings: (convId) => {
        const state = get().states[convId];
        return state ? state.settings : { ...DEFAULT_SETTINGS };
      },

      updateSettings: (convId, patch) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                settings: { ...existing.settings, ...patch },
              },
            },
          };
        });
      },

      resetToProviderDefaults: (convId) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                settings: { ...DEFAULT_SETTINGS },
              },
            },
          };
        });
      },

      clearSessionExecutionCache: (convId) => {
        set((state) => {
          const existing = state.states[convId];
          if (!existing) return state;
          return {
            states: {
              ...state.states,
              [convId]: {
                ...existing,
                sessionUsage: createConversationState(convId).sessionUsage,
                recentRequests: [],
              },
            },
          };
        });
      },

      getContextState: (convId) => {
        const state = get().states[convId];
        return state ? state.contextState : createConversationState(convId).contextState;
      },

      setSummary: (convId, summary) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          const versions = [...existing.contextState.summaryVersions, summary];
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: {
                  ...existing.contextState,
                  summaryId: summary.id,
                  summaryVersions: versions,
                  currentVersion: summary.version,
                  lastCompressAt: Date.now(),
                  lastCompressError: null,
                },
              },
            },
          };
        });
      },

      restoreSummaryVersion: (convId, version) => {
        const state = get().states[convId];
        if (!state) return null;
        const target = state.contextState.summaryVersions.find((v) => v.version === version);
        if (!target) return null;
        set((s) => ({
          states: {
            ...s.states,
            [convId]: {
              ...s.states[convId],
              contextState: {
                ...s.states[convId].contextState,
                summaryId: target.id,
                currentVersion: version,
              },
            },
          },
        }));
        return target;
      },

      clearCompressError: (convId) => {
        set((s) => {
          const existing = s.states[convId];
          if (!existing) return s;
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: { ...existing.contextState, lastCompressError: null },
              },
            },
          };
        });
      },

      setCompressError: (convId, error) => {
        set((s) => {
          const existing = s.states[convId];
          if (!existing) return s;
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: { ...existing.contextState, lastCompressError: error },
              },
            },
          };
        });
      },

      incrementCompressCount: (convId) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: {
                  ...existing.contextState,
                  compressCount: existing.contextState.compressCount + 1,
                },
                sessionUsage: {
                  ...existing.sessionUsage,
                  compressCount: existing.sessionUsage.compressCount + 1,
                },
              },
            },
          };
        });
      },

      addLongTermMemory: (convId, memory) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: {
                  ...existing.contextState,
                  longTermMemories: [...existing.contextState.longTermMemories, memory],
                },
              },
            },
          };
        });
      },

      updateLongTermMemory: (convId, memoryId, patch) => {
        set((s) => {
          const existing = s.states[convId];
          if (!existing) return s;
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: {
                  ...existing.contextState,
                  longTermMemories: existing.contextState.longTermMemories.map((m) =>
                    m.id === memoryId ? { ...m, ...patch, updatedAt: Date.now() } : m,
                  ),
                },
              },
            },
          };
        });
      },

      deleteLongTermMemory: (convId, memoryId) => {
        set((s) => {
          const existing = s.states[convId];
          if (!existing) return s;
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                contextState: {
                  ...existing.contextState,
                  longTermMemories: existing.contextState.longTermMemories.filter((m) => m.id !== memoryId),
                },
              },
            },
          };
        });
      },

      getSessionUsage: (convId) => {
        const state = get().states[convId];
        return state ? state.sessionUsage : createConversationState(convId).sessionUsage;
      },

      getRecentRequests: (convId) => {
        const state = get().states[convId];
        return state ? state.recentRequests : [];
      },

      recordRequest: (convId, usage) => {
        set((s) => {
          const existing = s.states[convId] || createConversationState(convId);
          return {
            states: {
              ...s.states,
              [convId]: {
                ...existing,
                sessionUsage: {
                  totalInputTokens: existing.sessionUsage.totalInputTokens + usage.inputTokens,
                  totalOutputTokens: existing.sessionUsage.totalOutputTokens + usage.outputTokens,
                  totalCachedTokens: existing.sessionUsage.totalCachedTokens + (usage.cachedInputTokens || 0),
                  requestCount: existing.sessionUsage.requestCount + 1,
                  totalLatencyMs: existing.sessionUsage.totalLatencyMs + usage.latencyMs,
                  compressCount: existing.sessionUsage.compressCount,
                  estimatedCost: existing.sessionUsage.estimatedCost + usage.estimatedCost,
                },
                recentRequests: [usage, ...existing.recentRequests].slice(0, 50),
              },
            },
          };
        });
      },

      removeConversationState: (convId) => {
        set((s) => {
          const { [convId]: _, ...rest } = s.states;
          return { states: rest };
        });
      },
    }),
    {
      name: 'lunartide-chat-runtime',
      version: 1,
      partialize: (state) => ({ states: state.states }),
    },
  ),
);

/** Estimate tokens from a text string (rough: ~1.3 tokens per Chinese char, ~0.75 per English word). */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.3 + otherChars * 0.3);
}

/** Token limit check for context. */
export function checkContextLimits(
  totalTokens: number,
  maxTokens: number,
  threshold: number,
): { status: 'ok' | 'near' | 'over'; percentage: number } {
  const percentage = Math.round((totalTokens / maxTokens) * 100);
  if (totalTokens > maxTokens) return { status: 'over', percentage };
  if (percentage >= threshold) return { status: 'near', percentage };
  return { status: 'ok', percentage };
}
