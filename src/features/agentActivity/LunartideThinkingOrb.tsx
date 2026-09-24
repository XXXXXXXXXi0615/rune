import { useEffect, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { labelForActivity, orbStateForActivity } from './agentActivityMapping';
import { useAgentActivityPreferences } from './agentActivityState';
import type { AgentActivity } from './agentActivityTypes';
import './agentActivity.css';

interface LunartideThinkingOrbProps {
  activity: AgentActivity;
  size?: 'inline' | 'avatar';
  label?: string;
  paused?: boolean;
  decorative?: boolean;
  className?: string;
  labelOnly?: boolean;
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function LunartideThinkingOrb({ activity, size = 'inline', label, paused = false, decorative = false, className = '', labelOnly = false }: LunartideThinkingOrbProps) {
  const animationEnabled = useAgentActivityPreferences((state) => state.animationEnabled);
  const showLabel = useAgentActivityPreferences((state) => state.showLabel);
  const reducedMotion = useAgentActivityPreferences((state) => state.reducedMotion);
  const systemReduced = useSystemReducedMotion();
  const orbState = orbStateForActivity(activity);
  if (!orbState) return null;

  const resolvedLabel = label || labelForActivity(activity) || 'AI 活動中';
  const shouldPause = paused || !animationEnabled || reducedMotion === 'on' || (reducedMotion === 'system' && systemReduced);
  const pixels = size === 'avatar' ? 64 : 20;

  return (
    <span
      className={`lunartide-thinking-orb is-${size} ${className}`.trim()}
      data-testid={labelOnly ? 'lunartide-agent-activity-label' : 'lunartide-thinking-orb'}
      data-activity={activity}
      data-paused={shouldPause ? 'true' : 'false'}
      role={decorative ? undefined : 'status'}
      aria-live={decorative ? undefined : 'polite'}
      aria-label={decorative ? undefined : resolvedLabel}
      aria-hidden={decorative ? true : undefined}
    >
      {!labelOnly && <span className="lunartide-thinking-orb__canvas" aria-hidden="true">
        <ThinkingOrb state={orbState} size={pixels} theme="auto" paused={shouldPause} />
      </span>}
      {!decorative && showLabel && <span className="lunartide-thinking-orb__label">{resolvedLabel}</span>}
    </span>
  );
}
