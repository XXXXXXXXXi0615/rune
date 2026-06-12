import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from '@/pages/HomePage';
import { Music } from '@/pages/Music/Music';
import { CalendarPage } from '@/pages/CalendarPage';
import { MoonReadPage } from '@/pages/MoonReadPage';
import { MemoryPage } from '@/pages/MemoryPage';
import { ChatPage } from '@/pages/ChatPage';
import { ChatInboxPage } from '@/pages/ChatInboxPage';
import { SystemActivityPage } from '@/pages/SystemActivityPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PetAppearancePage } from '@/pages/PetAppearancePage';
import { ProfilePage } from '@/pages/ProfilePage';

import { Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: string }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-3)', fontSize: 14 }}>
          {this.props.fallback || '頁面載入失敗'}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
          <Route path="/music" element={<ErrorBoundary fallback="音樂頁載入失敗"><Music /></ErrorBoundary>} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/moon-reading" element={<MoonReadPage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/chat" element={<ChatInboxPage />} />
          <Route path="/chat/luna" element={<ChatPage />} />
          <Route path="/chat/system" element={<SystemActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/pet-appearance" element={<PetAppearancePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
