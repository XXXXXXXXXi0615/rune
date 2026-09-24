import { create } from 'zustand';

export type AgentEventType =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'tool_call'
  | 'building'
  | 'permission'
  | 'complete'
  | 'error'
  | 'sleep';

export type AgentSource =
  | 'codex'
  | 'claude-code'
  | 'cursor'
  | 'gemini'
  | 'opencode'
  | 'manual';

export type AgentEvent = {
  id: string;
  source: AgentSource;
  type: AgentEventType;
  title: string;
  detail?: string;
  file?: string;
  progress?: number;
  createdAt: string;
};

interface AgentEventState {
  events: AgentEvent[];
  currentEvent: AgentEvent | null;
  pushAgentEvent: (event: AgentEvent) => void;
  clearAgentEvents: () => void;
  setCurrentEvent: (event: AgentEvent | null) => void;
  getAgentStatus: () => AgentEventType;
}

const MAX_EVENTS = 20;

export const useAgentEventStore = create<AgentEventState>((set, get) => ({
  events: [],
  currentEvent: null,
  pushAgentEvent: (event) => set((state) => ({
    currentEvent: event,
    events: [event, ...state.events.filter((item) => item.id !== event.id)].slice(0, MAX_EVENTS),
  })),
  clearAgentEvents: () => set({ events: [], currentEvent: null }),
  setCurrentEvent: (event) => set({ currentEvent: event }),
  getAgentStatus: () => get().currentEvent?.type ?? 'idle',
}));
