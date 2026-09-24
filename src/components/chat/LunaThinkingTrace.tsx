import { useState } from 'react';

/* ════════════════════════════════════════
   Pipeline Trace Step
   ════════════════════════════════════════ */
export interface PipelineTraceStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped';
  detail?: string;
}

function StepIcon({ status }: { status: PipelineTraceStep['status'] }) {
  if (status === 'running') {
    return (
      <span className="ltt-step-icon ltt-running">
        <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
          <circle cx="12" cy="12" r="5" />
        </svg>
      </span>
    );
  }
  if (status === 'done') {
    return (
      <span className="ltt-step-icon ltt-done">
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="ltt-step-icon ltt-skipped">
        <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
    );
  }
  return <span className="ltt-step-icon ltt-pending" />;
}

/* ════════════════════════════════════════
   LunaThinkingTrace — terminal-style pipeline log
   ════════════════════════════════════════ */
export function LunaThinkingTrace({ steps, defaultCollapsed = false }: {
  steps: PipelineTraceStep[];
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const hasRunning = steps.some((s) => s.status === 'running');
  const activeStep = steps.find((s) => s.status === 'running');
  const headerLabel = activeStep?.label || '已完成';

  return (
    <div className={`ltt-panel${hasRunning ? ' ltt-active' : ''}${collapsed ? ' ltt-collapsed' : ''}`}>
      <button type="button" className="ltt-header" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
        <span className="ltt-header-label">
          {hasRunning ? (
            <>
              <span className="ltt-spinner" />
              {headerLabel}
            </>
          ) : (
            <>管線追蹤</>
          )}
        </span>
        <svg className="ltt-chevron" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points={collapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15'} />
        </svg>
      </button>
      {!collapsed && (
        <div className="ltt-body">
          {steps.map((step, i) => (
            <div key={step.id} className={`ltt-step${step.status === 'running' ? ' ltt-step--active' : ''}`}>
              <StepIcon status={step.status} />
              <span className="ltt-step-label">{step.label}</span>
              {step.detail && (
                <span className="ltt-step-detail">{step.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
