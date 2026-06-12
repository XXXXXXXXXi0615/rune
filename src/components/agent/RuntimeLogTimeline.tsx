import type { AgentRuntimeLog } from '@/types';

function statusDot(status: string, color: string) {
  return (
    <span
      style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0, marginTop: 5,
      }}
    />
  );
}

function stepIcon(status: string) {
  switch (status) {
    case 'active':
      return (
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--accent)', fill: 'none', strokeWidth: 2 }}>
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'done':
      return (
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--success)', fill: 'none', strokeWidth: 2.5 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--danger)', fill: 'none', strokeWidth: 2 }}>
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'skipped':
      return (
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--text-3)', fill: 'none', strokeWidth: 2, opacity: 0.5 }}>
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    default:
      return <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--text-3)', opacity: 0.35, flexShrink: 0, display: 'inline-block' }} />;
  }
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDuration(start: number, end?: number): string {
  if (!end) return '…';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Safe timeline display — never shows raw chain-of-thought, only visible reasoning summary + steps + tool calls. */
export function RuntimeLogTimeline({ log }: { log: AgentRuntimeLog }) {
  const statusColor =
    log.status === 'completed' ? 'var(--success)'
    : log.status === 'failed' ? 'var(--danger)'
    : log.status === 'calling_tool' ? 'var(--amber)'
    : log.status === 'thinking' ? 'var(--accent)'
    : 'var(--text-3)';

  return (
    <div style={{
      fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {statusDot(log.status, statusColor)}
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {log.status === 'completed' ? '已完成'
              : log.status === 'failed' ? '失敗'
              : log.status === 'calling_tool' ? '調用工具中'
              : log.status === 'thinking' ? '思考中'
              : '待命中'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>#{log.requestId.slice(0, 8)}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {fmtTime(log.startedAt)} · {fmtDuration(log.startedAt, log.finishedAt)}
        </span>
      </div>

      {/* Visible reasoning summary — safe to display */}
      {log.visibleReasoningSummary && (
        <div style={{
          padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 10,
          fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.55,
          borderLeft: '3px solid var(--accent-soft)',
        }}>
          {log.visibleReasoningSummary}
        </div>
      )}

      {/* Execution steps timeline */}
      {log.steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            執行步驟
          </div>
          {log.steps.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', gap: 10, paddingLeft: 4 }}>
              {/* Timeline connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
                {i > 0 && <div style={{ width: 1, height: 6, background: 'var(--surface-2)' }} />}
                {stepIcon(step.status)}
                {i < log.steps.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--surface-2)' }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: i < log.steps.length - 1 ? 10 : 0 }}>
                <div style={{ fontSize: 13, color: step.status === 'done' ? 'var(--text-1)' : 'var(--text-2)', fontWeight: step.status === 'active' ? 600 : 400 }}>
                  {step.label}
                </div>
                {step.detail && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{step.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tool calls */}
      {log.toolCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            工具調用
          </div>
          {log.toolCalls.map((tc) => (
            <div key={tc.id} style={{
              padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10,
              fontSize: 12, lineHeight: 1.5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: tc.status === 'success' ? 'var(--success)' : tc.status === 'error' ? 'var(--danger)' : tc.status === 'running' ? 'var(--amber)' : 'var(--text-3)',
                }} />
                <span style={{ fontWeight: 600 }}>{tc.toolName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {tc.status === 'success' ? '成功' : tc.status === 'error' ? '失敗' : tc.status === 'running' ? '執行中' : '等待中'}
                </span>
              </div>
              {tc.input && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>輸入：{tc.input.slice(0, 120)}</div>}
              {tc.output && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>輸出：{tc.output.slice(0, 120)}</div>}
              {tc.error && <div style={{ fontSize: 11, color: 'var(--danger)' }}>{tc.error}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Token usage & cost */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
        <span>Token：{log.tokenUsage.input}+{log.tokenUsage.output}={log.tokenUsage.total}{log.tokenUsage.estimated ? '（估算）' : ''}</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
          估算費用：${log.costEstimate.toFixed(5)}
        </span>
      </div>

      {/* Error */}
      {log.error && (
        <div style={{ padding: '8px 10px', background: 'rgba(198,69,69,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>
          {log.error}
        </div>
      )}

      {/* Provider info */}
      <div style={{ fontSize: 10, color: 'var(--text-3)', opacity: 0.6 }}>
        {log.providerId} · {log.model} · {log.presetId}
      </div>
    </div>
  );
}
