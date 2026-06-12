import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AllDrawers } from '@/components/drawers/AllDrawers';
import { AllModals } from '@/components/modals/AllModals';
import { BottomNav } from '@/components/layout/BottomNav';
import { MiniPlayer } from '@/components/layout/MiniPlayer';
import { Component } from 'react';
import { PetWidget } from '@/components/PetWidget/PetWidget';
import { Toast } from '@/components/ui/Toast';
import { DesktopHeader, DesktopSidebar } from '@/components/layout/DesktopChrome';
import '@/styles/drawer.css';

class SafeMiniPlayer extends Component<Record<string, never>, { hasError: boolean }> {
  constructor(props: Record<string, never>) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    try { return <MiniPlayer />; } catch { return null; }
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const location = useLocation();
  const isChat = location.pathname === '/chat/luna';
  const isSettings = location.pathname === '/settings';

  useEffect(() => {
    const applyTheme = () => {
      const resolved: 'dark' | 'light' =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <>
      {/* Background layer */}
      <div id="bg-layer" />

      {/* Main app container */}
      <div id="app">
        <DesktopSidebar />
        <div className="app-workspace">
          <DesktopHeader />
          <main className={`app-main ${isChat ? 'app-main--chat' : ''} ${isSettings ? 'app-main--settings' : ''}`}>
            {children}
          </main>
        </div>
        <SafeMiniPlayer />
        <BottomNav />
        <Toast />
      </div>

      {/* Pet Widget */}
      <PetWidget />

      {/* Drawer & Modal layers */}
      <AllDrawers />
      <AllModals />
    </>
  );
}
