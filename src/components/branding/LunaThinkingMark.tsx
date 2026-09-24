import { LunartideMarkAnimated } from './LunartideMarkAnimated';

interface LunaThinkingMarkProps {
  size?: number;
  label?: string;
  className?: string;
}

export function LunaThinkingMark({ size = 36, label, className }: LunaThinkingMarkProps) {
  return (
    <div
      className={`luna-thinking-mark${label ? ' has-label' : ''} ${className ?? ''}`.trim()}
      role="img"
      aria-label={label || 'AI 思考中'}
    >
      <LunartideMarkAnimated size={size} active decorative />
      {label && <span className="luna-thinking-label">{label}</span>}
    </div>
  );
}
