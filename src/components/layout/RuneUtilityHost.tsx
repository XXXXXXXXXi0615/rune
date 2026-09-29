import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RuneBrandLogo } from '@/components/branding/RuneBrandLogo';
import { MobileShellOverlay } from '@/components/layout/MobileShellOverlay';
import { AppIcon } from '@/components/icons/AppIcon';
import { getModuleById } from '@/features/navigation/appModuleRegistry';
import { resolveAppModuleIconName } from '@/features/navigation/appModuleIcon';
import type { AppModuleDefinition } from '@/features/navigation/types';
import { RUNE_ORBIT_PRIMARY_MODULE_IDS, RUNE_ORBIT_SECONDARY_MODULE_IDS, RUNE_ORBIT_SLOTS } from '@/features/navigation/runeOrbitMenu';
import { usePetRecede } from '@/hooks/usePetRecede';
import { useDrawerStore } from '@/store/useDrawerStore';
import { useModalStore } from '@/store/useModalStore';
import { useRuneUtilityStore } from '@/store/useRuneUtilityStore';
import { useCompanionPetStore, type CompanionBreakpoint } from '@/store/useCompanionPetStore';
import { isMusicRoute } from '@/utils/musicRoutes';
import './RuneUtilityHost.css';

const MENU_ID = 'rune-launcher-menu';
const TRIGGER_SELECTOR = '[data-testid="route-status-island"]';
const MODULE_IDS: readonly AppModuleDefinition['id'][] = [...RUNE_ORBIT_PRIMARY_MODULE_IDS, ...RUNE_ORBIT_SECONDARY_MODULE_IDS];
const routeKeyOf = (pathname: string) => pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
const currentCompanionBreakpoint = (): CompanionBreakpoint => window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop';

function companionRouteNotice(pathname: string, packId: string): string | null {
  if (isMusicRoute(pathname) || pathname === '/tidewatch') return '此頁目前不載入桌寵；返回支援頁面後即可顯示。';
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return '桌寵目前不在設定頁顯示；返回支援頁面後即可顯示。';
  if (pathname === '/calendar' || (pathname === '/moonlex' && packId === 'clawd')) return '桌寵目前不在此頁顯示；返回支援頁面後即可顯示。';
  return null;
}

function CompanionRecoveryPanel({ pathname, onBack }: { pathname: string; onBack: () => void }) {
  const preferences = useCompanionPetStore((state) => state.preferences);
  const transientHidden = useCompanionPetStore((state) => state.transientHidden);
  const suppressionReasons = useCompanionPetStore((state) => state.suppressionReasons);
  const setEnabled = useCompanionPetStore((state) => state.setEnabled);
  const setTransientHidden = useCompanionPetStore((state) => state.setTransientHidden);
  const setPinned = useCompanionPetStore((state) => state.setPinned);
  const setScale = useCompanionPetStore((state) => state.setScale);
  const resetPosition = useCompanionPetStore((state) => state.resetPosition);
  const setRoutePresentation = useCompanionPetStore((state) => state.setRoutePresentation);
  const resetRoutePresentation = useCompanionPetStore((state) => state.resetRoutePresentation);
  const routeKey = routeKeyOf(pathname);
  const routeHidden = preferences.routePresentation[routeKey]?.hidden === true;
  const notice = companionRouteNotice(pathname, preferences.selectedPetPackId);
  const status = notice ?? (!preferences.enabled || preferences.manuallyHidden || transientHidden ? '桌寵目前已全域隱藏。'
    : routeHidden ? '桌寵目前在此頁隱藏。'
      : suppressionReasons.some((reason) => reason !== 'modal-critical') ? '目前有視窗遮擋桌寵；關閉後即可顯示。'
        : '桌寵可在此頁顯示。');

  return <section id="companion-recovery-panel" className="rune-companion-recovery" role="group" aria-label="找回桌寵" data-testid="companion-recovery-panel">
    <div className="rune-companion-recovery__heading">
      <strong>找回桌寵</strong>
      <button type="button" onClick={onBack} aria-label="返回 Rune 快捷工具">返回</button>
    </div>
    <p role="status">{status}</p>
    <div className="rune-companion-recovery__actions">
      <button type="button" onClick={() => { setEnabled(true); setTransientHidden(false); }}>顯示桌寵</button>
      <button type="button" onClick={() => setRoutePresentation(routeKey, { hidden: false })}>在目前頁面顯示</button>
      <button type="button" onClick={() => setPinned(false)}>解除鎖定</button>
      <button type="button" onClick={() => resetRoutePresentation(routeKey)}>重設目前頁面位置</button>
    </div>
    <label className="rune-companion-recovery__default-scale">
      <span>預設大小</span>
      <input type="range" min="0.75" max="1.35" step="0.05" value={preferences.scale} aria-label="預設桌寵大小" onChange={(event) => setScale(Number(event.target.value))} />
      <output>{Math.round(preferences.scale * 100)}%</output>
    </label>
    <button type="button" className="rune-companion-recovery__default-reset" onClick={() => resetPosition(currentCompanionBreakpoint())}>重設目前裝置尺寸的預設位置</button>
  </section>;
}

function RuneUtilityMenu({ onSelect }: { onSelect: (module: AppModuleDefinition) => void }) {
  const slots = useMemo(() => RUNE_ORBIT_SLOTS.flatMap((slot) => {
    const module = getModuleById(MODULE_IDS[slot.index]);
    return module ? [{ slot, module }] : [];
  }), []);
  return <div id={MENU_ID} className="rune-launcher-actions" role="menu" aria-label="Rune 快捷工具">
    {slots.map(({ slot, module }) => <button key={slot.index} type="button" className="rune-launcher-action" data-orbit-slot={slot.index} role="menuitem" aria-label={`打開${module.label}`} onClick={() => onSelect(module)}>
      <span className="rune-launcher-action__icon" aria-hidden="true"><AppIcon name={resolveAppModuleIconName(module.id)} size={18} /></span>
      <span className="rune-launcher-action__label">{module.label}</span>
    </button>)}
  </div>;
}

function focusTrigger() {
  document.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR)?.focus();
}

export function RuneUtilityHost() {
  const navigate = useNavigate();
  const location = useLocation();
  const open = useRuneUtilityStore((state) => state.open);
  const closeLauncher = useRuneUtilityStore((state) => state.closeLauncher);
  const activeModal = useModalStore((state) => state.activeModal);
  const activeSheet = useModalStore((state) => state.activeSheet);
  const activeDrawer = useDrawerStore((state) => state.activeDrawer);
  const [mobile, setMobile] = useState(() => window.innerWidth <= 600);
  const [domBlocked, setDomBlocked] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const recoveryRef = useRef<HTMLButtonElement>(null);
  const immersive = location.pathname === '/gacha' || location.pathname === '/call';
  const blocked = Boolean(activeModal || activeSheet || activeDrawer || domBlocked || immersive);
  const visible = open && !blocked;
  usePetRecede(visible);

  const dismiss = useCallback((returnFocus = true) => {
    setRecoveryOpen(false);
    closeLauncher();
    if (returnFocus) requestAnimationFrame(focusTrigger);
  }, [closeLauncher]);

  useEffect(() => {
    if (visible && recoveryOpen) requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('.rune-companion-recovery__actions button')?.focus());
  }, [visible, recoveryOpen]);

  useEffect(() => {
    const update = () => {
      setMobile(window.innerWidth <= 600);
      const trigger = document.querySelector<HTMLElement>(TRIGGER_SELECTOR);
      const rect = trigger?.getBoundingClientRect();
      const frame = document.querySelector<HTMLElement>('#app')?.getBoundingClientRect();
      if (!rect || !frame) return;
      const width = Math.min(330, frame.width - 16);
      setAnchor({
        left: Math.max(frame.left + 8, Math.min(rect.left - 8, frame.right - width - 8)),
        top: Math.min(rect.bottom + 8, window.innerHeight - 218),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [open, location.pathname]);

  useEffect(() => {
    const update = () => setDomBlocked(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not(.rune-utility-sheet), .msg-popover-overlay, [data-testid="active-call-view"]')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-hidden'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (blocked && open) closeLauncher();
  }, [blocked, open, closeLauncher]);

  useEffect(() => {
    if (!visible) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    if (mobile) requestAnimationFrame(() => first?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
      const menu = menuRef.current;
      if (!menu) return;
      const actions = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
      if (event.key === 'Tab' && actions.length) {
        if (!event.shiftKey && document.activeElement === actions.at(-1)) {
          event.preventDefault();
          recoveryRef.current?.focus();
          return;
        }
        if (event.shiftKey && document.activeElement === recoveryRef.current) {
          event.preventDefault();
          actions.at(-1)?.focus();
          return;
        }
      }
      if (event.key.startsWith('Arrow') && actions.length) {
        event.preventDefault();
        const index = actions.indexOf(document.activeElement as HTMLButtonElement);
        actions[(index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + actions.length) % actions.length]?.focus();
      }
      if (mobile && event.key === 'Tab') {
        const focusable = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
        const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
        if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, mobile, dismiss]);

  useEffect(() => {
    if (!visible || mobile) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || document.querySelector(TRIGGER_SELECTOR)?.contains(target))) return;
      dismiss();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [visible, mobile, dismiss]);

  useEffect(() => { setRecoveryOpen(false); closeLauncher(); }, [location.pathname, closeLauncher]);

  const selectAppModule = (module: AppModuleDefinition) => {
    dismiss(false);
    navigate(module.route);
  };

  const recoveryContent = <>
    <button ref={recoveryRef} type="button" className="rune-launcher-recovery-entry" aria-label="找回桌寵" aria-expanded={recoveryOpen} aria-controls="companion-recovery-panel" onClick={() => setRecoveryOpen(true)}>找回桌寵</button>
    {recoveryOpen && <CompanionRecoveryPanel pathname={location.pathname} onBack={() => { setRecoveryOpen(false); requestAnimationFrame(() => recoveryRef.current?.focus()); }} />}
  </>;

  if (!visible) return null;
  if (mobile) return <MobileShellOverlay variant="sheet" className="rune-utility-sheet-backdrop" onClose={() => dismiss()}>
    <section ref={menuRef} className="rune-utility-sheet" role="dialog" aria-modal="true" aria-label="Rune 快捷工具">
      <header><RuneBrandLogo decorative /><span>應用</span></header>
      <RuneUtilityMenu onSelect={selectAppModule} />
      {recoveryContent}
      <button type="button" className="rune-utility-sheet__close" onClick={() => dismiss()}>關閉</button>
    </section>
  </MobileShellOverlay>;
  return <div ref={menuRef} className={`rune-launcher-popover${recoveryOpen ? ' is-recovery-open' : ''}`} style={{ left: anchor.left, top: anchor.top }} data-testid="rune-launcher-popover">
    <RuneUtilityMenu onSelect={selectAppModule} />
    {recoveryContent}
  </div>;
}
