import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from '@/components/icons/AppIcon';
import { getMobileDockModules } from '@/features/navigation/appModuleRegistry';
import { resolveAppModuleIconName } from '@/features/navigation/appModuleIcon';
import type { AppModuleDefinition } from '@/features/navigation/types';
import { resolveDockActiveId } from '@/utils/dockNavigation';
import { useDockPreferenceStore } from '@/store/useDockPreferenceStore';
import './MobileTabBar.css';

const CHAT_ORB_ASSET = `${import.meta.env.BASE_URL}assets/navigation/rune-chat-moon-orb.png`;

/** Phone dock derived entirely from the canonical module Registry. */
export function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = useMemo(() => resolveDockActiveId(location.pathname) ?? 'home', [location.pathname]);
  const dockScale = useDockPreferenceStore((state) => state.dockScale);
  const collapsed = useDockPreferenceStore((state) => state.manuallyCollapsed);
  const collapseDock = useDockPreferenceStore((state) => state.collapseDock);
  const expandDock = useDockPreferenceStore((state) => state.expandDock);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const revealButtonRef = useRef<HTMLButtonElement>(null);
  const modules = useMemo(() => getMobileDockModules(), []);
  const chat = modules.find((module) => module.id === 'chat');
  const home = modules.find((module) => module.id === 'home');
  const music = modules.find((module) => module.id === 'music');
  const calendar = modules.find((module) => module.id === 'calendar');

  useEffect(() => {
    document.body.classList.toggle('mtb-visible', !collapsed);
    document.body.classList.toggle('mtb-hidden', collapsed);
    return () => document.body.classList.remove('mtb-visible', 'mtb-hidden');
  }, [collapsed]);

  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>('#app');
    if (!shell) return;
    shell.dataset.dockScale = dockScale;
    shell.dataset.dockCollapsed = String(collapsed);
    return () => { delete shell.dataset.dockScale; delete shell.dataset.dockCollapsed; };
  }, [collapsed, dockScale]);

  const go = (module: AppModuleDefinition) => navigate(module.route);
  const tab = (module: AppModuleDefinition | undefined) => module ? <button key={module.id} type="button" className={`mobile-tab-bar__item${activeId === module.id ? ' is-active' : ''}`} onClick={() => go(module)} aria-label={module.label} aria-current={activeId === module.id ? 'page' : undefined} data-tab-id={module.id}>
    {activeId === module.id && <span className="mobile-tab-bar__pill" aria-hidden="true" />}
    <span className="mobile-tab-bar__icon"><AppIcon name={resolveAppModuleIconName(module.id)} size={24} /></span>
    <span className="mobile-tab-bar__label">{module.label}</span>
  </button> : null;

  const collapse = () => {
    collapseDock();
    requestAnimationFrame(() => revealButtonRef.current?.focus());
  };
  const reveal = () => {
    expandDock();
    requestAnimationFrame(() => collapseButtonRef.current?.focus());
  };

  if (collapsed) return <button ref={revealButtonRef} type="button" className="mobile-dock-reveal" onClick={reveal} aria-label="展開導覽列" data-pet-safe-region="interactive">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5" /></svg>
  </button>;

  return (
    <nav className="mobile-tab-bar" aria-label="主要導航" data-dock-scale={dockScale} data-pet-safe-region="interactive">
      <div className="mobile-tab-bar__surface" aria-hidden="true" />
      <div className="mobile-tab-bar__items">
        {tab(home)}{tab(music)}
        <button type="button" className={`mobile-tab-bar__chat-orb${activeId === 'chat' ? ' is-active' : ''}`} onClick={() => chat && go(chat)} aria-label="聊天" aria-current={activeId === 'chat' ? 'page' : undefined} data-tab-id="chat" data-primary-navigation="true" data-pet-safe-region="interactive"><img src={CHAT_ORB_ASSET} alt="" aria-hidden="true" draggable={false} /></button>
        {tab(calendar)}
        <button ref={collapseButtonRef} type="button" className="mobile-tab-bar__item" onClick={collapse} aria-label="收合導覽列" data-tab-id="collapse">
          <span className="mobile-tab-bar__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></span><span className="mobile-tab-bar__label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}
