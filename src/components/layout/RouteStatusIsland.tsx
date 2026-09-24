import { useEffect, useRef, useState } from 'react';
import { RuneBrandLogo } from '@/components/branding/RuneBrandLogo';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';

const formatTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

/**
 * Rune identity anchor — avatar only.
 *
 * Phase D.1 retired the wide Rune wordmark capsule from SystemTopBar: the top
 * bar keeps Rune identity as a compact avatar anchor (44–48px) and the Utility
 * Island owns the primary capsule. The focus-session behaviour of the former
 * capsule is preserved here verbatim: when a canonical focus session is
 * running/paused the anchor becomes a button that opens the TIDEBOUND panel and
 * shows the phase + remaining time; when idle it is a non-interactive identity
 * mark (visually hidden accessible name only).
 */
export function RouteStatusIsland() {
  const status = useFocusSessionStore((state) => state.status);
  const phase = useFocusSessionStore((state) => state.phase);
  const remainingSeconds = useFocusSessionStore((state) => state.remainingSeconds);
  const showExpanded = useFocusIslandStore((state) => state.showExpanded);
  const wasActive = useRef(status === 'running' || status === 'paused');
  const [showCompleted, setShowCompleted] = useState(false);
  const active = status === 'running' || status === 'paused';

  useEffect(() => {
    if (wasActive.current && status === 'idle') {
      setShowCompleted(true);
      const timeout = window.setTimeout(() => setShowCompleted(false), 1800);
      wasActive.current = false;
      return () => window.clearTimeout(timeout);
    }
    wasActive.current = active;
  }, [active, status]);

  const mode = showCompleted ? 'focus-completed'
    : !active ? 'idle'
      : phase === 'break' ? 'focus-break'
        : status === 'paused' ? 'focus-paused'
          : 'focus-active';
  const label = showCompleted ? '完成'
    : active ? `${phase === 'break' ? '休息' : status === 'paused' ? 'Ⅱ' : '◷'} ${formatTime(remainingSeconds)}`
      : 'Rune';

  const content = <>
    <RuneBrandLogo mood="neutral" decorative />
    {mode === 'idle'
      ? <span className="route-status-identity-label">Rune</span>
      : <span className="route-status-timer">{label}</span>}
  </>;

  return active ? (
    <button type="button" className="route-status-island" data-testid="route-status-island" data-mode={mode} data-pet-safe-region="interactive" onClick={showExpanded} aria-label={`開啟 TIDEBOUND 快捷面板，${label}`} aria-haspopup="dialog">
      {content}
    </button>
  ) : (
    <div className="route-status-island" data-testid="route-status-island" data-mode={mode} data-pet-safe-region="interactive">{content}</div>
  );
}
