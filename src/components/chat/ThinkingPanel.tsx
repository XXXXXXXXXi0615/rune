import { LunaThinkingMark } from '@/components/branding/LunaThinkingMark';
import type { PipelineTraceStep } from '@/components/chat/LunaThinkingTrace';

const STAGE_LABELS = ['整理 Persona', '搜尋記憶', '查閱世界書', '執行工具', '生成回答'];

interface ThinkingPanelProps {
  active?: boolean;
  stepIndex?: number;
  trace?: PipelineTraceStep[];
}

function resolveActiveIndex(stepIndex: number, trace?: PipelineTraceStep[]) {
  const running = trace?.findIndex((step) => step.status === 'running');
  if (typeof running === 'number' && running >= 0) return Math.min(running, STAGE_LABELS.length - 1);
  const doneCount = trace?.filter((step) => step.status === 'done').length ?? 0;
  if (doneCount > 0) return Math.min(doneCount, STAGE_LABELS.length - 1);
  return Math.max(0, Math.min(stepIndex, STAGE_LABELS.length - 1));
}

export function ThinkingPanel({ active = true, stepIndex = 0, trace }: ThinkingPanelProps) {
  const activeIndex = resolveActiveIndex(stepIndex, trace);

  return (
    <div className={`thinking-summary-panel${active ? ' is-active' : ''}`} role="status" aria-live="polite">
      <LunaThinkingMark size={36} label="LUNARIS 思考中" />
      <div className="thinking-summary-copy">
        <span className="thinking-summary-eyebrow">LUNARIS 正在整理上下文</span>
        <div className="thinking-summary-stages" aria-label="回覆準備階段">
          {STAGE_LABELS.map((label, index) => (
            <span
              key={label}
              className={`thinking-summary-chip${index === activeIndex ? ' is-current' : ''}${index < activeIndex ? ' is-done' : ''}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
