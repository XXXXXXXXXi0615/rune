import { useAgentEventStore, type AgentEvent } from './agentEventStore';

type MockEventInput = Omit<AgentEvent, 'id' | 'createdAt'>;

const MOCK_SEQUENCE: MockEventInput[] = [
  {
    source: 'manual',
    type: 'thinking',
    title: '正在分析專案',
    detail: '整理元件關係與變更範圍',
    progress: 18,
  },
  {
    source: 'manual',
    type: 'typing',
    title: '修改 HomePage.tsx',
    detail: '套用 Lunartide 元件規範',
    file: 'src/pages/HomePage.tsx',
    progress: 52,
  },
  {
    source: 'manual',
    type: 'building',
    title: '正在執行 npm run build',
    detail: '檢查 TypeScript 與 Vite 輸出',
    progress: 82,
  },
  {
    source: 'manual',
    type: 'complete',
    title: 'npm run build 成功',
    detail: '本輪工作已完成',
    progress: 100,
  },
];

let streamTimer: ReturnType<typeof setTimeout> | null = null;
let sequenceIndex = 0;

function createMockEvent(input: MockEventInput): AgentEvent {
  return {
    ...input,
    id: `agent_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

function scheduleNextEvent() {
  const delay = 3000 + Math.floor(Math.random() * 2001);
  streamTimer = setTimeout(() => {
    const nextEvent = MOCK_SEQUENCE[sequenceIndex];
    useAgentEventStore.getState().pushAgentEvent(createMockEvent(nextEvent));
    sequenceIndex = (sequenceIndex + 1) % MOCK_SEQUENCE.length;
    scheduleNextEvent();
  }, delay);
}

export function startMockAgentStream() {
  if (streamTimer) return;

  const nextEvent = MOCK_SEQUENCE[sequenceIndex];
  useAgentEventStore.getState().pushAgentEvent(createMockEvent(nextEvent));
  sequenceIndex = (sequenceIndex + 1) % MOCK_SEQUENCE.length;
  scheduleNextEvent();
}

export function stopMockAgentStream() {
  if (streamTimer) clearTimeout(streamTimer);
  streamTimer = null;
}
