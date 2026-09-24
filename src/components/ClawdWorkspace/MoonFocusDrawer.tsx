import { useEffect, useState } from 'react';
import { MoonFocusWorkspace } from '@/components/ClawdWorkspace/ClawdWorkspace';
import { useMoonFocusStore } from '@/store/useMoonFocusStore';

const DESKTOP_MIN_WIDTH = 900;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_MIN_WIDTH);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

export function MoonFocusDrawer() {
  const open = useMoonFocusStore((s) => s.open);
  const closeWorkspace = useMoonFocusStore((s) => s.closeWorkspace);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWorkspace();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeWorkspace]);

  if (!isDesktop || !open) return null;

  return (
    <aside className="moon-focus-drawer is-open" aria-label="專注">
      <MoonFocusWorkspace variant="drawer" onClose={closeWorkspace} />
    </aside>
  );
}
