type AppIconName =
  | 'home'
  | 'chat'
  | 'focus'
  | 'diary'
  | 'food'
  | 'settings'
  | 'memory'
  | 'sleep'
  | 'todo'
  | 'quest'
  | 'timeline'
  | 'water'
  | 'music'
  | 'calendar'
  | 'more'
  | 'moreHorizontal'
  | 'sparkle'
  | 'dailyCache'
  | 'tideclock'
  | 'tidewatch'
  // Home Widget icons (Phase 1.3)
  | 'checkCircle'
  | 'listChecks'
  | 'calendarHeart'
  | 'orbit'
  | 'chartActivity'
  | 'circleSlash'
  | 'arrowLeft'
  | 'bookOpen'
  | 'archiveBox'
  | 'database'
  | 'dictionary'
  | 'info'
  | 'lightbulb'
  | 'palette'
  | 'portfolio'
  | 'user';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  className?: string;
}

export type { AppIconName };

export function AppIcon({ name, size = 22, className }: AppIconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  return (
    <svg {...props}>
      {name === 'home' && (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </>
      )}
      {name === 'chat' && <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />}
      {name === 'focus' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
        </>
      )}
      {name === 'diary' && (
        <>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </>
      )}
      {name === 'food' && (
        <>
          <path d="M18 8h1a4 4 0 010 8h-1" />
          <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
          <path d="M6 2v3M10 2v3M14 2v3" />
        </>
      )}
      {name === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3 1.7 1.7 0 001-1.5V3a2 2 0 014 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8 1.7 1.7 0 001.5 1h.2a2 2 0 010 4h-.2a1.7 1.7 0 00-1.5 1z" />
        </>
      )}
      {name === 'memory' && (
        <>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 12l10 5 10-5" />
          <path d="M2 17l10 5 10-5" />
        </>
      )}
      {name === 'sleep' && <path d="M12 3a9 9 0 109 9c-4.5-1.5-7-4-7-9z" />}
      {name === 'todo' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12l3 3 5-6" />
        </>
      )}
      {name === 'quest' && (
        <>
          <path d="M18 4.5a5.5 5.5 0 1 0 0 11 4.5 4.5 0 1 1 0-11Z" />
          <line x1="3" y1="10" x2="12" y2="10" />
          <line x1="3" y1="14" x2="11" y2="14" />
        </>
      )}
      {name === 'timeline' && (
        <>
          <path d="M12 4v16" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="18" r="2" />
        </>
      )}
      {name === 'water' && <path d="M12 2.7l5.7 5.7a8 8 0 11-11.4 0z" />}
      {name === 'music' && (
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      )}
      {name === 'more' && (
        <>
          <circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none" />
        </>
      )}
      {name === 'moreHorizontal' && (
        <>
          <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none" />
        </>
      )}
      {name === 'sparkle' && <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />}
      {name === 'dailyCache' && (
        <>
          <path d="M14.8 3.9a7.1 7.1 0 1 0 4.1 12.7 6.2 6.2 0 0 1-4.1-12.7Z" />
          <circle cx="18.3" cy="7.2" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="17.1" cy="10.3" r="0.55" fill="currentColor" stroke="none" opacity={0.72} />
          <path d="M5.1 16.3h13.8" />
          <path d="M6 16.3l.85 3.05h10.3L18 16.3" />
        </>
      )}
      {name === 'tidewatch' && (
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
          <path d="M6.8 9.5 9.3 12l-2.5 2.5" />
          <line x1="12.5" y1="14.5" x2="16.5" y2="14.5" />
          <path d="M12 2.6v1.4M16.6 3.5l-.9 1.4M7.4 3.5l.9 1.4" />
        </>
      )}
      {name === 'tideclock' && (
        <>
          <circle cx="12" cy="7" r="5" />
          <path d="M12 4.5v2.5l1.5 1" />
          <rect x="6" y="13" width="12" height="8" rx="1.5" />
          <path d="M9 13V11.5M15 13V11.5" />
          <line x1="9" y1="16.5" x2="15" y2="16.5" opacity="0.6" />
          <line x1="9" y1="18.5" x2="13" y2="18.5" opacity="0.4" />
        </>
      )}
      {name === 'checkCircle' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        </>
      )}
      {name === 'listChecks' && (
        <>
          <path d="M4 7h4" />
          <path d="M4 16h4" />
          <path d="M12 7h7" />
          <path d="M12 16h7" />
          <path d="M8 7v.01" />
          <path d="M8 16v.01" />
        </>
      )}
      {name === 'calendarHeart' && (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path d="M12 16c-.72-1.1-1.8-1.8-3-2" />
          <path d="M9.2 15.8c.8.6 1.6 1 2.8 2" />
        </>
      )}
      {name === 'orbit' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-30 12 12)" />
          <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(30 12 12)" />
        </>
      )}
      {name === 'chartActivity' && (
        <>
          <rect x="3" y="13" width="4" height="7" rx="1" />
          <rect x="10" y="8" width="4" height="12" rx="1" />
          <rect x="17" y="4" width="4" height="16" rx="1" />
        </>
      )}
      {name === 'circleSlash' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="5" y1="5" x2="19" y2="19" />
        </>
      )}
      {name === 'arrowLeft' && <path d="m15 18-6-6 6-6" />}
      {name === 'bookOpen' && (
        <>
          <path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22Z" />
          <path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22Z" />
        </>
      )}
      {name === 'archiveBox' && (
        <>
          <path d="M4 8h16v12H4z" />
          <path d="M3 4h18v4H3zM9 12h6" />
        </>
      )}
      {name === 'database' && (
        <>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </>
      )}
      {name === 'dictionary' && (
        <>
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22z" />
          <path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22z" />
          <path d="M7 7h2M15 7h2M7 11h2M15 11h2" />
        </>
      )}
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      )}
      {name === 'lightbulb' && (
        <>
          <path d="M9 18h6M10 22h4" />
          <path d="M8.2 15.5A7 7 0 1 1 15.8 15.5c-.8.7-1.3 1.4-1.3 2.5h-5c0-1.1-.5-1.8-1.3-2.5Z" />
        </>
      )}
      {name === 'palette' && (
        <>
          <path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.3H18A3 3 0 0 0 21 11.3 9 9 0 0 0 12 3Z" />
          <circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14.2" cy="7" r="1" />
        </>
      )}
      {name === 'portfolio' && (
        <>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2" />
        </>
      )}
      {name === 'user' && (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      )}
    </svg>
  );
}
