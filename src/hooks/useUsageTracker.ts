import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useUsageStore } from '@/store/useUsageStore';
import { resolveUsageModule } from '@/types/usage';
import {
  createUsageOwnershipHandle,
  type UsageOwnershipHandle,
} from '@/features/usage/usageOwnership';

const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Production default is a fixed 5 minutes.
 * Test-only override: window.__LUNARTIDE_USAGE_IDLE_MS__ (ms, 1s..1h)
 * lets E2E drive the real idle transition without waiting 5 minutes.
 */
function idleThresholdMs(): number {
  const override = (window as unknown as Record<string, unknown>).__LUNARTIDE_USAGE_IDLE_MS__;
  if (typeof override === 'number' && override >= 1000 && override <= 60 * 60 * 1000) return override;
  return DEFAULT_IDLE_THRESHOLD_MS;
}

export function useUsageTracker() {
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);
  const ownershipRef = useRef<UsageOwnershipHandle | null>(null);

  const store = useUsageStore;

  const resetIdle = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (isIdleRef.current) {
      isIdleRef.current = false;
      const s = store.getState();
      if (
        ownershipRef.current?.isOwner()
        && s.isTracking
        && !s.isLocked()
        && document.visibilityState === 'visible'
        && document.hasFocus()
      ) {
        s.resumeSession();
      }
    }
    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      const s = store.getState();
      if (s.currentSession) {
        s.pauseSession();
      }
    }, idleThresholdMs());
  }, []);

  // Route change → switch module
  useEffect(() => {
    if (pathnameRef.current === location.pathname) return;
    pathnameRef.current = location.pathname;
    const s = store.getState();
    if (
      !ownershipRef.current?.isOwner()
      || !s.isTracking
      || s.isLocked()
      || document.visibilityState !== 'visible'
      || !document.hasFocus()
    ) return;
    const nextModule = resolveUsageModule(location.pathname);
    s.switchModule(nextModule);
  }, [location.pathname]);

  const acquireOwnership = useCallback(() => {
    if (
      document.visibilityState !== 'visible'
      || !document.hasFocus()
      || isIdleRef.current
    ) return;
    ownershipRef.current?.acquire(async () => {
      await store.persist.rehydrate();
      if (
        document.visibilityState !== 'visible'
        || !document.hasFocus()
        || isIdleRef.current
      ) return;
      const s = store.getState();
      if (!s.isLocked()) s.startTracking();
    });
  }, []);

  const releaseOwnership = useCallback(() => {
    if (ownershipRef.current?.isOwner()) store.getState().stopTracking();
    ownershipRef.current?.release();
  }, []);

  // Visibility change
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        isIdleRef.current = false;
        resetIdle();
        acquireOwnership();
      } else {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        releaseOwnership();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquireOwnership, releaseOwnership, resetIdle]);

  // Window focus/blur
  useEffect(() => {
    const onFocus = () => {
      acquireOwnership();
    };
    const onBlur = () => {
      releaseOwnership();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [acquireOwnership, releaseOwnership]);

  // Idle detection via user activity
  useEffect(() => {
    const onActivity = () => {
      if (!ownershipRef.current?.isOwner()) acquireOwnership();
      resetIdle();
    };
    const opts = { passive: true, capture: true };
    window.addEventListener('pointerdown', onActivity, opts);
    window.addEventListener('pointermove', onActivity, opts);
    window.addEventListener('keydown', onActivity, opts);
    window.addEventListener('touchstart', onActivity, opts);
    window.addEventListener('wheel', onActivity, opts);
    return () => {
      window.removeEventListener('pointerdown', onActivity, opts);
      window.removeEventListener('pointermove', onActivity, opts);
      window.removeEventListener('keydown', onActivity, opts);
      window.removeEventListener('touchstart', onActivity, opts);
      window.removeEventListener('wheel', onActivity, opts);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [acquireOwnership, resetIdle]);

  // Page unload → flush
  useEffect(() => {
    const onUnload = () => {
      releaseOwnership();
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [releaseOwnership]);

  // Initial start on mount
  useEffect(() => {
    const ownership = createUsageOwnershipHandle();
    ownershipRef.current = ownership;
    acquireOwnership();
    return () => {
      if (ownership.isOwner()) store.getState().stopTracking();
      ownership.dispose();
      ownershipRef.current = null;
    };
  }, [acquireOwnership]);
}
