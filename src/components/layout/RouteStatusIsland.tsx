import { useEffect, useRef, useState } from 'react';
import { RuneBrandLogo } from '@/components/branding/RuneBrandLogo';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useRuneUtilityStore } from '@/store/useRuneUtilityStore';

const formatTime = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

/** The avatar always opens Rune Launcher; focus status has its own TIDEBOUND control. */
export function RouteStatusIsland() {
  const status = useFocusSessionStore((state) => state.status);
  const phase = useFocusSessionStore((state) => state.phase);
  const remainingSeconds = useFocusSessionStore((state) => state.remainingSeconds);
  const showExpanded = useFocusIslandStore((state) => state.showExpanded);
  const launcherOpen = useRuneUtilityStore((state) => state.open);
  const toggleLauncher = useRuneUtilityStore((state) => state.toggleLauncher);
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

  return <div className="route-status-group" data-mode={mode}>
    <button type="button" className="route-status-island" data-testid="route-status-island" data-pet-safe-region="interactive" onClick={toggleLauncher} aria-label="開啟 Rune 功能選單" aria-haspopup="menu" aria-expanded={launcherOpen} aria-controls="rune-launcher-menu">
      <RuneBrandLogo mood="neutral" decorative />
    </button>
    {(active || showCompleted) && <button type="button" className="route-focus-status" data-testid="route-focus-status" data-pet-safe-region="interactive" onClick={showExpanded} aria-label={`開啟 TIDEBOUND 快捷面板，${label}`} aria-haspopup="dialog">
      <span className="route-status-timer">{label}</span>
    </button>}
  </div>;
}
