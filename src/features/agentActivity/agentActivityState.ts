import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { activityForEvent } from './agentActivityMapping';
import type { AgentActivity, AgentActivityEvent, AgentActivityPreferences, AgentActivitySnapshot } from './agentActivityTypes';

export const AGENT_ACTIVITY_MIN_VISIBLE_MS = 240;
export const AGENT_ACTIVITY_FIRST_TOKEN_FADE_MS = 150;

const initialSnapshot: AgentActivitySnapshot = {
  activity: 'idle',
  requestId: null,
  activeToolIds: [],
  visibleSince: null,
  revision: 0,
};

let settleTimer: ReturnType<typeof setTimeout> | null = null;

function clearSettleTimer() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = null;
}

interface AgentActivityStore extends AgentActivitySnapshot {
  emit: (event: AgentActivityEvent) => void;
  reset: (requestId?: string) => void;
}

export const useAgentActivityStore = create<AgentActivityStore>((set, get) => ({
  ...initialSnapshot,
  emit: (event) => {
    const at = event.at ?? Date.now();
    const current = get();

    if (event.type === 'request_started') {
      clearSettleTimer();
      set({
        ...initialSnapshot,
        activity: 'working',
        requestId: event.requestId,
        visibleSince: at,
        revision: current.revision + 1,
      });
      return;
    }

    if (current.requestId && current.requestId !== event.requestId) return;

    if (event.type === 'tool_call_started') {
      clearSettleTimer();
      const toolId = event.toolId || `${event.requestId}:tool`;
      set({
        activity: 'working',
        requestId: event.requestId,
        activeToolIds: current.activeToolIds.includes(toolId) ? current.activeToolIds : [...current.activeToolIds, toolId],
        visibleSince: current.visibleSince ?? at,
        revision: current.activity === 'working' ? current.revision : current.revision + 1,
      });
      return;
    }

    if (event.type === 'tool_call_completed') {
      const toolId = event.toolId || `${event.requestId}:tool`;
      const activeToolIds = current.activeToolIds.filter((id) => id !== toolId);
      set({ activeToolIds });
      return;
    }

    if (event.type === 'request_completed' || event.type === 'request_aborted' || event.type === 'request_failed') {
      const target: AgentActivity = event.type === 'request_failed' ? 'error' : 'idle';
      const elapsed = current.visibleSince == null ? AGENT_ACTIVITY_MIN_VISIBLE_MS : at - current.visibleSince;
      const wait = Math.max(0, AGENT_ACTIVITY_MIN_VISIBLE_MS - elapsed);
      clearSettleTimer();
      settleTimer = setTimeout(() => {
        set((state) => state.requestId === event.requestId ? {
          ...initialSnapshot,
          activity: target,
          revision: state.revision + 1,
        } : state);
        settleTimer = null;
      }, wait);
      return;
    }

    if (event.type === 'first_body_token') {
      if (current.activeToolIds.length > 0) return;
      clearSettleTimer();
      settleTimer = setTimeout(() => {
        set((state) => state.requestId === event.requestId && state.activeToolIds.length === 0 ? {
          ...state,
          activity: 'idle',
          visibleSince: null,
          revision: state.revision + 1,
        } : state);
        settleTimer = null;
      }, AGENT_ACTIVITY_FIRST_TOKEN_FADE_MS);
      return;
    }

    const next = activityForEvent(event.type);
    if (next === 'idle' || next === 'error' || next === current.activity) return;
    clearSettleTimer();
    set({
      activity: next,
      requestId: event.requestId,
      visibleSince: current.visibleSince ?? at,
      revision: current.revision + 1,
    });
  },
  reset: (requestId) => {
    const current = get();
    if (requestId && current.requestId !== requestId) return;
    clearSettleTimer();
    set({ ...initialSnapshot, revision: current.revision + 1 });
  },
}));

interface AgentActivityPreferenceStore extends AgentActivityPreferences {
  update: (patch: Partial<AgentActivityPreferences>) => void;
}

export const useAgentActivityPreferences = create<AgentActivityPreferenceStore>()(
  persist(
    (set) => ({
      animationEnabled: true,
      showLabel: true,
      reducedMotion: 'system',
      update: (patch) => set(patch),
    }),
    { name: 'lunartide-agent-activity-preferences' },
  ),
);

export function emitAgentActivity(event: AgentActivityEvent) {
  useAgentActivityStore.getState().emit(event);
}

export function resetAgentActivity(requestId?: string) {
  useAgentActivityStore.getState().reset(requestId);
}
