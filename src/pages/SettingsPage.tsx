import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SettingsPageHeader } from '@/components/settings/SettingsNavigation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { useAppStore } from '@/store/useAppStore';
import { t, getLanguage } from '@/i18n';
import { TypographySettingsPage } from '@/components/settings/TypographySettingsPage';
import {
  SettingsModelsPanel,
  SettingsProvidersPanel,
  SettingsUsagePanel,
} from '@/components/settings/SettingsAiPanels';
import {
  SettingsDataExportPanel,
  SettingsDataImportPanel,
  SettingsDataResetPanel,
} from '@/components/settings/SettingsDataPanels';
import { McpConnectionsPanel } from '@/components/settings/McpConnectionsPanel';
import { StorageManagementPage } from '@/pages/settings/StorageManagementPage';
import { ReleaseHistoryPanel } from '@/components/settings/ReleaseHistoryPanel';
import { AppearanceSettingsPage } from '@/components/settings/AppearanceSettingsPage';
import { HomeClockSettingsPanel } from '@/components/settings/HomeClockSettingsPanel';
import { CalendarHolidaySettingsPanel } from '@/components/settings/CalendarHolidaySettingsPanel';
import { AgentCapabilitiesSettings } from '@/pages/settings/AgentCapabilitiesSettings';
import { SETTINGS_GROUPS, resolveLegacySettingsRoute } from '@/features/settings/settingsRegistry';
import { MemoryWorldPage } from '@/components/settings/MemoryWorldPage';
import { SharedIdentityEditor } from '@/components/identity/SharedIdentityEditor';
import { CompanionDisplaySettings } from '@/components/settings/CompanionDisplaySettings';

/* ── iOS-style stroke SVG icon set ── */
const ICON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICON_PATHS: Record<string, ReactNode> = {
  profile: <><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" /></>,
  font: <><path d="M6 3h12l-3 18h-6Z" /><line x1="8.5" y1="10" x2="15.5" y2="10" /></>,
  palette: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18c-2 0-2-2-2-3s2-3 2-5a3.2 3.2 0 0 0-3-3.5" /><circle cx="8.5" cy="9" r="0.8" fill="currentColor" stroke="none" /><circle cx="9.5" cy="7" r="0.5" fill="currentColor" stroke="none" /><circle cx="12" cy="6.5" r="0.5" fill="currentColor" stroke="none" /></>,
  color: <><circle cx="12" cy="12" r="9" /><path d="M7 14h10M9 10h6" /></>,
  dock: <><rect x="3" y="5" width="18" height="14" rx="4" /><path d="M8 15h8" /></>,
  cache: <><path d="M20 7h-7V2" /><path d="M20 7a9 9 0 1 0 1 9" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7h.01" /></>,
  plug: <><path d="M8 8V4h2v4M14 8V4h2v4" /><rect x="4" y="8" width="16" height="12" rx="2" /><circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" /></>,
  brain: <><circle cx="12" cy="13" r="3" /><path d="M12 10V4M10 6l2-2 2 2M4 14a4 4 0 0 1 4-4M16 14a4 4 0 0 1 4-4M8 18a4 4 0 0 0 8 0" /></>,
  chart: <><path d="M4 20h16" /><path d="M6 16v-3M10 20v-7M14 20V10M18 20v-5" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8.3 8.3l-7 7a2.1 2.1 0 0 1-3-3l7-7a5.9 5.9 0 0 1 8.3-8.3Z" />,
  exportArrow: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  importArrow: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 14 12 9 7 14" /><line x1="12" y1="9" x2="12" y2="21" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 15h10l1-15" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
};

function IosIcon({ name }: { name: string }) {
  const path = ICON_PATHS[name];
  if (!path) return <span className="ios-row-icon-fallback"><svg {...ICON}><circle cx="12" cy="12" r="9" /></svg></span>;
  return (
    <span className="ios-row-icon">
      <svg {...ICON}>
        {path}
      </svg>
    </span>
  );
}

const APP_VERSION = 'v1.0';

/* ── Detail view panel renderer ── */
function SettingsDetailPanel({ route }: { route: string }) {
  const isZh = useMemo(() => getLanguage() === 'zh-TW', []);
  const navigate = useNavigate();

  switch (route) {
    case '/settings/us/user': return <SharedIdentityEditor mode="user" isOpen onClose={() => navigate('/settings')} />;
    case '/settings/us/rune': return <SharedIdentityEditor mode="rune" isOpen onClose={() => navigate('/settings')} />;
    case '/settings/appearance/fonts': return <TypographySettingsPage />;
    case '/settings/appearance/wallpaper':
    case '/settings/appearance/colors':
    case '/settings/appearance/dock': return <AppearanceSettingsPage />;
    case '/settings/appearance/home-clock': return <HomeClockSettingsPanel />;
    case '/settings/appearance/calendar-holidays': return <CalendarHolidaySettingsPanel />;
    case '/settings/companion': return <CompanionDisplaySettings />;
    case '/settings/appearance/accent': return <TypographySettingsPage />;
    case '/settings/companion-pet':
    case '/settings/desktop-pet':
    case '/settings/desktop-pet/agent':
      return <Navigate to="/settings" replace />;
    case '/settings/lunaris/memory':
      return <MemoryWorldPage isOpen onClose={() => navigate('/settings')} />;
    case '/settings/privacy/agent-capabilities': return <AgentCapabilitiesSettings />;
    case '/settings/advanced/providers': return <SettingsProvidersPanel />;
    case '/settings/advanced/models': return <SettingsModelsPanel />;
    case '/settings/advanced/usage': return <SettingsUsagePanel />;
    case '/settings/advanced/mcp':
      return <McpConnectionsPanel />;
    case '/settings/data/export': return <SettingsDataExportPanel />;
    case '/settings/data/storage': return <StorageManagementPage />;
    case '/settings/data/import': return <SettingsDataImportPanel />;
    case '/settings/data/reset': return <SettingsDataResetPanel />;
    case '/settings/about':
      return (
        <div className="settings-module-stack settings-about-panel">
          <div className="settings-info-block">
            <strong>{isZh ? '關於 Rune' : 'About Rune'}</strong>
            <p>{isZh ? 'Rune 是一套本機優先的個人 AI 陪伴系統：聊天、記憶、手記、音樂與日常管理都在這裡。' : 'Rune is a local-first personal AI companion: chat, memory, journal, music and daily life in one place.'}</p>
          </div>
          <div className="settings-module-list">
            <div className="settings-standard-row"><span className="settings-standard-copy"><span>{isZh ? '版本' : 'Version'}</span><small>Rune {APP_VERSION}</small></span></div>
            <div className="settings-standard-row"><span className="settings-standard-copy"><span>{isZh ? '資料保存' : 'Data storage'}</span><small>{isZh ? '所有設定與內容保存在這台裝置的本機儲存空間' : 'All settings and content stay in this device\u2019s local storage.'}</small></span></div>
            <div className="settings-standard-row"><span className="settings-standard-copy"><span>{isZh ? '技術' : 'Stack'}</span><small>React · TypeScript · Vite · Zustand · Capacitor</small></span></div>
          </div>
          <ReleaseHistoryPanel />
        </div>
      );
    case '/settings/appearance/language':
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>語言設定已移除</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-4)' }}>目前僅支援繁體中文。未來多語版本會重新開放。</p>
        </div>
      );
    default:
      console.debug('[SettingsDetailPanel] unknown route key:', route);
      return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>未知的設定頁面</p>
          <code style={{ fontSize: 11, color: 'var(--danger)' }}>{route}</code>
        </div>
      );
  }
}

/* ══════════════════════════════════════
   EXIT RUNE — session lock + return to login gate
   ══════════════════════════════════════ */

function ExitRuneDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);
  return (
    <MobileShellOverlay variant="dialog" onClose={onCancel} className="settings-exit-overlay">
      <section className="rune-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rune-exit-title" aria-describedby="rune-exit-description" data-pet-safe-region="interactive">
        <h2 id="rune-exit-title">退出 Rune</h2>
        <p id="rune-exit-description">離開目前的 Rune 工作階段並返回登入門。<br/>你的資料與設定會保留在此裝置。</p>
        <div className="rune-exit-actions">
          <button ref={cancelRef} type="button" className="rune-exit-cancel" onClick={onCancel} data-testid="exit-rune-cancel">取消</button>
          <button type="button" className="rune-exit-confirm" onClick={onConfirm} data-testid="exit-rune-confirm">退出 Rune</button>
        </div>
      </section>
    </MobileShellOverlay>
  );
}

/* ══════════════════════════════════════
   MAIN SETTINGS PAGE
   ══════════════════════════════════════ */

export function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const lockAuth = useAppStore((state) => state.lockAuth);
  const [exitRuneOpen, setExitRuneOpen] = useState(false);

  const activeRoute = useMemo(() => {
    const appRoutes = SETTINGS_GROUPS.flatMap(g => g.rows.filter(r => r.route).map(r => r.route!));
    const allRoutes = [...appRoutes, '/settings/appearance/accent', '/settings/appearance/typography'];
    const match = allRoutes.includes(location.pathname) ? location.pathname : null;
    if (!match && location.pathname.startsWith('/settings/')) {
      console.debug('[SettingsPage] unmatched settings route:', location.pathname, 'known:', allRoutes);
    }
    return match;
  }, [location.pathname]);

  // Redirect legacy routes
  useEffect(() => {
    const target = resolveLegacySettingsRoute(location.pathname);
    if (target && target !== location.pathname) {
      navigate(target, { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!activeRoute) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      navigate('/settings');
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [navigate, activeRoute]);

  const activeGroup = activeRoute
    ? SETTINGS_GROUPS.find((group) => {
      return group.rows.some((row) => (row.route ?? '').split('#')[0] === activeRoute);
    })
    : null;
  const activeRow = activeRoute
    ? activeGroup?.rows.find(r => (r.route ?? '').split('#')[0] === activeRoute)
    : null;
  const aliasMeta = activeRoute === '/settings/appearance/accent'
    ? { group: '外觀', title: '文字與配色' }
    : null;

  // Hooks must be called unconditionally, before any early return.
  /* ── Detail view ── */
  if (activeRoute) {
    return (
      <><section id="settings-view" className="view settings-profile-view">
        <div className="settings-page-heading">
          <SettingsPageHeader parentLabel={activeGroup?.label || aliasMeta?.group} title={activeRow?.title || aliasMeta?.title || '設定'} />
        </div>
        <div className="ios-detail-scroll">
          <ErrorBoundary fallback="設定頁載入失敗" onBack={() => navigate('/settings')} inline>
            <SettingsDetailPanel route={activeRoute} />
          </ErrorBoundary>
        </div>
      </section></>
    );
  }

  return (
    <section id="settings-view" className="view settings-profile-view">
      <div className="settings-page-heading">
        <SettingsPageHeader title={t('settings.title')} subtitle="整理你與 Rune 共用的空間" />
      </div>

      <div className="settings-grid-scroll">
        <div className="settings-grid-layout settings-inset-layout">
          <div className="settings-inset-groups" aria-label="設定分類">
            {SETTINGS_GROUPS.map((group) => (
              <section className="settings-inset-group" key={group.key} data-settings-group={group.key}>
                <header><h2>{group.label}</h2><p>{group.description}</p></header>
                <div className="settings-inset-list">
                  {group.rows.map((row) => (
                    <button key={row.key} type="button" className="settings-inset-row" onClick={() => row.route && navigate(row.route)} data-settings-row={row.key} data-pet-safe-region="settings-entry">
                      <IosIcon name={row.icon} />
                      <span className="settings-inset-copy"><strong>{row.title}</strong><small>{row.subtitle}</small></span>
                      <span className="settings-inset-chevron" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="settings-exit-wrap">
            <button
              type="button"
              className="settings-exit-row"
              onClick={() => setExitRuneOpen(true)}
              data-testid="exit-rune-row"
            >
              退出 Rune
            </button>
          </div>

          <footer className="settings-grid-footer">
            <span>Rune {APP_VERSION}</span>
            <span>本機資料 · 儲存在此裝置</span>
          </footer>
        </div>
      </div>

      {exitRuneOpen && (
        <ExitRuneDialog
          onCancel={() => setExitRuneOpen(false)}
          onConfirm={() => {
            setExitRuneOpen(false);
            lockAuth();
            navigate('/login', { replace: true });
          }}
        />
      )}
    </section>
  );
}
