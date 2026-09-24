import type { OrbState } from 'thinking-orbs';

export type AgentActivity =
  | 'idle'
  | 'listening'
  | 'searching'
  | 'solving'
  | 'working'
  | 'composing'
  | 'shaping'
  | 'error';

export type AgentActivityEventType =
  | 'request_started'
  | 'voice_listening'
  | 'memory_retrieval_started'
  | 'web_search_started'
  | 'planning_started'
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'response_stream_started'
  | 'first_body_token'
  | 'structured_output'
  | 'request_completed'
  | 'request_failed'
  | 'request_aborted';

export interface AgentActivityEvent {
  type: AgentActivityEventType;
  requestId: string;
  toolId?: string;
  at?: number;
}

export interface AgentActivitySnapshot {
  activity: AgentActivity;
  requestId: string | null;
  activeToolIds: string[];
  visibleSince: number | null;
  revision: number;
}

export interface AgentActivityPreferences {
  animationEnabled: boolean;
  showLabel: boolean;
  reducedMotion: 'system' | 'on' | 'off';
}

export type AgentOrbState = Exclude<OrbState, never>;
