import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ThemeToggle } from '@/components/home/ThemeToggle';
import { useAppStore } from '@/store/useAppStore';
import { t } from '@/i18n';

const navItems = [
  { to: '/', labelKey: 'nav.home', icon: 'home' },
  { to: '/moon-reading', labelKey: 'nav.moonRead', icon: 'book' },
  { to: '/memory', labelKey: 'nav.memory', icon: 'memory' },
  { to: '/chat', labelKey: 'nav.chat', icon: 'chat' },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings' },
] as const;

function NavIcon({ icon }: { icon: (typeof navItems)[number]['icon'] }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {icon === 'home' && (
        <>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </>
      )}
      {icon === 'book' && (
        <>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </>
      )}
      {icon === 'memory' && (
        <>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </>
      )}
      {icon === 'chat' && <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />}
      {icon === 'settings' && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 001.51-1z" />
        </>
      )}
    </svg>
  );
}

function formatDesktopDate(now: Date, language: string) {
  return now.toLocaleDateString(language === 'en' ? 'en-US' : 'zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function DesktopSidebar() {
  useAppStore((s) => s.language);

  return (
    <aside className="desktop-sidebar">
      <div className="desktop-brand">
        <span className="desktop-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M24.5 21.5A11 11 0 1110.5 7.2 9 9 0 0024.5 21.5z" />
            <path d="M6 25c4-2 7-2 10 0s6 2 10 0" />
          </svg>
        </span>
        <span>
          <strong>Lunartide</strong>
          <small>月潮</small>
        </span>
      </div>

      <nav className="desktop-nav" aria-label="Desktop navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}
          >
            <NavIcon icon={item.icon} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="desktop-sidebar-foot">
        <span className="desktop-status-dot" />
        <span>LUNARIS ONLINE</span>
      </div>
    </aside>
  );
}

export function DesktopHeader() {
  const [now, setNow] = useState(new Date());
  const language = useAppStore((s) => s.language);
  const displayName = useAppStore((s) => s.profile.displayName);
  const userName = useAppStore((s) => s.userName);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="desktop-header">
      <div className="desktop-header-time">
        <strong>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
        </strong>
        <span>{formatDesktopDate(now, language)}</span>
      </div>
      <div className="desktop-header-user">
        <span className="desktop-header-name">{displayName || userName || 'User'}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
