import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { restoreTypography } from '@/features/typography/applyTypography';
import { restoreAppearanceColors } from '@/features/typography/appearanceColors';
import './styles/global.css';
import './styles/chat.css'
import './styles/chat-moments.css';
import './styles/memory.css'
import './styles/calendar.css';
import './styles/music.css';
import './styles/settings.css';
import './styles/home.css';
import './styles/moonread.css';
import './styles/mobile-shell.css';
import './styles/frosted.css';
import './features/wallpaper/wallpaper.css';
import './styles/pet.css';
import './styles/diary.css';
import './styles/diary-lock.css';
import './styles/auth.css';
import './styles/moon-gate.css';
import './themes/lunartide.css';
import './themes/theme-presets.css';
import App from './App';
import { ThemePresetProvider } from './themes/ThemePresetProvider';
import { runAssetMigration, runClawdDecommissionMigration } from './store/migration';
import { useAppStore } from './store/useAppStore';
import { initializeMobileShell } from './native/mobileShell';
import { onShellReady, signalBootSplashRemoved, signalShellReady } from './components/layout/BootOverlayCoordinator';
import { installMomentsAgentDevHarness } from './features/moments/agentTools';

if (import.meta.env.DEV) {
  window.__store = useAppStore;
  installMomentsAgentDevHarness();
}

const DEV_SW_CLEANUP_KEY = 'lunartide-dev-sw-cleaned';

async function clearDevelopmentCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function configureServiceWorker() {
  if (import.meta.env.PROD) {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
        console.warn('[lunartide] Service Worker registration failed', error);
      });
    });
    return;
  }

  if (!import.meta.env.DEV) return;

  if (!('serviceWorker' in navigator)) {
    await clearDevelopmentCaches();
    return;
  }

  const wasControlled = navigator.serviceWorker.controller !== null;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  await clearDevelopmentCaches();

  if (wasControlled && sessionStorage.getItem(DEV_SW_CLEANUP_KEY) !== 'true') {
    sessionStorage.setItem(DEV_SW_CLEANUP_KEY, 'true');
    window.location.reload();
    return;
  }

  sessionStorage.removeItem(DEV_SW_CLEANUP_KEY);
}

void configureServiceWorker().catch((error) => {
  console.warn('[lunartide] Service Worker cleanup failed', error);
});

void initializeMobileShell().catch((error) => {
  console.warn('[lunartide] Native shell initialization failed', error);
});

const splashEl = document.getElementById('pre-splash');
const splashSubEl = document.getElementById('pre-splash-sub');
const splashLogoEl = document.querySelector<HTMLImageElement>('.boot-splash__main-logo');
const appRootEl = document.getElementById('root');
let splashDismissed = false;
let splashRemoveTimer: number | undefined;
let splashMessageTimer: number | undefined;
let splashFailureTimer: number | undefined;
const splashStartedAt = performance.now();

const ENTRANCE_DEADLINE_MS = 1400;
const EXIT_DURATION_MS = 480;
const MIN_VISIBLE_MS = 2000;
const MESSAGE_DELAY_MS = 1500;
const ERROR_TIMEOUT_MS = 8000;

function waitForSplashLogo(): Promise<void> {
  if (!splashEl) return Promise.resolve();
  if (!splashLogoEl) return Promise.reject(new Error('Boot splash logo element is missing'));

  const decodeLogo = () => splashLogoEl.decode?.() ?? Promise.resolve();

  if (splashLogoEl.complete) {
    if (splashLogoEl.naturalWidth === 0) return Promise.reject(new Error('Boot splash logo failed to load'));
    return decodeLogo();
  }

  return new Promise<void>((resolve, reject) => {
    splashLogoEl.addEventListener('load', () => { void decodeLogo().then(resolve, reject); }, { once: true });
    splashLogoEl.addEventListener('error', () => reject(new Error('Boot splash logo failed to load')), { once: true });
  });
}

const splashLogoReady = waitForSplashLogo().then(
  () => ({ error: null as Error | null }),
  (error: unknown) => ({ error: error instanceof Error ? error : new Error(String(error)) }),
);

function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearTimers() {
  if (splashRemoveTimer) { window.clearTimeout(splashRemoveTimer); splashRemoveTimer = undefined; }
  if (splashMessageTimer) { window.clearTimeout(splashMessageTimer); splashMessageTimer = undefined; }
  if (splashFailureTimer) { window.clearTimeout(splashFailureTimer); splashFailureTimer = undefined; }
}

function removeSplash() {
  clearTimers();
  if (splashEl) splashEl.dataset.splashPhase = 'hidden';
  splashEl?.remove();
  appRootEl?.removeAttribute('inert');
  document.documentElement.classList.remove('boot-lock');
  document.documentElement.removeAttribute('data-boot-splash-active');
  signalBootSplashRemoved();
  // Expose cleanup evidence for e2e
  (window as typeof window & { __bootCleanup?: Record<string, unknown> }).__bootCleanup = {
    splashRemoved: true,
    bootLockClass: document.documentElement.classList.contains('boot-lock'),
    bootSplashAttr: document.documentElement.hasAttribute('data-boot-splash-active'),
    rootInert: appRootEl?.hasAttribute('inert') ?? false,
    activeTimers: (splashRemoveTimer ? 1 : 0) + (splashMessageTimer ? 1 : 0) + (splashFailureTimer ? 1 : 0),
  };
}

/**
 * Entrance gate with defensive deadline.
 * Uses Promise.race between actual animation-completion detection
 * and a 1400ms deadline. Deadline only removes the entrance gate —
 * shellReady + minimum-display must still be satisfied.
 */
function waitForEntranceGate(): Promise<void> {
  const deadlineMs = ENTRANCE_DEADLINE_MS;
  let rAfId = 0;
  return new Promise<void>((resolve) => {
    const deadline = window.setTimeout(() => {
      cancelAnimationFrame(rAfId);
      resolve();
    }, deadlineMs);

    const check = () => {
      if (!splashEl) { clearTimeout(deadline); resolve(); return; }
      const animations = splashEl.getAnimations();
      const allDone = animations.every((a) => {
        if (!(a instanceof Animation)) return true;
        return a.playState === 'finished' || a.playState === 'idle';
      });
      if (allDone && performance.now() - splashStartedAt > 180) {
        clearTimeout(deadline);
        resolve();
      } else {
        rAfId = requestAnimationFrame(check);
      }
    };
    rAfId = requestAnimationFrame(check);
  });
}

function dismissSplash() {
  if (splashDismissed || !splashEl) return;
  splashDismissed = true;

  const elapsed = performance.now() - splashStartedAt;
  const waitForMin = Math.max(0, MIN_VISIBLE_MS - elapsed);

  // Entrance gate: Promise.race(animation completion, deadline)
  // The deadline gate only unblocks the entrance requirement.
  // Minimum display + shellReady are separate gates.
  waitForEntranceGate().then(() => {
    if (!splashEl || splashEl.dataset.splashPhase === 'hidden') return;

    // Minimum display: add remaining wait after entrance gate resolved
    const now = performance.now();
    const stillWait = Math.max(0, MIN_VISIBLE_MS - (now - splashStartedAt));
    const finalWait = Math.max(waitForMin, stillWait);

    const doExit = () => {
      if (!splashEl || splashEl.dataset.splashPhase === 'hidden') return;

      splashEl.dataset.splashPhase = 'exiting';

      if (isReducedMotion()) {
        splashRemoveTimer = window.setTimeout(removeSplash, 300);
        return;
      }

      document.documentElement.removeAttribute('data-boot-splash-active');

      splashRemoveTimer = window.setTimeout(() => {
        removeSplash();
      }, EXIT_DURATION_MS);
    };

    if (finalWait <= 0) {
      doExit();
    } else {
      splashRemoveTimer = window.setTimeout(doExit, finalWait);
    }
  });
}

// BFCache detection — pageshow with persisted=true means BFCache restore, not hard reload
let bfcacheRestored = false;
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    bfcacheRestored = true;
    if (splashEl && !splashDismissed) {
      removeSplash();
    }
  }
});

// Visibility gate: if page loaded while hidden, handle visibility change
let pageWasHiddenOnLoad = document.visibilityState === 'hidden';
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pageWasHiddenOnLoad && !bfcacheRestored) {
    pageWasHiddenOnLoad = false;
  }
});

if (splashEl) {
  if (bfcacheRestored) {
    removeSplash();
  } else {
    document.documentElement.classList.add('boot-lock');
    document.documentElement.dataset.bootSplashActive = 'true';
    appRootEl?.setAttribute('inert', '');
    splashEl.dataset.splashPhase = 'entering';
    requestAnimationFrame(() => { if (!splashDismissed) splashEl.dataset.splashPhase = 'visible'; });

    splashMessageTimer = window.setTimeout(() => {
      if (!splashDismissed && splashSubEl) {
        splashSubEl.textContent = '正在整理本機記憶……';
        splashSubEl.classList.add('visible');
      }
    }, MESSAGE_DELAY_MS);

    splashFailureTimer = window.setTimeout(() => {
      if (!splashDismissed && splashSubEl) {
        splashEl.dataset.splashPhase = 'error-stopped';
        splashSubEl.innerHTML =
          '月潮沒有順利醒來<br><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;border:1px solid #a09d96;border-radius:8px;background:transparent;color:#a09d96;cursor:pointer;font-size:13px;margin-right:8px">重試</button><button onclick="localStorage.clear();sessionStorage.clear();location.reload()" style="margin-top:12px;padding:8px 16px;border:1px solid #a09d96;border-radius:8px;background:transparent;color:#a09d96;cursor:pointer;font-size:13px">清除資料後重試</button>'
        splashSubEl.classList.add('visible');
      }
    }, ERROR_TIMEOUT_MS);
  }
} else {
  appRootEl?.removeAttribute('inert');
  document.documentElement.classList.remove('boot-lock');
  document.documentElement.removeAttribute('data-boot-splash-active');
  signalBootSplashRemoved();
}

function ShellReadySignal({ children }: { children: ReactNode }) {
  useEffect(() => signalShellReady(), []);
  return children;
}

const stopWaitingForShell = onShellReady(() => {
  void splashLogoReady.then(({ error }) => {
    if (!error) {
      dismissSplash();
      return;
    }
    console.error('[lunartide] Boot splash logo failed', error);
    if (splashEl) splashEl.dataset.splashPhase = 'error-stopped';
    if (splashSubEl) {
      splashSubEl.innerHTML = '月潮標誌載入失敗<br><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;border:1px solid rgba(231,225,215,.45);border-radius:999px;background:rgba(255,255,255,.04);color:#e7e1d7;cursor:pointer;font-size:13px">重試</button>';
      splashSubEl.classList.add('visible');
    }
  });
});

runClawdDecommissionMigration();
runAssetMigration().then(() => {
  // Apply persisted typography BEFORE React mounts, so CSS vars are set pre-splash-dismissal.
  restoreTypography();
  restoreAppearanceColors();

  // Boot-restore theme mode + appearance preset before React paints (avoid FOUT/flash).
  try {
    const raw = localStorage.getItem('lunartide_data');
    const theme: string | undefined = raw ? JSON.parse(raw)?.state?.theme : undefined;
    const resolvedMode = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : (theme || 'dark');
    if (resolvedMode === 'dark' || resolvedMode === 'light') {
      document.documentElement.setAttribute('data-theme', resolvedMode);
    }
    const presetRaw = localStorage.getItem('lunartide-theme-preset');
    const presetState = presetRaw ? JSON.parse(presetRaw) : undefined;
    const presetId = presetState?.state?.presetId;
    const canonicalPresetIds = ['lunar-tide', 'amber-dusk', 'verdant-tide', 'eclipse', 'rosy-mist'];
    document.documentElement.dataset.appearancePreset = canonicalPresetIds.includes(presetId)
      ? presetId
      : presetId === 'tide-island' || presetId === 'island-breeze' ? 'amber-dusk' : 'lunar-tide';
  } catch { /* localStorage may be unavailable */ }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemePresetProvider>
        <ShellReadySignal><App /></ShellReadySignal>
      </ThemePresetProvider>
    </StrictMode>,
  );
}).catch((error) => {
  console.error('[lunartide] Asset migration failed', error);
  stopWaitingForShell();
  if (splashSubEl) {
    if (splashEl) splashEl.dataset.splashPhase = 'error-stopped';
    splashSubEl.innerHTML = '月潮沒有順利醒來<br><button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;border:1px solid rgba(231,225,215,.45);border-radius:999px;background:rgba(255,255,255,.04);color:#e7e1d7;cursor:pointer;font-size:13px">重試</button>';
    splashSubEl.classList.add('visible');
  }
});
