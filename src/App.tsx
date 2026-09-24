import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ObjectsLayout } from '@/components/layout/ObjectsLayout';
import { WorksPage } from '@/pages/WorksPage';
import { HomePage } from '@/pages/HomePage';
import { InspirationPage } from '@/pages/InspirationPage';
import { AuthGate } from '@/pages/AuthGate';
import { HealthHubRedirect } from '@/pages/HealthHubRedirect';
import { useAppStore } from '@/store/useAppStore';
import { useQuestStore } from '@/store/useQuestStore';
import { BrandMarkPreview } from '@/pages/BrandMarkPreview';
import { migrateCredentials } from '@/ai/credentialMigration';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LEGACY_ROUTE_REDIRECTS } from '@/utils/legacyRouteRedirects';
import { useHydrationStore } from '@/store/useHydrationStore';
import { migrateLifeLedgerFromLocalStorage } from '@/features/lifeLedger/migration';
import { useMessageTelemetrySubscription } from '@/features/tidewatch/useMessageTelemetrySubscription';

const Music = lazy(() => import('@/pages/Music/Music').then(m => ({ default: m.Music })));
const ImmersiveListeningPage = lazy(() => import('@/pages/Music/ImmersiveListeningPage').then(m => ({ default: m.ImmersiveListeningPage })));
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const CountdownsPage = lazy(() => import('@/pages/CountdownsPage').then(m => ({ default: m.CountdownsPage })));
const ChatEntry = lazy(() => import('@/pages/ChatEntry').then(m => ({ default: m.ChatEntry })));
const ChatLandingPage = lazy(() => import('@/pages/ChatLandingPage').then(m => ({ default: m.ChatLandingPage })));
const ChatMomentDetailPage = lazy(() => import('@/pages/ChatMomentDetailPage').then(m => ({ default: m.ChatMomentDetailPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ExchangePage = lazy(() => import('@/pages/ExchangePage').then(m => ({ default: m.ExchangePage })));
const PeriodPage = lazy(() => import('@/pages/PeriodPage').then(m => ({ default: m.PeriodPage })));
const PeriodTicketArchivePage = lazy(() => import('@/pages/PeriodTicketArchivePage').then(m => ({ default: m.PeriodTicketArchivePage })));
const LifeRhythmPage = lazy(() => import('@/pages/LifeRhythmPage').then(m => ({ default: m.LifeRhythmPage })));
const TimelinePage = lazy(() => import('@/pages/TimelinePage').then(m => ({ default: m.TimelinePage })));
const GachaPage = lazy(() => import('@/pages/GachaMachine').then(m => ({ default: m.GachaPage })));
const ObjectMemoryDashboardPage = lazy(() => import('@/pages/ObjectMemoryDashboardPage').then(m => ({ default: m.ObjectMemoryDashboardPage })));
const ObjectMemoryArchivePage = lazy(() => import('@/pages/ObjectMemoryArchivePage').then(m => ({ default: m.ObjectMemoryArchivePage })));
const ObjectMemoryDetailPage = lazy(() => import('@/pages/ObjectMemoryDetailPage').then(m => ({ default: m.ObjectMemoryDetailPage })));
const QuestPage = lazy(() => import('@/pages/QuestPage').then(m => ({ default: m.QuestPage })));
const TidewatchPage = lazy(() => import('@/pages/TidewatchPage').then(m => ({ default: m.TidewatchPage })));
const SimulatedCallPage = lazy(() => import('@/pages/SimulatedCallPage').then(m => ({ default: m.SimulatedCallPage })));
const RuneStashPage = lazy(() => import('@/pages/RuneStashPage').then(m => ({ default: m.RuneStashPage })));
const MoonLexPage = lazy(() => import('@/pages/MoonLexPage').then(m => ({ default: m.MoonLexPage })));
const TideRailPage = lazy(() => import('@/pages/TideRailPage').then(m => ({ default: m.TideRailPage })));
const InteractiveFrostPrototypePage = import.meta.env.DEV
  ? lazy(() => import('@/features/dev/interactiveFrost/InteractiveFrostPrototypePage'))
  : null;

function PageLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-3)', fontSize: 14 }}>
      載入中…
    </div>
  );
}

function RouteErrorBoundary({ children, fallback }: { children: ReactNode; fallback: string }) {
  const { pathname } = useLocation();

  return (
    <ErrorBoundary
      fallback={fallback}
      resetKeys={[pathname]}
      onReload={() => window.location.reload()}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Phase D: the Tide Ledger product is retired. The legacy `/ledger` URL family survives
 * only as a compatibility redirect — Exchange keeps its own deep link, everything else
 * (Moon Dew / money / subscriptions / views) lands on Home. No ledger shell ever renders.
 */
function LegacyLedgerRedirect() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('tab') === 'exchange') return <Navigate to="/exchange" replace />;
  return <Navigate to="/" replace />;
}

export default function App() {
  const auth = useAppStore((state) => state.auth);
  const todos = useAppStore((state) => state.todos || []);
  const legacyWater = useAppStore((state) => state.water);
  const migrateLegacyAppWater = useHydrationStore((state) => state.migrateLegacyAppWater);
  const migrateLegacyTodos = useQuestStore((state) => state.migrateLegacyTodos);
  const needsAuth = auth.authEnabled && (!auth.passwordHash || !auth.isUnlocked);

  // Global error instrumentation for debugging route transitions
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      console.error('[window.error]', e.message, '\n', e.error?.stack || '(no stack)');
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      console.error('[unhandledrejection]', e.reason?.message || e.reason, '\n', e.reason?.stack || '(no stack)');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  useEffect(() => {
    migrateLegacyTodos(todos);
  }, [migrateLegacyTodos, todos]);

  useEffect(() => {
    migrateLegacyAppWater(legacyWater);
  }, [legacyWater, migrateLegacyAppWater]);

  useEffect(() => {
    migrateCredentials().catch(() => {});
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      void import('@/features/lifeLedger/diagnostics').then(({ installLifeLedgerDevAudit }) => installLifeLedgerDevAudit());
    }
    if (!window.location.pathname.endsWith('/life-ledger')) {
      void migrateLifeLedgerFromLocalStorage().catch(() => {});
    }
  }, []);

  // TIDEWATCH writing telemetry subscription
  useMessageTelemetrySubscription();

  if (needsAuth) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<AuthGate />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {import.meta.env.DEV && <Route path="/__dev/brand-mark" element={<BrandMarkPreview />} />}
        {InteractiveFrostPrototypePage && (
          <Route
            path="/__dev/interactive-frost"
            element={<Suspense fallback={<PageLoading />}><InteractiveFrostPrototypePage /></Suspense>}
          />
        )}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/objects" element={<ErrorBoundary fallback="物品檔案載入失敗"><ObjectsLayout><Suspense fallback={null}><ObjectMemoryDashboardPage /></Suspense></ObjectsLayout></ErrorBoundary>} />
        <Route path="/objects/archive" element={<ErrorBoundary fallback="物品檔案載入失敗"><ObjectsLayout><Suspense fallback={null}><ObjectMemoryArchivePage /></Suspense></ObjectsLayout></ErrorBoundary>} />
        <Route path="/objects/:id" element={<ErrorBoundary fallback="物品檔案載入失敗"><ObjectsLayout><Suspense fallback={null}><ObjectMemoryDetailPage /></Suspense></ObjectsLayout></ErrorBoundary>} />
        <Route path="/*" element={(
          <AppShell>
            <Routes>
              <Route path="/" element={<RouteErrorBoundary fallback="首頁載入失敗"><HomePage /></RouteErrorBoundary>} />
              <Route path="/music/listen/:trackId" element={<ErrorBoundary fallback="播放頁載入失敗"><Suspense fallback={<PageLoading />}><ImmersiveListeningPage /></Suspense></ErrorBoundary>} />
              <Route path="/music/*" element={<ErrorBoundary fallback="音訊頁載入失敗"><Suspense fallback={<PageLoading />}><Music /></Suspense></ErrorBoundary>} />
              <Route path="/calendar" element={<ErrorBoundary fallback="日曆頁載入失敗"><Suspense fallback={<PageLoading />}><CalendarPage /></Suspense></ErrorBoundary>} />
              <Route path="/calendar/countdowns" element={<ErrorBoundary fallback="倒數頁載入失敗"><Suspense fallback={<PageLoading />}><CountdownsPage /></Suspense></ErrorBoundary>} />
              <Route path="/quests" element={<ErrorBoundary fallback="任務欄載入失敗"><Suspense fallback={<PageLoading />}><QuestPage /></Suspense></ErrorBoundary>} />
              {/* Phase D.1: the 潮軌 entry renders the canonical TideRail page again
                  (the retired /usage dashboard redirect had no navigation owner). */}
              <Route path="/quests/tiderail" element={<ErrorBoundary fallback="潮軌載入失敗"><Suspense fallback={<PageLoading />}><TideRailPage /></Suspense></ErrorBoundary>} />
              <Route path="/tidewatch" element={<ErrorBoundary fallback="觀測站載入失敗"><Suspense fallback={<PageLoading />}><TidewatchPage /></Suspense></ErrorBoundary>} />
              {/* Phase D.1: the legacy /usage analytics dashboard was retired (no
                  navigation owner); the Utility Island palette owns today-state now. */}
              <Route path="/usage" element={<Navigate to="/" replace />} />
              <Route path="/focus" element={<Navigate to={LEGACY_ROUTE_REDIRECTS['/focus']} replace />} />
              <Route path="/focus/traces" element={<Navigate to={LEGACY_ROUTE_REDIRECTS['/focus/traces']} replace />} />
              <Route path="/works" element={<ErrorBoundary fallback="作品頁載入失敗"><WorksPage /></ErrorBoundary>} />
              <Route path="/inspiration" element={<ErrorBoundary fallback="靈感頁載入失敗"><InspirationPage /></ErrorBoundary>} />
              <Route path="/period" element={<ErrorBoundary fallback="生理期頁載入失敗"><Suspense fallback={<PageLoading />}><PeriodPage /></Suspense></ErrorBoundary>} />
              <Route path="/period/tickets" element={<ErrorBoundary fallback="票根收藏載入失敗"><Suspense fallback={<PageLoading />}><PeriodTicketArchivePage /></Suspense></ErrorBoundary>} />
              <Route path="/health" element={<HealthHubRedirect />} />
              <Route path="/health/*" element={<HealthHubRedirect />} />
              <Route path="/life-rhythm" element={<ErrorBoundary fallback="生活節奏頁載入失敗"><Suspense fallback={<PageLoading />}><LifeRhythmPage /></Suspense></ErrorBoundary>} />
              <Route path="/todo" element={<Navigate to={LEGACY_ROUTE_REDIRECTS['/todo']} replace />} />
              <Route path="/todos" element={<Navigate to={LEGACY_ROUTE_REDIRECTS['/todos']} replace />} />
              <Route path="/chat" element={<RouteErrorBoundary fallback="聊天頁載入失敗"><Suspense fallback={<PageLoading />}><ChatLandingPage /></Suspense></RouteErrorBoundary>} />
              <Route path="/chat/moments" element={<RouteErrorBoundary fallback="朋友圈載入失敗"><Suspense fallback={<PageLoading />}><ChatLandingPage /></Suspense></RouteErrorBoundary>} />
              <Route path="/chat/moments/:postId" element={<RouteErrorBoundary fallback="動態詳情載入失敗"><Suspense fallback={<PageLoading />}><ChatMomentDetailPage /></Suspense></RouteErrorBoundary>} />
              <Route path="/chat/:conversationId" element={<RouteErrorBoundary fallback="聊天頁載入失敗"><Suspense fallback={<PageLoading />}><ChatEntry /></Suspense></RouteErrorBoundary>} />
              <Route path="/chat/luna" element={<Navigate to="/chat" replace />} />
              <Route path="/clawd" element={<Navigate to={LEGACY_ROUTE_REDIRECTS['/clawd']} replace />} />
              <Route path="/pet-appearance" element={<Navigate to="/settings" replace />} />
              <Route path="/call" element={<ErrorBoundary fallback="通話頁載入失敗"><Suspense fallback={<PageLoading />}><SimulatedCallPage /></Suspense></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary fallback="設定頁載入失敗"><Suspense fallback={<PageLoading />}><SettingsPage /></Suspense></ErrorBoundary>} />
              <Route path="/settings/*" element={<ErrorBoundary fallback="設定頁載入失敗"><Suspense fallback={<PageLoading />}><SettingsPage /></Suspense></ErrorBoundary>} />
              {/* Phase D: the Tide Ledger product is retired — Moon Dew lives in the Home
                  報備 window and Exchange is the standalone /exchange utility. The legacy
                  ledger URL survives only as a compatibility redirect; no ledger shell is
                  ever rendered. Finance data (moneyTransactions / Life Ledger entries and
                  receipts) is untouched by this retirement. */}
              <Route path="/subscriptions" element={<Navigate to="/" replace />} />
              <Route path="/ledger" element={<LegacyLedgerRedirect />} />
              <Route path="/exchange" element={<ErrorBoundary fallback="換匯頁載入失敗"><Suspense fallback={<PageLoading />}><ExchangePage /></Suspense></ErrorBoundary>} />
              <Route path="/life-ledger" element={<Navigate to="/calendar?view=life" replace />} />
              <Route path="/profile" element={<Navigate to="/chat?openIdentitySettings=1" replace />} />
              <Route path="/diet" element={<Navigate to="/calendar" replace />} />
              <Route path="/stash" element={<ErrorBoundary fallback="素材庫載入失敗"><Suspense fallback={<PageLoading />}><RuneStashPage /></Suspense></ErrorBoundary>} />
              <Route path="/moonlex" element={<ErrorBoundary fallback="MoonLex 載入失敗"><Suspense fallback={<PageLoading />}><MoonLexPage /></Suspense></ErrorBoundary>} />
              <Route path="/moonread/*" element={<Navigate to="/stash" replace />} />
              <Route path="/reading/*" element={<Navigate to="/stash" replace />} />
              <Route path="/timekeeper" element={<Navigate to="/calendar?tab=timekeeper" replace />} />
              <Route path="/timeline" element={<ErrorBoundary fallback="時間軸載入失敗"><Suspense fallback={<PageLoading />}><TimelinePage /></Suspense></ErrorBoundary>} />
              <Route path="/gacha" element={<ErrorBoundary fallback="月潮回饋載入失敗"><Suspense fallback={<PageLoading />}><GachaPage /></Suspense></ErrorBoundary>} />
            </Routes>
          </AppShell>
        )} />
      </Routes>
    </BrowserRouter>
  );
}
