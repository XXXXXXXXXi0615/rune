import type { AgentActivity, AgentActivityEventType, AgentOrbState } from './agentActivityTypes';

export const AGENT_ACTIVITY_LABELS: Record<Exclude<AgentActivity, 'idle' | 'error'>, string> = {
  listening: '正在聽你說',
  searching: '正在搜尋',
  solving: '正在整理思路',
  working: '正在執行工具',
  composing: '正在組織回覆',
  shaping: '正在生成內容',
};

export const AGENT_ACTIVITY_PRIORITY: Record<AgentActivity, number> = {
  idle: 0,
  error: 0,
  composing: 1,
  shaping: 2,
  solving: 3,
  searching: 4,
  working: 5,
  listening: 6,
};

export function activityForEvent(type: AgentActivityEventType): AgentActivity {
  switch (type) {
    case 'voice_listening': return 'listening';
    case 'memory_retrieval_started':
    case 'web_search_started': return 'searching';
    case 'planning_started': return 'solving';
    case 'request_started':
    case 'tool_call_started': return 'working';
    case 'response_stream_started':
    case 'first_body_token': return 'composing';
    case 'structured_output': return 'shaping';
    case 'request_failed': return 'error';
    default: return 'idle';
  }
}

export function orbStateForActivity(activity: AgentActivity): AgentOrbState | null {
  return activity === 'idle' || activity === 'error' ? null : activity;
}

export function labelForActivity(activity: AgentActivity): string | null {
  return activity === 'idle' || activity === 'error' ? null : AGENT_ACTIVITY_LABELS[activity];
}
