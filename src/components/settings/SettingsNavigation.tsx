import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const RETURN_ROUTE_KEY = 'lunartide_settings_return_route_v1';

export function rememberSettingsReturnRoute(pathname: string) {
  if (pathname.startsWith('/settings')) return;
  try { sessionStorage.setItem(RETURN_ROUTE_KEY, pathname || '/'); } catch { /* session-only navigation hint */ }
}

export function getSettingsParentRoute(pathname: string): string {
  if (pathname === '/settings') {
    try {
      const saved = sessionStorage.getItem(RETURN_ROUTE_KEY);
      return saved && saved.startsWith('/') && !saved.startsWith('/settings') ? saved : '/';
    } catch { return '/'; }
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 2) return '/settings';
  return `/${segments.slice(0, -1).join('/')}`;
}

export function SettingsBreadcrumb({ pathname, label }: { pathname: string; label?: string }) {
  if (pathname === '/settings') return null;
  const labels: Record<string, string> = { appearance: '外觀', lunaris: '智能體', 'desktop-pet': '桌寵', advanced: '進階', data: '資料與儲存空間', about: '關於 Rune', modules: '應用管理' };
  const parent = pathname.split('/').filter(Boolean)[1];
  return <nav className="settings-breadcrumb" aria-label="設定路徑"><span>{label || labels[parent] || '設定'}</span></nav>;
}

export function SettingsPageHeader({ title, subtitle, parentLabel }: { title: string; subtitle?: string; parentLabel?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useCallback(() => navigate(getSettingsParentRoute(location.pathname)), [location.pathname, navigate]);
  return <header className="settings-shared-header">
    <button type="button" className="settings-back-button" onClick={goBack} aria-label="返回" title="返回" data-pet-safe-region="settings-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
    <div className="settings-shared-header-copy">
      <SettingsBreadcrumb pathname={location.pathname} label={parentLabel} />
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  </header>;
}
