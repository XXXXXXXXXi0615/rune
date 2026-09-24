import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { rememberSettingsReturnRoute } from '@/components/settings/SettingsNavigation';
import { AllDrawers } from '@/components/drawers/AllDrawers';
import { AllModals } from '@/components/modals/AllModals';

/**
 * App Frame measured layout contract.
 * The Lunartide frame (#app) is a fixed phone-like column (max-width 430px)
 * at ANY browser width, so window-width media queries must not drive the
 * page's internal layout. Measure the frame and publish a data attribute
 * (narrow | wide) that page CSS can key on instead.
 */
const FRAME_NARROW_THRESHOLD = 520;

function useAppFrameSize() {
  useLayoutEffect(() => {
    const apply = () => {
      const frame = document.getElementById('app');
      if (!frame) return;
      const width = frame.getBoundingClientRect().width;
      document.documentElement.toggleAttribute('data-frame-size-narrow', width <= FRAME_NARROW_THRESHOLD);
      document.documentElement.setAttribute('data-frame-size', width <= FRAME_NARROW_THRESHOLD ? 'narrow' : 'wide');
    };
    apply();
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(apply)
      : null;
    if (observer) observer.observe(document.getElementById('app')!);
    const interval = typeof ResizeObserver === 'function'
      ? undefined
      : window.setInterval(apply, 500);
    return () => {
      observer?.disconnect();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);
}


import { UpdateCenter } from '@/components/UpdateCenter/UpdateCenter';
import { Toast } from '@/components/ui/Toast';
import { MobileTabBar } from '@/components/navigation/MobileTabBar';
import { SystemTopBar } from '@/components/layout/SystemTopBar';
import { FloatingAudioPlayer } from '@/components/layout/FloatingAudioPlayer';
import { ClawdPactWindow } from '@/components/layout/ClawdPactWindow';
import { DailyCacheWindow } from '@/components/cache/DailyCacheWindow';
import { CallMiniWindow } from '@/components/call/CallMiniWindow';
import { useFocusIslandStore } from '@/store/useFocusIslandStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { TopIslandHost } from '@/components/layout/TopIslandHost';
import { SupabaseSyncProvider } from '@/supabase';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ReadyGate } from '@/components/layout/ReadyGate';
import '@/styles/drawer.css';
import { resolveDockVisibility } from '@/utils/dockNavigation';
import { GlobalWallpaper } from '@/features/wallpaper/GlobalWallpaper';
import { FocusSettlementSheet } from '@/components/focus/FocusSettlementSheet';
import { DailyTideFloatingWindow } from '@/components/home/DailyTideFloatingWindow';
import { UsageHost } from '@/components/usage/UsageHost';
import { useTideRailSync } from '@/hooks/useTideRailSync';
import { CompanionPetHost } from '@/components/pet/CompanionPetHost';
import { GlobalChatCallHost } from '@/components/chat/call/GlobalChatCallHost';
import { isChatConversationRoute, isChatMomentRoute, isChatRoute } from '@/utils/chatRoutes';
import { isMusicRoute } from '@/utils/musicRoutes';
import { RuneUtilityHost } from '@/components/layout/RuneUtilityHost';
import { RuneCursorHost } from '@/components/cursor/RuneCursorHost';
import { useCompanionPetStore } from '@/store/useCompanionPetStore';

const RuneCursorProbe = import.meta.env.DEV
  ? lazy(() => import('@/components/cursor/RuneCursorProbe').then((module) => ({ default: module.RuneCursorProbe })))
  : null;

const COMPANION_BLOCKING_SURFACE_SELECTOR = [
  '[role="dialog"][aria-modal="true"]:not(.companion-menu)',
  '[role="alertdialog"][aria-modal="true"]',
  '[data-mobile-overlay-layer]',
  '.app-dialog-backdrop',
  '.app-sheet-backdrop',
  '.modal-overlay.active',
  '.menu-modal-overlay.active',
  '.quick-sheet-overlay.active',
].join(',');

function isVisibleSurface(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

/** AppShell is the single writer for route/overlay companion suppression. */
function useCompanionSuppression(pathname: string) {
  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const settingsOpen = pathname === '/settings' || pathname.startsWith('/settings/');
        const blockingSurfaceOpen = Array.from(document.querySelectorAll(COMPANION_BLOCKING_SURFACE_SELECTOR)).some(isVisibleSurface);
        useCompanionPetStore.getState().setSuppression('modal-critical', settingsOpen || blockingSurfaceOpen);
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden', 'aria-modal'] });
    window.addEventListener('resize', sync, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', sync);
      useCompanionPetStore.getState().setSuppression('modal-critical', false);
    };
  }, [pathname]);
}

/* ════════════════════════════════════════
   GlobalPortalLayer — shared by both shells
   ════════════════════════════════════════ */
function GlobalPortalLayer() {
  return (
    <ReadyGate>
      <UsageHost />
      <Toast />
      <FocusSettlementSheet />
      <CallMiniWindow />
      <DailyCacheWindow />
      <AllDrawers />
      <AllModals />
    </ReadyGate>
  );
}

/* ════════════════════════════════════════
   ImmersiveShell — bare page, no layout
   ════════════════════════════════════════ */
function ImmersiveShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div id="bg-layer" />
      <div className="app-content-layer">
        <SupabaseSyncProvider>
          {children}
        </SupabaseSyncProvider>
      </div>
      <GlobalPortalLayer />
    </>
  );
}

/* ════════════════════════════════════════
   StandardShell — full app layout
   ════════════════════════════════════════ */
function StandardShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isChat = isChatRoute(location.pathname);
  const isChatDetail = isChatConversationRoute(location.pathname);
  const isMoments = isChatMomentRoute(location.pathname);
  // Calendar Phase 3A-1: route-scoped wide workspace frame. Only /calendar may
  // widen #app beyond the canonical phone frame; every other route keeps it.
  const isCalendarWorkspace = location.pathname === '/calendar';
  const isMusic = isMusicRoute(location.pathname);
  const isMusicHome = isMusic && !location.pathname.startsWith('/music/listen/');
  const isMusicListen = location.pathname.startsWith('/music/listen/');
  useAppFrameSize();
  useEffect(() => { rememberSettingsReturnRoute(location.pathname); }, [location.pathname]);

  // Music pages have their own MusicDock; global dock visibility is resolved
  // by resolveDockVisibility() below.
  const islandState = useFocusIslandStore((s) => s.state);

  // Centralized body class management for music routes
  useLayoutEffect(() => {
    document.body.classList.toggle('lm-body', isMusicHome);
    document.body.classList.toggle('immersive-music', isMusicListen);
    document.body.classList.toggle('has-focus-island', islandState === 'compact' || islandState === 'expanded');
    document.body.style.overflow = (isMusicHome || isMusicListen) ? 'hidden' : '';
    return () => {
      document.body.classList.remove('lm-body', 'immersive-music');
      document.body.style.overflow = '';
    };
  }, [isMusicHome, isMusicListen, islandState]);

  return (
    <>
      <div id="bg-layer" />
      <div id="app" data-testid="app-shell-ready" className={`app-content-layer${isChat ? ' app--chat' : ''}${isChatDetail ? ' app--chat-detail' : ''}${isCalendarWorkspace ? ' app--calendar-wide' : ''}`}>
        <div className="app-workspace">
          <SystemTopBar />
          <main className={`app-main${isChat && !isMoments ? ' app-main--chat' : ''}`}>
            <SupabaseSyncProvider>
              {children}
            </SupabaseSyncProvider>
          </main>
        </div>
        <div className="mobile-dock-host" data-testid="mobile-dock-host">
          {!isChatDetail && resolveDockVisibility({ pathname: location.pathname }) && <MobileTabBar />}
        </div>
      <ReadyGate><Toast /></ReadyGate>
      <ReadyGate><FocusSettlementSheet /></ReadyGate>
      </div>
      <ReadyGate>
        <UpdateCenter />
        <FloatingAudioPlayer />
        <ErrorBoundary
          fallback="TIDEBOUND 暫時無法打開"
          description="發生未預期的錯誤，你可以回到首頁或重新嘗試。"
          onBack={() => {
            useFocusWindowStore.getState().closeWindow();
            useFocusIslandStore.getState().showCompact();
          }}
          onReload={() => {
            useFocusWindowStore.getState().closeWindow();
            useFocusIslandStore.getState().showCompact();
            window.location.href = '/';
          }}
          backLabel="回到首頁"
          secondaryLabel="重新嘗試"
          inline
        >
          {islandState === 'window' && <ClawdPactWindow />}
        </ErrorBoundary>
        <CallMiniWindow />
        <AllDrawers />
        <AllModals />
        <DailyCacheWindow />
      </ReadyGate>
    </>
  );
}

/* ════════════════════════════════════════
   AppShell — routes to correct shell
   ════════════════════════════════════════ */
export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const suppressGlobalPet = isMusicRoute(location.pathname) || location.pathname === '/tidewatch';
  const isImmersive = location.pathname === '/gacha' || location.pathname === '/call';

  useAppTheme();
  useTideRailSync();
  useCompanionSuppression(location.pathname);

  const hydrationRef = useRef(false);
  useEffect(() => {
    if (hydrationRef.current) return;
    hydrationRef.current = true;
    const ws = useFocusWindowStore.getState();
    const is = useFocusIslandStore.getState();
    if (is.state === 'window' && (!ws.isOpen || ws.isMinimized)) {
      useFocusIslandStore.getState().showCompact();
    }
  }, []);

  return (
    <>
      <RuneCursorHost />
      {RuneCursorProbe && <Suspense fallback={null}><RuneCursorProbe /></Suspense>}
      <GlobalWallpaper />
      {isImmersive
        ? <ImmersiveShell>{children}</ImmersiveShell>
        : <StandardShell>{children}</StandardShell>}
      {/* GlobalPetPortal — renders on BOTH Standard and Immersive routes */}
      <ReadyGate>
        <ErrorBoundary fallback="" inline><GlobalChatCallHost /></ErrorBoundary>
        {!suppressGlobalPet && <ErrorBoundary fallback="" inline><CompanionPetHost /></ErrorBoundary>}
        <ErrorBoundary fallback="" inline><DailyTideFloatingWindow /></ErrorBoundary>
        <ErrorBoundary fallback="" inline><TopIslandHost /></ErrorBoundary>
        <ErrorBoundary fallback="" inline><RuneUtilityHost /></ErrorBoundary>
      </ReadyGate>
    </>
  );
}
