import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCallStore } from '@/store/useCallStore';
import { isCallLive, callStateLabel } from '@/utils/callMachine';
import '@/styles/call.css';

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Floating mini window shown while a call is minimized on other routes. */
export function CallMiniWindow() {
  const session = useCallStore((s) => s.session);
  const setMinimized = useCallStore((s) => s.setMinimized);
  const hangUp = useCallStore((s) => s.hangUp);
  const navigate = useNavigate();
  const location = useLocation();
  const [nowTs, setNowTs] = useState(0);

  const visible = Boolean(session && session.minimized && isCallLive(session.state) && location.pathname !== '/call');

  useEffect(() => {
    if (!visible) return undefined;
    const id = window.setInterval(() => setNowTs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!session || !visible) return null;

  const expand = () => {
    setMinimized(false);
    navigate('/call');
  };

  return (
    <div className="call-mini-window" role="region" aria-label="通話小視窗" data-testid="call-mini-window">
      <button type="button" className="call-mini-window__expand" onClick={expand} aria-label="回到通話">
        <span className="call-mini-window__avatar" aria-hidden="true">{session.identityName.charAt(0).toUpperCase()}</span>
        <span className="call-mini-window__copy">
          <strong>{session.identityName}</strong>
          <small>
            {session.state === 'active' && session.connectedAt && nowTs
              ? formatDuration(Math.max(0, nowTs - session.connectedAt))
              : callStateLabel(session.state)}
          </small>
        </span>
      </button>
      <button
        type="button"
        className="call-mini-window__hangup"
        onClick={() => { hangUp('mini-window'); navigate('/call'); }}
        aria-label="掛斷通話"
      >
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 13.5C8.5 9.5 15.5 9.5 19.5 13.5l1 1a2 2 0 0 1 0 2.8l-1.4 1.4-3.8-2.2v-2.6a10.5 10.5 0 0 0-6.6 0v2.6l-3.8 2.2L3.5 17.3a2 2 0 0 1 0-2.8z"/></svg>
      </button>
    </div>
  );
}
