import { useEffect } from 'react';
import { startMockAgentStream, stopMockAgentStream } from './mockAgentBridge';
import {
  useAgentEventStore,
  type AgentEventType,
  type AgentSource,
} from './agentEventStore';
import './AgentStatusPanel.css';

const STATUS_LABELS: Record<AgentEventType, { label: string; helper: string }> = {
  idle: { label: 'Idle', helper: '待命' },
  thinking: { label: 'Thinking', helper: '思考中' },
  typing: { label: 'Editing', helper: '編輯中' },
  tool_call: { label: 'Tool call', helper: '工具執行' },
  building: { label: 'Building', helper: '建置中' },
  permission: { label: 'Permission', helper: '等待授權' },
  complete: { label: 'Complete', helper: '完成' },
  error: { label: 'Error', helper: '發生錯誤' },
  sleep: { label: 'Sleep', helper: '休眠' },
};

const SOURCE_LABELS: Record<AgentSource, string> = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  manual: 'LUNARIS',
};

function StatusIcon({ type }: { type: AgentEventType }) {
  if (type === 'complete') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (type === 'building' || type === 'tool_call') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17 10 6l4 7 2-3 4 7" />
        <path d="M3 20h18" />
      </svg>
    );
  }

  if (type === 'typing') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l11-11-4-4L4 16v4Z" />
        <path d="m13 7 4 4" />
      </svg>
    );
  }

  if (type === 'error') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a7 7 0 0 0-4 12.74V20l4-2 4 2v-4.26A7 7 0 0 0 12 3Z" />
      <path d="M9 10h.01M15 10h.01M9.5 13.5h5" />
    </svg>
  );
}

function formatEventTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

export function AgentStatusPanel() {
  const currentEvent = useAgentEventStore((state) => state.currentEvent);
  const events = useAgentEventStore((state) => state.events);

  useEffect(() => {
    const startTimer = window.setTimeout(startMockAgentStream, 0);
    return () => {
      window.clearTimeout(startTimer);
      stopMockAgentStream();
    };
  }, []);

  const status = currentEvent?.type ?? 'idle';
  const statusMeta = STATUS_LABELS[status];
  const progress = Math.max(0, Math.min(100, currentEvent?.progress ?? 0));

  return (
    <section className={`agent-status-panel agent-status-panel--${status}`} aria-live="polite">
      <div className="agent-status-glow" aria-hidden="true" />

      <header className="agent-status-header">
        <div className="agent-status-mark">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.8 4.2A8.5 8.5 0 1 0 20 16.6 7 7 0 0 1 17.8 4.2Z" />
            <path d="M6.5 8.5h2M7.5 7.5v2" />
          </svg>
        </div>
        <div className="agent-status-heading">
          <span className="agent-status-eyebrow">Agent Event Layer · Mock</span>
          <h2>LUNARIS 正在工作</h2>
        </div>
        <span className={`agent-status-pulse agent-status-pulse--${status}`} aria-hidden="true" />
      </header>

      <div className="agent-status-current">
        <div className="agent-status-icon"><StatusIcon type={status} /></div>
        <div className="agent-status-current-copy">
          <span className="agent-status-label">目前狀態</span>
          <strong>{statusMeta.label}</strong>
          <span>{statusMeta.helper} · {SOURCE_LABELS[currentEvent?.source ?? 'manual']}</span>
        </div>
        <output className="agent-status-percent">{progress}%</output>
      </div>

      <div className="agent-status-progress" aria-label={`工作進度 ${progress}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      {currentEvent && (currentEvent.file || currentEvent.detail) && (
        <div className="agent-status-context">
          {currentEvent.file && <code>{currentEvent.file}</code>}
          {currentEvent.detail && <span>{currentEvent.detail}</span>}
        </div>
      )}

      <div className="agent-event-list-head">
        <span>最近事件</span>
        <span>{events.length} 則</span>
      </div>
      <ol className="agent-event-list">
        {events.slice(0, 4).map((event) => (
          <li key={event.id}>
            <span className={`agent-event-dot agent-event-dot--${event.type}`} aria-hidden="true" />
            <div>
              <strong>{event.title}</strong>
              {(event.file || event.detail) && <span>{event.file ?? event.detail}</span>}
            </div>
            <time dateTime={event.createdAt}>{formatEventTime(event.createdAt)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
